import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Admin client to bypass RLS
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    // Regular client for auth operations
    const anonClient = createClient(supabaseUrl, anonKey);

    console.log("Fetching vendor invitation with token:", token);

    // Get the invitation
    const { data: invitation, error: invitationError } = await adminClient
      .from("vendor_invitations")
      .select("*, vendor:vendors(*)")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (invitationError || !invitation) {
      console.error("Invitation error:", invitationError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired invitation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Invitation has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found invitation for email:", invitation.email);

    let userId: string;

    // Try to create new user using admin client
    const { data: signUpData, error: signUpError } = await adminClient.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      user_metadata: {
        vendor_name: invitation.vendor?.name,
      },
    });

    if (signUpError) {
      console.log("Signup error:", signUpError.message);
      // If user already exists, look them up
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
        throw signUpError;
      }
    } else {
      if (!signUpData.user) {
        return new Response(
          JSON.stringify({ error: "Failed to create user" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = signUpData.user.id;
      console.log("Created new user:", userId);
    }

    console.log("User ID:", userId);

    // Link vendor to auth user
    const { error: linkError } = await adminClient
      .from("vendors")
      .update({ user_id: userId })
      .eq("id", invitation.vendor_id);

    if (linkError) {
      console.error("Link vendor error:", linkError);
      throw linkError;
    }

    // IMPORTANT: Remove any auto-assigned role for this user
    // Vendors should NOT have a role in user_roles - they are identified by vendors.user_id
    const { error: deleteRoleError } = await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (deleteRoleError) {
      console.error("Delete role error:", deleteRoleError);
      // Not critical, continue
    }

    console.log("Removed any existing roles for vendor user");

    // Mark invitation as accepted
    const { error: updateInviteError } = await adminClient
      .from("vendor_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (updateInviteError) {
      console.error("Update invitation error:", updateInviteError);
      throw updateInviteError;
    }

    console.log("Vendor invitation accepted successfully");

    return new Response(
      JSON.stringify({
        success: true,
        vendorId: invitation.vendor_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in accept-vendor-invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
