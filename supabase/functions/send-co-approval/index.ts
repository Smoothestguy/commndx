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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const { change_order_id } = await req.json();

    if (!change_order_id) {
      return new Response(JSON.stringify({ error: "change_order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get change order with project info
    const { data: co, error: coError } = await supabaseAdmin
      .from("change_orders")
      .select("*, project:projects(id, name, customer_field_supervisor_name, customer_field_supervisor_email, customer_pm_name, customer_pm_email, our_field_superintendent_id)")
      .eq("id", change_order_id)
      .single();

    if (coError || !co) {
      return new Response(JSON.stringify({ error: "Change order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (co.status !== "draft") {
      return new Response(JSON.stringify({ error: "Change order must be in draft status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const project = co.project as any;
    if (!project?.customer_field_supervisor_email) {
      return new Response(
        JSON.stringify({ error: "Project must have a Customer Field Supervisor email configured before submitting for approval" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate approval tokens
    const fieldSupervisorToken = crypto.randomUUID();
    const customerPmToken = crypto.randomUUID();

    // Update CO with tokens and status
    const { error: updateError } = await supabaseAdmin
      .from("change_orders")
      .update({
        status: "pending_field_supervisor",
        field_supervisor_approval_token: fieldSupervisorToken,
        customer_pm_approval_token: customerPmToken,
        sent_for_approval_at: new Date().toISOString(),
      })
      .eq("id", change_order_id);

    if (updateError) throw updateError;

    // Log the action
    await supabaseAdmin.from("change_order_approval_log").insert({
      change_order_id,
      action: "submitted",
      actor_name: claimsData.claims.email || "Unknown",
      actor_email: claimsData.claims.email || "",
      notes: "Change order submitted for approval",
    });

    // Get line items for the email
    const { data: lineItems } = await supabaseAdmin
      .from("change_order_line_items")
      .select("*")
      .eq("change_order_id", change_order_id)
      .order("sort_order");

    const siteUrl = Deno.env.get("SITE_URL") || "https://commndx.lovable.app";
    const approvalLink = `${siteUrl}/approve-co/${fieldSupervisorToken}`;

    // Build line items HTML
    const lineItemsHtml = (lineItems || [])
      .map(
        (item: any) =>
          `<tr><td style="padding:8px;border:1px solid #e5e7eb">${item.description}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right">${item.quantity}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right">$${item.unit_price.toFixed(2)}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right">$${item.total.toFixed(2)}</td></tr>`
      )
      .join("");

    // Send email to field supervisor
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      // Email to Field Supervisor (with approval link)
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Command X <notifications@commndx.lovable.app>",
          to: [project.customer_field_supervisor_email],
          subject: `Change Order ${co.number} - Review & Approve - ${project.name}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
              <h2>Change Order Approval Required</h2>
              <p>A change order has been submitted for your review and approval.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <tr><td style="padding:8px;font-weight:bold">CO Number:</td><td style="padding:8px">${co.number}</td></tr>
                <tr><td style="padding:8px;font-weight:bold">Project:</td><td style="padding:8px">${project.name}</td></tr>
                <tr><td style="padding:8px;font-weight:bold">Reason:</td><td style="padding:8px">${co.reason}</td></tr>
                <tr><td style="padding:8px;font-weight:bold">Type:</td><td style="padding:8px">${co.change_type === 'deductive' ? 'Deductive (Credit)' : 'Additive'}</td></tr>
                <tr><td style="padding:8px;font-weight:bold">Total:</td><td style="padding:8px;font-size:18px;font-weight:bold">$${co.total.toFixed(2)}</td></tr>
              </table>
              <h3>Line Items</h3>
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <thead><tr style="background:#f3f4f6"><th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Description</th><th style="padding:8px;border:1px solid #e5e7eb;text-align:right">Qty</th><th style="padding:8px;border:1px solid #e5e7eb;text-align:right">Price</th><th style="padding:8px;border:1px solid #e5e7eb;text-align:right">Total</th></tr></thead>
                <tbody>${lineItemsHtml}</tbody>
                <tfoot><tr style="background:#f3f4f6"><td colspan="3" style="padding:8px;border:1px solid #e5e7eb;text-align:right;font-weight:bold">Total:</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right;font-weight:bold">$${co.total.toFixed(2)}</td></tr></tfoot>
              </table>
              <div style="text-align:center;margin:24px 0">
                <a href="${approvalLink}" style="display:inline-block;background:#2563eb;color:white;padding:12px 32px;text-decoration:none;border-radius:6px;font-weight:bold">Review & Sign</a>
              </div>
              <p style="color:#6b7280;font-size:12px">This is an automated message. Please click the button above to review and electronically sign this change order.</p>
            </div>
          `,
        }),
      });

      // FYI email to Customer PM
      if (project.customer_pm_email) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Command X <notifications@commndx.lovable.app>",
            to: [project.customer_pm_email],
            subject: `FYI: Change Order ${co.number} Submitted - ${project.name}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                <h2>Change Order Submitted</h2>
                <p>A change order has been submitted for ${project.name}. It is currently awaiting field supervisor approval. You will receive an approval request once the field supervisor has signed.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0">
                  <tr><td style="padding:8px;font-weight:bold">CO Number:</td><td style="padding:8px">${co.number}</td></tr>
                  <tr><td style="padding:8px;font-weight:bold">Reason:</td><td style="padding:8px">${co.reason}</td></tr>
                  <tr><td style="padding:8px;font-weight:bold">Total:</td><td style="padding:8px">$${co.total.toFixed(2)}</td></tr>
                </table>
                <p style="color:#6b7280;font-size:12px">No action is required from you at this time.</p>
              </div>
            `,
          }),
        });
      }
    }

    // Create in-app notification for internal team
    const { data: profiles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "manager"]);

    if (profiles) {
      const notifications = profiles.map((p: any) => ({
        user_id: p.user_id,
        title: `CO ${co.number} submitted for approval`,
        message: `Change order ${co.number} for ${project.name} has been submitted for customer approval. Total: $${co.total.toFixed(2)}`,
        notification_type: "change_order_submitted",
        related_id: change_order_id,
        link_url: `/change-orders/${change_order_id}`,
        priority: "high",
      }));

      await supabaseAdmin.from("admin_notifications").insert(notifications);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Change order submitted for approval" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
