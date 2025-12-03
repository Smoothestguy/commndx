import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMSRequest {
  recipientType: 'customer' | 'personnel';
  recipientId: string;
  recipientName: string;
  recipientPhone: string;
  content: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("User authentication failed:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check user role
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError) {
      console.error("Error fetching user role:", roleError);
    }

    if (!roleData || !['admin', 'manager'].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Only admins and managers can send messages" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { recipientType, recipientId, recipientName, recipientPhone, content }: SMSRequest = await req.json();

    // Validate required fields
    if (!recipientType || !recipientId || !recipientName || !recipientPhone || !content) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Validate phone number format (basic check)
    const cleanPhone = recipientPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return new Response(JSON.stringify({ error: "Invalid phone number format" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Format phone number with country code if missing
    const formattedPhone = cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`;

    console.log(`Sending SMS to ${formattedPhone} for ${recipientType}: ${recipientName}`);

    // Create message record
    const { data: message, error: insertError } = await supabaseClient
      .from("messages")
      .insert({
        recipient_type: recipientType,
        recipient_id: recipientId,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        content,
        sent_by: user.id,
        status: 'pending'
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
      await supabaseClient
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

    console.log(`Calling Twilio API from ${twilioPhone} to ${formattedPhone}`);

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
          Body: content,
        }),
      }
    );

    const twilioData = await twilioResponse.json();
    console.log("Twilio response:", JSON.stringify(twilioData));

    // Update message status based on Twilio response
    if (twilioResponse.ok) {
      await supabaseClient
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

      await supabaseClient
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
    console.error("Error in send-sms function:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
