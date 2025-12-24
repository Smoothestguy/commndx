import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  registrationId: string;
  reason: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get the authorization header from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a client with the user's token to verify their identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error("[ReverseApproval] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[ReverseApproval] User authenticated:", user.id);

    // Check if user has admin/manager role
    const { data: profile } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "manager"].includes(profile.role)) {
      console.error("[ReverseApproval] User not authorized:", profile?.role);
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { registrationId, reason } = body;

    if (!registrationId) {
      return new Response(
        JSON.stringify({ error: "Registration ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[ReverseApproval] Reversing registration:", registrationId);

    // Use service role client for data operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the registration
    const { data: registration, error: regError } = await serviceClient
      .from("personnel_registrations")
      .select("*, personnel_id, vendor_id, customer_id")
      .eq("id", registrationId)
      .single();

    if (regError || !registration) {
      console.error("[ReverseApproval] Registration not found:", regError);
      return new Response(
        JSON.stringify({ error: "Registration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (registration.status !== "approved") {
      return new Response(
        JSON.stringify({ error: "Only approved registrations can be reversed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If personnel was created, revoke onboarding tokens and set to inactive
    if (registration.personnel_id) {
      console.log("[ReverseApproval] Revoking onboarding tokens for personnel:", registration.personnel_id);
      
      // Revoke any active onboarding tokens
      await serviceClient
        .from("personnel_onboarding_tokens")
        .update({
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
          revoke_reason: `Registration reversed: ${reason || "No reason provided"}`,
        })
        .eq("personnel_id", registration.personnel_id)
        .is("used_at", null)
        .is("revoked_at", null);

      // Set personnel to inactive
      await serviceClient
        .from("personnel")
        .update({
          status: "inactive",
          onboarding_status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", registration.personnel_id);

      console.log("[ReverseApproval] Personnel set to inactive");
    }

    // If vendor was created, set to inactive
    if (registration.vendor_id) {
      console.log("[ReverseApproval] Setting vendor to inactive:", registration.vendor_id);
      await serviceClient
        .from("vendors")
        .update({
          status: "inactive",
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", registration.vendor_id);
    }

    // If customer was created, add a note (we don't delete customers)
    if (registration.customer_id) {
      console.log("[ReverseApproval] Adding note to customer:", registration.customer_id);
      await serviceClient
        .from("customers")
        .update({
          notes: `[REVERSED] Registration was reversed on ${new Date().toISOString()}. Reason: ${reason || "No reason provided"}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", registration.customer_id);
    }

    // Update the registration status back to pending
    const { error: updateError } = await serviceClient
      .from("personnel_registrations")
      .update({
        status: "pending",
        reversed_at: new Date().toISOString(),
        reversed_by: user.id,
        reverse_reason: reason || null,
        // Clear the linked IDs so approval can create new records
        personnel_id: null,
        vendor_id: null,
        customer_id: null,
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", registrationId);

    if (updateError) {
      console.error("[ReverseApproval] Failed to update registration:", updateError);
      throw updateError;
    }

    console.log("[ReverseApproval] Registration reversed successfully");

    // Send notification to admins
    try {
      await serviceClient.functions.invoke("create-admin-notification", {
        body: {
          notification_type: "registration_reversed",
          title: `Registration Reversed: ${registration.first_name} ${registration.last_name}`,
          message: `The approval for ${registration.first_name} ${registration.last_name}'s registration has been reversed by ${user.email}. Reason: ${reason || "No reason provided"}`,
          link_url: `/personnel-registrations`,
          related_id: registrationId,
          metadata: {
            registration_id: registrationId,
            reversed_by: user.email,
            reason: reason,
          },
        },
      });
    } catch (notifError) {
      console.error("[ReverseApproval] Failed to send notification:", notifError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Registration approval has been reversed" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ReverseApproval] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
