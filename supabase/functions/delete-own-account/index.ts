import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Create client with user's token to get their ID
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unable to verify user" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    console.log(`Processing account deletion for user: ${userId}`);

    // Step 1: Unlink personnel record (set user_id to null instead of deleting)
    const { error: personnelError } = await supabaseAdmin
      .from("personnel")
      .update({ user_id: null })
      .eq("user_id", userId);
    
    if (personnelError) {
      console.error("Error unlinking personnel:", personnelError);
    }

    // Step 2: Unlink vendor record (set user_id to null instead of deleting)
    const { error: vendorError } = await supabaseAdmin
      .from("vendors")
      .update({ user_id: null })
      .eq("user_id", userId);
    
    if (vendorError) {
      console.error("Error unlinking vendor:", vendorError);
    }

    // Step 3: Delete user_roles
    const { error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);
    
    if (rolesError) {
      console.error("Error deleting user_roles:", rolesError);
    }

    // Step 4: Delete user_permissions
    const { error: permissionsError } = await supabaseAdmin
      .from("user_permissions")
      .delete()
      .eq("user_id", userId);
    
    if (permissionsError) {
      console.error("Error deleting user_permissions:", permissionsError);
    }

    // Step 5: Delete notification_preferences
    const { error: notifError } = await supabaseAdmin
      .from("notification_preferences")
      .delete()
      .eq("user_id", userId);
    
    if (notifError) {
      console.error("Error deleting notification_preferences:", notifError);
    }

    // Step 6: Delete admin_notifications
    const { error: adminNotifError } = await supabaseAdmin
      .from("admin_notifications")
      .delete()
      .eq("user_id", userId);
    
    if (adminNotifError) {
      console.error("Error deleting admin_notifications:", adminNotifError);
    }

    // Step 7: Delete profile (cascade from auth.users should handle this, but explicit is safer)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);
    
    if (profileError) {
      console.error("Error deleting profile:", profileError);
    }

    // Step 8: Delete the auth user (this requires service role)
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteUserError) {
      console.error("Error deleting auth user:", deleteUserError);
      return new Response(
        JSON.stringify({ error: "Failed to delete account: " + deleteUserError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully deleted account for user: ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Account deleted successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
