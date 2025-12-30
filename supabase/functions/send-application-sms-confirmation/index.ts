import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMSConfirmationRequest {
  applicationId: string;
  phone: string;
  firstName: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role for this public-facing function
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { applicationId, phone, firstName }: SMSConfirmationRequest = await req.json();

    // Validate required fields
    if (!applicationId || !phone || !firstName) {
      console.error("Missing required fields:", { applicationId, phone, firstName });
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`[SMS Confirmation] Processing for application: ${applicationId}`);

    // Get the application to verify it exists and get the edit token
    const { data: application, error: appError } = await supabaseClient
      .from("applications")
      .select("id, edit_token, sms_consent, sms_confirmation_sent_at")
      .eq("id", applicationId)
      .single();

    if (appError || !application) {
      console.error("Application not found:", appError);
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Don't send if already sent
    if (application.sms_confirmation_sent_at) {
      console.log("[SMS Confirmation] Already sent, skipping");
      return new Response(JSON.stringify({ success: true, message: "Already sent" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Don't send if no consent
    if (!application.sms_consent) {
      console.log("[SMS Confirmation] No SMS consent, skipping");
      return new Response(JSON.stringify({ success: true, message: "No consent" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Generate edit token if not exists
    let editToken = application.edit_token;
    if (!editToken) {
      editToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14); // 14 days expiry

      await supabaseClient
        .from("applications")
        .update({
          edit_token: editToken,
          edit_token_expires_at: expiresAt.toISOString(),
        })
        .eq("id", applicationId);
    }

    // Build the status link
    const siteUrl = Deno.env.get("SITE_URL") || "https://xfjjvznxkcckuwxmcsdc.supabase.co";
    const statusLink = `${siteUrl}/apply/edit/${editToken}`;

    // Format phone number
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`;

    // Compose the message
    const message = `Hi ${firstName}! Your application to Fairfield has been received. Check your status: ${statusLink} Reply STOP to opt out.`;

    console.log(`[SMS Confirmation] Sending to ${formattedPhone}`);

    // Send via Twilio
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !twilioPhone) {
      console.error("Twilio credentials not configured");
      return new Response(JSON.stringify({ error: "SMS service not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

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
          Body: message,
        }),
      }
    );

    const twilioData = await twilioResponse.json();
    console.log("[SMS Confirmation] Twilio response:", JSON.stringify(twilioData));

    if (twilioResponse.ok) {
      // Update the application with confirmation sent timestamp
      await supabaseClient
        .from("applications")
        .update({
          sms_confirmation_sent_at: new Date().toISOString(),
        })
        .eq("id", applicationId);

      console.log(`[SMS Confirmation] Sent successfully. Twilio SID: ${twilioData.sid}`);

      return new Response(JSON.stringify({ 
        success: true, 
        twilioSid: twilioData.sid 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } else {
      const errorMessage = twilioData.message || twilioData.error_message || 'Failed to send SMS';
      console.error("[SMS Confirmation] Twilio error:", errorMessage);

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  } catch (error: any) {
    console.error("[SMS Confirmation] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
