import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, signature, signer_name, signer_email, action, notes } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the change order by token
    const { data: co, error: coError } = await supabaseAdmin
      .from("change_orders")
      .select("*, project:projects(id, name, customer_field_supervisor_name, customer_field_supervisor_email, customer_pm_name, customer_pm_email)")
      .or(`field_supervisor_approval_token.eq.${token},customer_pm_approval_token.eq.${token}`)
      .single();

    if (coError || !co) {
      return new Response(JSON.stringify({ error: "Invalid or expired approval link" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const project = co.project as any;
    const isFieldSupervisor = co.field_supervisor_approval_token === token;
    const isCustomerPM = co.customer_pm_approval_token === token;

    // Handle rejection
    if (action === "reject") {
      await supabaseAdmin
        .from("change_orders")
        .update({ status: "rejected" })
        .eq("id", co.id);

      await supabaseAdmin.from("change_order_approval_log").insert({
        change_order_id: co.id,
        action: "rejected",
        actor_name: signer_name || "Unknown",
        actor_email: signer_email || "",
        notes: notes || "Change order rejected",
      });

      // Notify internal team
      const { data: profiles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "manager"]);

      if (profiles) {
        const notifications = profiles.map((p: any) => ({
          user_id: p.user_id,
          title: `CO ${co.number} REJECTED`,
          message: `Change order ${co.number} for ${project.name} was rejected by ${signer_name || 'the reviewer'}. ${notes ? `Reason: ${notes}` : ''}`,
          notification_type: "change_order_rejected",
          related_id: co.id,
          link_url: `/change-orders/${co.id}`,
          priority: "high",
        }));
        await supabaseAdmin.from("admin_notifications").insert(notifications);
      }

      return new Response(
        JSON.stringify({ success: true, action: "rejected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle approval/signing
    if (!signature) {
      return new Response(JSON.stringify({ error: "Signature required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const siteUrl = Deno.env.get("SITE_URL") || "https://commndx.lovable.app";

    if (isFieldSupervisor) {
      // Validate status
      if (co.status !== "pending_field_supervisor") {
        return new Response(
          JSON.stringify({ error: "This change order is not awaiting field supervisor approval" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Already signed?
      if (co.field_supervisor_signed_at) {
        return new Response(
          JSON.stringify({ error: "Already signed", already_signed: true }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Record signature, advance to pending_customer_pm
      await supabaseAdmin
        .from("change_orders")
        .update({
          field_supervisor_signature: signature,
          field_supervisor_signed_at: new Date().toISOString(),
          status: "pending_customer_pm",
        })
        .eq("id", co.id);

      await supabaseAdmin.from("change_order_approval_log").insert({
        change_order_id: co.id,
        action: "field_supervisor_signed",
        actor_name: signer_name || project.customer_field_supervisor_name || "Field Supervisor",
        actor_email: signer_email || project.customer_field_supervisor_email || "",
        notes: notes || null,
      });

      // Send approval email to Customer PM
      if (RESEND_API_KEY && project.customer_pm_email) {
        const pmApprovalLink = `${siteUrl}/approve-co/${co.customer_pm_approval_token}`;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Command X <notifications@commndx.lovable.app>",
            to: [project.customer_pm_email],
            subject: `Change Order ${co.number} - Your Approval Required - ${project.name}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                <h2>Change Order Approval Required</h2>
                <p>The field supervisor has reviewed and approved change order ${co.number} for ${project.name}. Your approval is now required.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0">
                  <tr><td style="padding:8px;font-weight:bold">CO Number:</td><td style="padding:8px">${co.number}</td></tr>
                  <tr><td style="padding:8px;font-weight:bold">Project:</td><td style="padding:8px">${project.name}</td></tr>
                  <tr><td style="padding:8px;font-weight:bold">Reason:</td><td style="padding:8px">${co.reason}</td></tr>
                  <tr><td style="padding:8px;font-weight:bold">Total:</td><td style="padding:8px;font-size:18px;font-weight:bold">$${co.total.toFixed(2)}</td></tr>
                  <tr><td style="padding:8px;font-weight:bold">Field Supervisor:</td><td style="padding:8px">✅ Approved by ${signer_name || project.customer_field_supervisor_name || 'Field Supervisor'}</td></tr>
                </table>
                <div style="text-align:center;margin:24px 0">
                  <a href="${pmApprovalLink}" style="display:inline-block;background:#2563eb;color:white;padding:12px 32px;text-decoration:none;border-radius:6px;font-weight:bold">Review & Sign</a>
                </div>
              </div>
            `,
          }),
        });
      }

      // Notify internal team
      const { data: profiles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "manager"]);

      if (profiles) {
        const notifications = profiles.map((p: any) => ({
          user_id: p.user_id,
          title: `CO ${co.number}: Field Supervisor signed`,
          message: `${signer_name || 'Field Supervisor'} has signed CO ${co.number} for ${project.name}. Awaiting Customer PM approval.`,
          notification_type: "change_order_progress",
          related_id: co.id,
          link_url: `/change-orders/${co.id}`,
          priority: "normal",
        }));
        await supabaseAdmin.from("admin_notifications").insert(notifications);
      }

      return new Response(
        JSON.stringify({ success: true, action: "field_supervisor_signed", next_step: "pending_customer_pm" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (isCustomerPM) {
      if (co.status !== "pending_customer_pm") {
        return new Response(
          JSON.stringify({ error: "This change order is not awaiting customer PM approval" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (co.customer_pm_signed_at) {
        return new Response(
          JSON.stringify({ error: "Already signed", already_signed: true }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Record signature, advance to approved_pending_wo
      await supabaseAdmin
        .from("change_orders")
        .update({
          customer_pm_signature: signature,
          customer_pm_signed_at: new Date().toISOString(),
          status: "approved_pending_wo",
        })
        .eq("id", co.id);

      await supabaseAdmin.from("change_order_approval_log").insert({
        change_order_id: co.id,
        action: "customer_pm_signed",
        actor_name: signer_name || project.customer_pm_name || "Customer PM",
        actor_email: signer_email || project.customer_pm_email || "",
        notes: notes || null,
      });

      // Notify internal team — both signatures complete
      const { data: profiles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "manager"]);

      if (profiles) {
        const notifications = profiles.map((p: any) => ({
          user_id: p.user_id,
          title: `CO ${co.number}: Both signatures received!`,
          message: `Both customer signatures received for CO ${co.number} (${project.name}). Upload the customer Work Order to authorize work. Total: $${co.total.toFixed(2)}`,
          notification_type: "change_order_signatures_complete",
          related_id: co.id,
          link_url: `/change-orders/${co.id}`,
          priority: "high",
        }));
        await supabaseAdmin.from("admin_notifications").insert(notifications);
      }

      return new Response(
        JSON.stringify({ success: true, action: "customer_pm_signed", next_step: "approved_pending_wo" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid token" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
