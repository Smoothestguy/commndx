import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type RecordType = 'personnel' | 'vendor' | 'customer' | 'personnel_vendor';

interface RequestBody {
  registrationId: string;
  action: "approve" | "reject";
  reason?: string;
  recordType?: RecordType;
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
    const { registrationId, action, reason, recordType = 'personnel' } = body;

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

      // Send notification to admins about rejection
      try {
        await fetch(`${supabaseUrl}/functions/v1/create-admin-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            notification_type: "application_rejected",
            title: `Application Rejected: ${registration.first_name} ${registration.last_name}`,
            message: `Registration for ${registration.first_name} ${registration.last_name} was rejected${reason ? `: ${reason}` : ""}`,
            link_url: "/staffing/applications",
            related_id: registrationId,
            metadata: {
              applicant_name: `${registration.first_name} ${registration.last_name}`,
              applicant_email: registration.email,
              rejected_by: user.id,
              reason: reason || null,
            },
          }),
        });
        console.log("Rejection notification sent to admins");
      } catch (notifError) {
        console.error("Failed to send rejection notification:", notifError);
      }

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
      let personnelId: string | null = null;
      let vendorId: string | null = null;
      let customerId: string | null = null;

      // Create Personnel record if needed
      if (recordType === 'personnel' || recordType === 'personnel_vendor') {
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

        personnelId = personnel.id;
        console.log(`Personnel created: ${personnelId}`);

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
            personnel_id: personnelId,
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
          } else {
            console.log(`Created ${contactInserts.length} emergency contacts for personnel ${personnelId}`);
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
            const newPath = doc.path.replace("pending/", `${personnelId}/`);

            const { error: moveError } = await serviceClient.storage
              .from("personnel-documents")
              .move(doc.path, newPath);

            if (moveError) {
              console.error(`Failed to move document ${doc.path}:`, moveError);
            } else {
              console.log(`Moved document from ${doc.path} to ${newPath}`);
            }
          }
        }
      }

      // Create Vendor record if needed
      if (recordType === 'vendor' || recordType === 'personnel_vendor') {
        const { data: vendor, error: vendorError } = await serviceClient
          .from("vendors")
          .insert({
            name: `${registration.first_name} ${registration.last_name}`,
            email: registration.email,
            phone: registration.phone,
            address: registration.address,
            city: registration.city,
            state: registration.state,
            zip: registration.zip,
            // Tax fields for 1099 tracking
            tax_id: registration.ssn_full || null,
            track_1099: true,
            vendor_type: 'personnel',
          })
          .select()
          .single();

        if (vendorError) {
          console.error("Vendor creation error:", vendorError);
          return new Response(
            JSON.stringify({ error: "Failed to create vendor record" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        vendorId = vendor.id;
        console.log(`Vendor created: ${vendorId}`);

        // Sync vendor to QuickBooks if connected
        try {
          const { data: qbConfig } = await serviceClient
            .from("quickbooks_config")
            .select("is_connected")
            .maybeSingle();

          if (qbConfig?.is_connected) {
            console.log(`QuickBooks connected, syncing vendor ${vendorId}`);
            const qbSyncResponse = await fetch(
              `${supabaseUrl}/functions/v1/quickbooks-sync-vendors`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  action: "sync-single",
                  vendorId: vendorId,
                }),
              }
            );

            if (qbSyncResponse.ok) {
              console.log(`Vendor ${vendorId} synced to QuickBooks`);
            } else {
              const qbError = await qbSyncResponse.text();
              console.error(`Failed to sync vendor to QuickBooks: ${qbError}`);
            }
          }
        } catch (qbError) {
          console.error("QuickBooks sync error (non-fatal):", qbError);
        }

        // If we also created personnel, link them
        if (personnelId && recordType === 'personnel_vendor') {
          const { error: linkError } = await serviceClient
            .from("personnel")
            .update({ linked_vendor_id: vendorId })
            .eq("id", personnelId);

          if (linkError) {
            console.error("Failed to link personnel to vendor:", linkError);
          } else {
            console.log(`Linked personnel ${personnelId} to vendor ${vendorId}`);
          }
        }
      }

      // Create Customer record if needed
      if (recordType === 'customer') {
        const { data: customer, error: customerError } = await serviceClient
          .from("customers")
          .insert({
            name: `${registration.first_name} ${registration.last_name}`,
            email: registration.email,
            phone: registration.phone,
            address: registration.address,
          })
          .select()
          .single();

        if (customerError) {
          console.error("Customer creation error:", customerError);
          return new Response(
            JSON.stringify({ error: "Failed to create customer record" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        customerId = customer.id;
        console.log(`Customer created: ${customerId}`);
      }

      // Update registration status to approved with personnel_id link
      const { error: updateError } = await serviceClient
        .from("personnel_registrations")
        .update({
          status: "approved",
          personnel_id: personnelId,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", registrationId);

      if (updateError) {
        console.error("Update error:", updateError);
        // Non-fatal, records were created successfully
      }

      // Determine link URL and notification message based on record type
      let linkUrl = "/staffing/applications";
      let notificationMessage = `Registration for ${registration.first_name} ${registration.last_name} has been approved.`;
      
      if (personnelId) {
        linkUrl = `/personnel/${personnelId}`;
        notificationMessage += " Personnel record created.";
      }
      if (vendorId) {
        notificationMessage += " Vendor record created.";
      }
      if (customerId) {
        linkUrl = `/customers/${customerId}`;
        notificationMessage += " Customer record created.";
      }

      console.log(`Registration ${registrationId} approved by ${user.id}, recordType: ${recordType}`);

      // Send notification to admins about approval
      try {
        await fetch(`${supabaseUrl}/functions/v1/create-admin-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            notification_type: "application_approved",
            title: `Application Approved: ${registration.first_name} ${registration.last_name}`,
            message: notificationMessage,
            link_url: linkUrl,
            related_id: personnelId || vendorId || customerId,
            metadata: {
              name: `${registration.first_name} ${registration.last_name}`,
              email: registration.email,
              approved_by: user.id,
              registration_id: registrationId,
              record_type: recordType,
              personnel_id: personnelId,
              vendor_id: vendorId,
              customer_id: customerId,
            },
          }),
        });
        console.log("Approval notification sent to admins");
      } catch (notifError) {
        console.error("Failed to send approval notification:", notifError);
      }

      // Send onboarding email only for personnel
      if (personnelId) {
        try {
          const emailResponse = await fetch(
            `${supabaseUrl}/functions/v1/send-personnel-onboarding-email`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                personnelId: personnelId,
                email: registration.email,
                firstName: registration.first_name,
                lastName: registration.last_name,
              }),
            }
          );

          if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.error("Failed to send onboarding email:", errorText);
          } else {
            console.log(`Onboarding email sent to ${registration.email}`);
          }
        } catch (emailError) {
          console.error("Error sending onboarding email:", emailError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: "approved",
          recordType,
          personnelId,
          vendorId,
          customerId,
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
