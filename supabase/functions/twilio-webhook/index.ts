import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize phone number to E.164 format for matching
function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");
  
  // If starts with 1 and has 11 digits, it's a US number with country code
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  
  // If 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // Otherwise, return with + prefix if not already there
  return phone.startsWith("+") ? phone : `+${digits}`;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse Twilio webhook payload (form-encoded)
    const formData = await req.formData();
    const from = formData.get("From") as string; // Sender phone number
    const to = formData.get("To") as string; // Your Twilio number
    const body = formData.get("Body") as string; // Message content
    const messageSid = formData.get("MessageSid") as string;

    console.log(`Incoming SMS from ${from}: ${body}`);

    if (!from || !body) {
      console.error("Missing required fields: From or Body");
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { ...corsHeaders, "Content-Type": "application/xml" } }
      );
    }

    // Normalize phone number for matching
    const normalizedPhone = normalizePhone(from);

    // Find the most recent outbound message to this phone number
    const { data: originalMessage, error: findError } = await supabase
      .from("messages")
      .select("*")
      .eq("recipient_phone", normalizedPhone)
      .eq("direction", "outbound")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error("Error finding original message:", findError);
    }

    // If we found an original message, update it with response info
    if (originalMessage) {
      const { error: updateError } = await supabase
        .from("messages")
        .update({
          has_response: true,
          response_content: body,
          response_received_at: new Date().toISOString(),
        })
        .eq("id", originalMessage.id);

      if (updateError) {
        console.error("Error updating original message:", updateError);
      } else {
        console.log(`Updated message ${originalMessage.id} with response`);
      }
    }

    // Create an inbound message record
    const { data: inboundMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        recipient_type: originalMessage?.recipient_type || "customer",
        recipient_id: originalMessage?.recipient_id || null,
        recipient_name: originalMessage?.recipient_name || "Unknown",
        recipient_phone: normalizedPhone,
        content: body,
        direction: "inbound",
        status: "delivered",
        message_type: "sms",
        parent_message_id: originalMessage?.id || null,
        external_id: messageSid,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating inbound message:", insertError);
    } else {
      console.log(`Created inbound message ${inboundMessage.id}`);
    }

    // Return empty TwiML response (no auto-reply)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { ...corsHeaders, "Content-Type": "application/xml" } }
    );
  } catch (error) {
    console.error("Twilio webhook error:", error);
    
    // Still return valid TwiML even on error to prevent Twilio retries
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { ...corsHeaders, "Content-Type": "application/xml" } }
    );
  }
});
