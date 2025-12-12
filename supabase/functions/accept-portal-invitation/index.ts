import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return new Response(
        JSON.stringify({ error: "Token and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch the invitation by token
    const { data: invitation, error: invitationError } = await adminClient
      .from("personnel_invitations")
      .select(`
        *,
        personnel:personnel_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (invitationError || !invitation) {
      console.error("Invitation lookup error:", invitationError);
      return new Response(
        JSON.stringify({ error: "Invalid or already used invitation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This invitation has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to create the auth user
    const { data: signUpData, error: signUpError } = await adminClient.auth.admin.createUser({
      email: invitation.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        first_name: invitation.personnel?.first_name,
        last_name: invitation.personnel?.last_name,
      },
    });

    let userId: string;

    if (signUpError) {
      // Check if user already exists
      if (signUpError.message?.includes("already been registered") || signUpError.code === "email_exists") {
        console.log("User already exists, looking up existing user...");
        
        const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers();
        
        if (listError) {
          console.error("Failed to look up existing user:", listError);
          return new Response(
            JSON.stringify({ error: "Failed to look up existing user" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const existingUser = existingUsers.users.find(u => u.email === invitation.email);
        
        if (!existingUser) {
          return new Response(
            JSON.stringify({ error: "User exists but could not be found" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        userId = existingUser.id;
        console.log("Using existing user:", userId);
      } else {
        console.error("User creation error:", signUpError);
        return new Response(
          JSON.stringify({ error: signUpError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (!signUpData.user) {
      return new Response(
        JSON.stringify({ error: "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      userId = signUpData.user.id;
      console.log("Created new user:", userId);
    }

    // Link personnel to auth user
    const { error: linkError } = await adminClient
      .from("personnel")
      .update({ user_id: userId })
      .eq("id", invitation.personnel_id);

    if (linkError) {
      console.error("Personnel link error:", linkError);
      return new Response(
        JSON.stringify({ error: "Failed to link personnel record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Remove any automatically-assigned role (personnel don't need roles in user_roles)
    const { error: deleteRoleError } = await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (deleteRoleError) {
      console.error("Role deletion error:", deleteRoleError);
      // Non-fatal, continue
    }

    // Mark invitation as accepted
    const { error: inviteUpdateError } = await adminClient
      .from("personnel_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (inviteUpdateError) {
      console.error("Invitation update error:", inviteUpdateError);
    }

    console.log("Personnel invitation accepted successfully for:", invitation.email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Account created successfully",
        email: invitation.email
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Unexpected error:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
