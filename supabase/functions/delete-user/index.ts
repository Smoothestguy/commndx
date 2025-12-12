import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a client with the user's token to verify they're an admin
    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the requesting user
    const { data: { user: requestingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !requestingUser) {
      console.error("Error getting requesting user:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if the requesting user is an admin
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      console.error("User is not an admin:", roleError);
      return new Response(JSON.stringify({ error: "Only admins can delete users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the user ID to delete from the request body
    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent admins from deleting themselves
    if (userId === requestingUser.id) {
      return new Response(JSON.stringify({ error: "You cannot delete your own account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Admin ${requestingUser.email} is deleting user ${userId}`);

    // Unlink from personnel (set user_id to null instead of deleting)
    const { error: personnelError } = await adminClient
      .from("personnel")
      .update({ user_id: null })
      .eq("user_id", userId);

    if (personnelError) {
      console.error("Error unlinking personnel:", personnelError);
    }

    // Unlink from vendors (set user_id to null instead of deleting)
    const { error: vendorError } = await adminClient
      .from("vendors")
      .update({ user_id: null })
      .eq("user_id", userId);

    if (vendorError) {
      console.error("Error unlinking vendor:", vendorError);
    }

    // Delete user permissions
    const { error: permissionsError } = await adminClient
      .from("user_permissions")
      .delete()
      .eq("user_id", userId);

    if (permissionsError) {
      console.error("Error deleting user permissions:", permissionsError);
    }

    // Delete user roles
    const { error: rolesError } = await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (rolesError) {
      console.error("Error deleting user roles:", rolesError);
    }

    // Delete notification preferences
    const { error: prefsError } = await adminClient
      .from("notification_preferences")
      .delete()
      .eq("user_id", userId);

    if (prefsError) {
      console.error("Error deleting notification preferences:", prefsError);
    }

    // Delete the profile
    const { error: profileError } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.error("Error deleting profile:", profileError);
    }

    // Finally, delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete user: " + deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Successfully deleted user ${userId}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error in delete-user function:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
