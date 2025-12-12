import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log("No authorization header provided");
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client with the user's token to verify they're an admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: requestingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !requestingUser) {
      console.log("Failed to get requesting user:", userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if the user is an admin
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: roleData, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      console.log("User is not an admin:", roleError || roleData?.role);
      return new Response(
        JSON.stringify({ error: 'Only admins can create users manually' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, password, firstName, lastName, role, personnelId, vendorId } = await req.json();

    console.log("Creating user manually:", { email, role, personnelId, vendorId, hasPassword: !!password });

    if (!email || !password || !role) {
      return new Response(
        JSON.stringify({ error: 'Email, password, and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the user with admin client
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        first_name: firstName || '',
        last_name: lastName || '',
      }
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("User created successfully:", newUser.user.id);

    // Create profile if not auto-created by trigger
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: newUser.user.id,
        email: email,
        first_name: firstName || '',
        last_name: lastName || '',
      });

    if (profileError) {
      console.error("Error creating profile:", profileError);
      // Don't fail if profile already exists
    }

    // Delete any existing role and assign new role
    // If linking to personnel, always assign 'personnel' role
    // If linking to vendor, always assign 'vendor' role
    await adminClient.from('user_roles').delete().eq('user_id', newUser.user.id);
    
    let assignedRole = role;
    if (personnelId) {
      assignedRole = 'personnel';
    } else if (vendorId) {
      assignedRole = 'vendor';
    }
    
    const { error: roleInsertError } = await adminClient
      .from('user_roles')
      .insert({ user_id: newUser.user.id, role: assignedRole });

    if (roleInsertError) {
      console.error("Error assigning role:", roleInsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to assign role: ' + roleInsertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Role assigned:", assignedRole);

    // Link to personnel if personnelId is provided
    if (personnelId) {
      const { error: personnelError } = await adminClient
        .from('personnel')
        .update({ user_id: newUser.user.id })
        .eq('id', personnelId);

      if (personnelError) {
        console.error("Error linking personnel:", personnelError);
        // Don't fail the whole operation, just log
      } else {
        console.log("Linked to personnel:", personnelId);
      }
    }

    // Link to vendor if vendorId is provided
    if (vendorId) {
      const { error: vendorError } = await adminClient
        .from('vendors')
        .update({ user_id: newUser.user.id })
        .eq('id', vendorId);

      if (vendorError) {
        console.error("Error linking vendor:", vendorError);
        // Don't fail the whole operation, just log
      } else {
        console.log("Linked to vendor:", vendorId);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: newUser.user.id,
        message: 'User created successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
