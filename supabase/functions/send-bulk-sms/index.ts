import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BulkSMSRequest {
  projectId?: string;
  projectName?: string;
  content: string;
  recipientIds: string[];
  messageContext?: string; // 'onboarding_reminder', 'project_notification', etc.
}

interface RecipientResult {
  personnelId: string;
  personnelName: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user and get their role
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has admin or manager role
    const { data: userRoles } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const hasPermission = userRoles?.some(r => r.role === "admin" || r.role === "manager");
    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { projectId, projectName, content, recipientIds, messageContext }: BulkSMSRequest = await req.json();

    if (!content || !recipientIds?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: content, recipientIds" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch personnel details
    const { data: personnel, error: personnelError } = await supabaseClient
      .from("personnel")
      .select("id, first_name, last_name, phone")
      .in("id", recipientIds);

    if (personnelError) {
      throw new Error(`Failed to fetch personnel: ${personnelError.message}`);
    }

    // Get Twilio credentials
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    const hasTwilioConfig = twilioSid && twilioToken && twilioPhone;

    // Generate batch ID for tracking
    const batchId = crypto.randomUUID();
    const results: RecipientResult[] = [];
    let totalSent = 0;
    let totalFailed = 0;

    // Process each recipient
    for (const person of personnel || []) {
      const personnelName = `${person.first_name} ${person.last_name}`;

      // Skip if no phone number
      if (!person.phone) {
        results.push({
          personnelId: person.id,
          personnelName,
          status: "skipped",
          error: "No phone number",
        });
        continue;
      }

      // Format phone number
      let formattedPhone = person.phone.replace(/\D/g, "");
      if (formattedPhone.length === 10) {
        formattedPhone = `+1${formattedPhone}`;
      } else if (!formattedPhone.startsWith("+")) {
        formattedPhone = `+${formattedPhone}`;
      }

      // Insert message record
      const { data: messageRecord, error: insertError } = await supabaseClient
        .from("messages")
        .insert({
          recipient_type: "personnel",
          recipient_id: person.id,
          recipient_name: personnelName,
          recipient_phone: formattedPhone,
          content,
          message_type: "sms",
          status: "pending",
          sent_by: user.id,
          payload: {
            notification_type: messageContext || "bulk_notification",
            project_id: projectId || null,
            project_name: projectName || null,
            bulk_batch_id: batchId,
          },
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to insert message record:", insertError);
        results.push({
          personnelId: person.id,
          personnelName,
          status: "failed",
          error: "Failed to create message record",
        });
        totalFailed++;
        continue;
      }

      // Send via Twilio if configured
      if (hasTwilioConfig) {
        try {
          const twilioResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
              },
              body: new URLSearchParams({
                To: formattedPhone,
                From: twilioPhone,
                Body: content,
              }),
            }
          );

          if (twilioResponse.ok) {
            const twilioData = await twilioResponse.json();

            // Update message status to sent
            await supabaseClient
              .from("messages")
              .update({
                status: "sent",
                sent_at: new Date().toISOString(),
                external_id: twilioData.sid,
              })
              .eq("id", messageRecord.id);

            results.push({
              personnelId: person.id,
              personnelName,
              status: "sent",
            });
            totalSent++;
          } else {
            const errorText = await twilioResponse.text();
            console.error("Twilio error:", errorText);

            // Update message status to failed
            await supabaseClient
              .from("messages")
              .update({
                status: "failed",
                error_message: errorText,
              })
              .eq("id", messageRecord.id);

            results.push({
              personnelId: person.id,
              personnelName,
              status: "failed",
              error: "Twilio delivery failed",
            });
            totalFailed++;
          }
        } catch (twilioError) {
          console.error("Twilio request error:", twilioError);

          await supabaseClient
            .from("messages")
            .update({
              status: "failed",
              error_message: String(twilioError),
            })
            .eq("id", messageRecord.id);

          results.push({
            personnelId: person.id,
            personnelName,
            status: "failed",
            error: "Network error sending SMS",
          });
          totalFailed++;
        }

        // Rate limiting: 100ms delay between messages
        await new Promise((resolve) => setTimeout(resolve, 100));
      } else {
        // No Twilio config - mark as sent for testing
        await supabaseClient
          .from("messages")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", messageRecord.id);

        results.push({
          personnelId: person.id,
          personnelName,
          status: "sent",
        });
        totalSent++;
        console.log(`[DEV MODE] Would send SMS to ${formattedPhone}: ${content}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        batchId,
        totalSent,
        totalFailed,
        totalSkipped: results.filter((r) => r.status === "skipped").length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Bulk SMS error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
