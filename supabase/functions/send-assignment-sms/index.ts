import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AssignmentSMSRequest {
  personnelId: string;
  projectId: string;
  assignmentId?: string;
  scheduledDate?: string;      // Optional: YYYY-MM-DD
  scheduledStartTime?: string; // Optional: HH:MM (24-hour format)
  force?: boolean;             // Optional: bypass duplicate check for re-assignments
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { personnelId, projectId, assignmentId, scheduledDate, scheduledStartTime, force }: AssignmentSMSRequest = await req.json();

    console.log(`Processing assignment SMS for personnel ${personnelId} on project ${projectId}${force ? ' (force mode)' : ''}`);

    // Validate required fields
    if (!personnelId || !projectId) {
      return new Response(JSON.stringify({ error: "Missing required fields: personnelId and projectId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check if SMS was already sent recently for this assignment (prevent rapid duplicates)
    // Only skip if an SMS was sent within the last 5 minutes, unless force is true
    if (assignmentId && !force) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: existingMessage } = await supabaseAdmin
        .from("messages")
        .select("id, created_at")
        .eq("recipient_id", personnelId)
        .eq("message_type", "sms")
        .contains("payload", { assignment_id: assignmentId, notification_type: "assignment_notification" })
        .gte("created_at", fiveMinutesAgo)
        .single();

      if (existingMessage) {
        console.log(`SMS already sent for assignment ${assignmentId} within the last 5 minutes`);
        return new Response(JSON.stringify({ 
          success: true, 
          skipped: true,
          reason: "SMS already sent for this assignment within the last 5 minutes" 
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Fetch personnel details
    const { data: personnel, error: personnelError } = await supabaseAdmin
      .from("personnel")
      .select("id, first_name, last_name, phone, email, status")
      .eq("id", personnelId)
      .single();

    if (personnelError || !personnel) {
      console.error("Personnel not found:", personnelError);
      return new Response(JSON.stringify({ error: "Personnel not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Validate phone number exists
    if (!personnel.phone) {
      console.log(`Personnel ${personnelId} has no phone number`);
      return new Response(JSON.stringify({ 
        success: false, 
        skipped: true,
        reason: "Personnel has no phone number" 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch project details
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, name, address, city, state, zip, require_clock_location")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      console.error("Project not found:", projectError);
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get schedule - either from request params or find existing
    let scheduleInfo = {
      date: scheduledDate,
      startTime: scheduledStartTime
    };

    if (!scheduleInfo.date || !scheduleInfo.startTime) {
      // Look for upcoming schedule
      const today = new Date().toISOString().split('T')[0];
      const { data: schedule } = await supabaseAdmin
        .from("personnel_schedules")
        .select("scheduled_date, scheduled_start_time")
        .eq("personnel_id", personnelId)
        .eq("project_id", projectId)
        .gte("scheduled_date", today)
        .order("scheduled_date", { ascending: true })
        .limit(1)
        .single();

      if (schedule) {
        scheduleInfo.date = schedule.scheduled_date;
        scheduleInfo.startTime = schedule.scheduled_start_time;
      }
    }

    // Build the portal URL
    const siteUrl = Deno.env.get("SITE_URL") || "https://xfjjvznxkcckuwxmcsdc.lovableproject.com";
    const portalLink = `${siteUrl}/portal/time-clock`;

    // Format the address
    let fullAddress = "";
    if (project.address) {
      const addressParts = [project.address];
      if (project.city) addressParts.push(project.city);
      if (project.state) addressParts.push(project.state);
      if (project.zip) addressParts.push(project.zip);
      fullAddress = addressParts.join(", ");
    }

    // Format date and time for display
    let scheduleDisplay = "";
    if (scheduleInfo.date && scheduleInfo.startTime) {
      const dateObj = new Date(scheduleInfo.date + 'T00:00:00');
      const formattedDate = dateObj.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
      
      // Format time (convert from HH:MM:SS to readable format)
      const timeParts = scheduleInfo.startTime.split(':');
      const hours = parseInt(timeParts[0]);
      const minutes = timeParts[1];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const formattedTime = `${displayHours}:${minutes} ${ampm}`;
      
      scheduleDisplay = `${formattedTime} on ${formattedDate}`;
    }

    // Build SMS message
    let smsContent = `Hi ${personnel.first_name},\n\n`;
    smsContent += `You've been assigned to: ${project.name}\n\n`;
    
    if (scheduleDisplay) {
      smsContent += `Report Time: ${scheduleDisplay}\n\n`;
      smsContent += `⚠️ IMPORTANT: You must clock in within 10 minutes of your scheduled start time, or you will be unable to clock in without admin assistance.\n\n`;
    } else {
      smsContent += `Your schedule will be provided by your supervisor.\n\n`;
    }
    
    if (fullAddress) {
      smsContent += `Location:\n${fullAddress}\n\n`;
    }
    
    smsContent += `Clock in here when you arrive:\n${portalLink}`;

    console.log(`SMS Content:\n${smsContent}`);

    // Format phone number
    const cleanPhone = personnel.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return new Response(JSON.stringify({ error: "Invalid phone number format" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const formattedPhone = cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`;

    // Create message record
    const { data: message, error: insertError } = await supabaseAdmin
      .from("messages")
      .insert({
        recipient_type: 'personnel',
        recipient_id: personnelId,
        recipient_name: `${personnel.first_name} ${personnel.last_name}`,
        recipient_phone: personnel.phone,
        content: smsContent,
        message_type: 'sms',
        status: 'pending',
        payload: {
          notification_type: 'assignment_notification',
          project_id: projectId,
          project_name: project.name,
          assignment_id: assignmentId || null,
          scheduled_date: scheduleInfo.date,
          scheduled_start_time: scheduleInfo.startTime
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating message record:", insertError);
      throw insertError;
    }

    // Send via Twilio
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !twilioPhone) {
      console.error("Twilio credentials not configured");
      await supabaseAdmin
        .from("messages")
        .update({
          status: 'failed',
          error_message: 'Twilio credentials not configured'
        })
        .eq("id", message.id);

      return new Response(JSON.stringify({ error: "SMS service not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Sending SMS from ${twilioPhone} to ${formattedPhone}`);

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: formattedPhone,
          From: twilioPhone,
          Body: smsContent,
        }),
      }
    );

    const twilioData = await twilioResponse.json();
    console.log("Twilio response:", JSON.stringify(twilioData));

    // Update message status based on Twilio response
    if (twilioResponse.ok) {
      await supabaseAdmin
        .from("messages")
        .update({
          status: 'sent',
          external_id: twilioData.sid,
          sent_at: new Date().toISOString()
        })
        .eq("id", message.id);

      console.log(`SMS sent successfully. Twilio SID: ${twilioData.sid}`);

      return new Response(JSON.stringify({ 
        success: true, 
        messageId: message.id,
        twilioSid: twilioData.sid 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } else {
      const errorMessage = twilioData.message || twilioData.error_message || 'Failed to send SMS';
      console.error("Twilio error:", errorMessage);

      await supabaseAdmin
        .from("messages")
        .update({
          status: 'failed',
          error_message: errorMessage
        })
        .eq("id", message.id);

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  } catch (error: any) {
    console.error("Error in send-assignment-sms function:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
