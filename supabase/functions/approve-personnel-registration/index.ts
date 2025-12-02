import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  registrationId: string;
  action: "approve" | "reject";
  reason?: string;
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

    // Create client with user's auth token to verify permissions
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user has admin or manager role
    const { data: roleData, error: roleError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || !roleData) {
      console.error("Role error:", roleError);
      return new Response(JSON.stringify({ error: "User role not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["admin", "manager"].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body: RequestBody = await req.json();
    const { registrationId, action, reason } = body;

    if (!registrationId || !action) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use service role client for database operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get the registration
    const { data: registration, error: fetchError } = await serviceClient
      .from("personnel_registrations")
      .select("*")
      .eq("id", registrationId)
      .single();

    if (fetchError || !registration) {
      console.error("Fetch error:", fetchError);
      return new Response(JSON.stringify({ error: "Registration not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (registration.status !== "pending") {
      return new Response(
        JSON.stringify({ error: "Registration already processed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "reject") {
      // Update registration status to rejected
      const { error: updateError } = await serviceClient
        .from("personnel_registrations")
        .update({
          status: "rejected",
          rejection_reason: reason || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", registrationId);

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to reject registration" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log(`Registration ${registrationId} rejected by ${user.id}`);

      return new Response(
        JSON.stringify({ success: true, action: "rejected" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle approve action
    if (action === "approve") {
      // Create personnel record with new fields
      const { data: personnel, error: personnelError } = await serviceClient
        .from("personnel")
        .insert({
          first_name: registration.first_name,
          last_name: registration.last_name,
          email: registration.email,
          phone: registration.phone,
          date_of_birth: registration.date_of_birth,
          address: registration.address,
          city: registration.city,
          state: registration.state,
          zip: registration.zip,
          work_authorization_type: registration.work_authorization_type,
          work_auth_expiry: registration.work_auth_expiry,
          ssn_last_four: registration.ssn_last_four,
          ssn_full: registration.ssn_full,
          citizenship_status: registration.citizenship_status,
          immigration_status: registration.immigration_status,
          personnel_number: "", // Will be auto-generated by trigger
          status: "active",
          everify_status: "pending",
        })
        .select()
        .single();

      if (personnelError) {
        console.error("Personnel creation error:", personnelError);
        return new Response(
          JSON.stringify({ error: "Failed to create personnel record" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log(`Personnel created: ${personnel.id}`);

      // Create emergency contacts
      const emergencyContacts = registration.emergency_contacts as Array<{
        name: string;
        relationship: string;
        phone: string;
        email?: string;
        is_primary: boolean;
      }>;

      if (emergencyContacts && emergencyContacts.length > 0) {
        const contactInserts = emergencyContacts.map((contact) => ({
          personnel_id: personnel.id,
          contact_name: contact.name,
          relationship: contact.relationship,
          phone: contact.phone,
          email: contact.email || null,
          is_primary: contact.is_primary,
        }));

        const { error: contactsError } = await serviceClient
          .from("emergency_contacts")
          .insert(contactInserts);

        if (contactsError) {
          console.error("Emergency contacts error:", contactsError);
          // Non-fatal, continue
        } else {
          console.log(
            `Created ${contactInserts.length} emergency contacts for personnel ${personnel.id}`
          );
        }
      }

      // Move documents from pending folder to personnel folder
      const documents = registration.documents as Array<{
        name: string;
        path: string;
        type: string;
        uploaded_at: string;
      }>;

      if (documents && documents.length > 0) {
        for (const doc of documents) {
          const newPath = doc.path.replace("pending/", `${personnel.id}/`);

          const { error: moveError } = await serviceClient.storage
            .from("personnel-documents")
            .move(doc.path, newPath);

          if (moveError) {
            console.error(`Failed to move document ${doc.path}:`, moveError);
            // Non-fatal, continue
          } else {
            console.log(`Moved document from ${doc.path} to ${newPath}`);
          }
        }
      }

      // Update registration status to approved
      const { error: updateError } = await serviceClient
        .from("personnel_registrations")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", registrationId);

      if (updateError) {
        console.error("Update error:", updateError);
        // Non-fatal, personnel was created successfully
      }

      console.log(
        `Registration ${registrationId} approved by ${user.id}, created personnel ${personnel.id}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          action: "approved",
          personnelId: personnel.id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
