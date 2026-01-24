import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize phone number to E.164 format for matching
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  return phone.startsWith("+") ? phone : `+${digits}`;
}

// Extract last 10 digits for flexible matching
function getPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-10);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse Twilio webhook payload (form-encoded)
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const body = formData.get("Body") as string;
    const messageSid = formData.get("MessageSid") as string;

    console.log(`Incoming SMS from ${from}: ${body}`);

    if (!from || !body) {
      console.error("Missing required fields: From or Body");
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { ...corsHeaders, "Content-Type": "application/xml" } }
      );
    }

    const normalizedPhone = normalizePhone(from);
    const phoneDigits = getPhoneDigits(from);

    // Try to identify the sender by phone number
    let senderType: string | null = null;
    let senderId: string | null = null;
    let senderName: string | null = null;

    // Check personnel table first
    const { data: personnel } = await supabase
      .from("personnel")
      .select("id, first_name, last_name, phone")
      .not("phone", "is", null)
      .limit(100);

    if (personnel) {
      const match = personnel.find(p => {
        if (!p.phone) return false;
        return getPhoneDigits(p.phone) === phoneDigits;
      });
      if (match) {
        senderType = "personnel";
        senderId = match.id;
        senderName = `${match.first_name} ${match.last_name}`;
        console.log(`Matched to personnel: ${senderName}`);
      }
    }

    // If not found in personnel, check customers
    if (!senderId) {
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, phone")
        .not("phone", "is", null)
        .limit(100);

      if (customers) {
        const match = customers.find(c => {
          if (!c.phone) return false;
          return getPhoneDigits(c.phone) === phoneDigits;
        });
        if (match) {
          senderType = "customer";
          senderId = match.id;
          senderName = match.name;
          console.log(`Matched to customer: ${senderName}`);
        }
      }
    }

    // If we couldn't identify the sender, log and return
    if (!senderId || !senderType) {
      console.warn(`Unknown sender phone: ${normalizedPhone}. Message not stored in conversations.`);
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { ...corsHeaders, "Content-Type": "application/xml" } }
      );
    }

    // Find an existing conversation where this sender is a participant
    const { data: existingConversations } = await supabase
      .from("conversations")
      .select("id, participant_1_type, participant_1_id, participant_2_type, participant_2_id")
      .or(`and(participant_1_type.eq.${senderType},participant_1_id.eq.${senderId}),and(participant_2_type.eq.${senderType},participant_2_id.eq.${senderId})`)
      .order("last_message_at", { ascending: false })
      .limit(1);

    let conversationId: string;

    if (existingConversations && existingConversations.length > 0) {
      conversationId = existingConversations[0].id;
      console.log(`Found existing conversation: ${conversationId}`);
    } else {
      // Create a new conversation - find an admin to be the other participant
      const { data: adminUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();

      if (!adminUser) {
        console.error("No admin user found to create conversation");
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          { headers: { ...corsHeaders, "Content-Type": "application/xml" } }
        );
      }

      // Create the conversation
      const { data: newConversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          participant_1_type: "user",
          participant_1_id: adminUser.id,
          participant_2_type: senderType,
          participant_2_id: senderId,
          last_message_at: new Date().toISOString(),
          last_message_preview: body.substring(0, 100),
        })
        .select()
        .single();

      if (convError || !newConversation) {
        console.error("Error creating conversation:", convError);
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          { headers: { ...corsHeaders, "Content-Type": "application/xml" } }
        );
      }

      conversationId = newConversation.id;
      console.log(`Created new conversation: ${conversationId}`);

      // Create participant records
      await supabase.from("conversation_participants").insert([
        {
          conversation_id: conversationId,
          participant_type: "user",
          participant_id: adminUser.id,
          unread_count: 1,
        },
        {
          conversation_id: conversationId,
          participant_type: senderType,
          participant_id: senderId,
          unread_count: 0,
        },
      ]);
    }

    // Insert the message into conversation_messages
    const { error: msgError } = await supabase
      .from("conversation_messages")
      .insert({
        conversation_id: conversationId,
        sender_type: senderType,
        sender_id: senderId,
        content: body,
        message_type: "sms",
      });

    if (msgError) {
      console.error("Error inserting message:", msgError);
    } else {
      console.log(`Message inserted into conversation ${conversationId}`);
    }

    // Update conversation metadata
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: body.substring(0, 100),
      })
      .eq("id", conversationId);

    // Increment unread count for other participants
    const { error: rpcError } = await supabase.rpc("increment_unread_count", {
      p_conversation_id: conversationId,
      p_exclude_type: senderType,
      p_exclude_id: senderId,
    });

    if (rpcError) {
      console.error("Error incrementing unread count:", rpcError);
    }

    // Return empty TwiML response (no auto-reply)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { ...corsHeaders, "Content-Type": "application/xml" } }
    );
  } catch (error) {
    console.error("Twilio webhook error:", error);
    
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { ...corsHeaders, "Content-Type": "application/xml" } }
    );
  }
});
