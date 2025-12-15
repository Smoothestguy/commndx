import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const siteUrl = Deno.env.get("SITE_URL") || "https://lovable.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  addendumId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { addendumId }: RequestBody = await req.json();

    console.log("Sending change order approval for addendum:", addendumId);

    const { data: addendum, error: addendumError } = await supabase
      .from("po_addendums")
      .select(`*, purchase_orders:purchase_order_id (number, vendor_id, vendors:vendor_id (name))`)
      .eq("id", addendumId)
      .single();

    if (addendumError || !addendum) {
      return new Response(JSON.stringify({ error: "Addendum not found" }), 
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!addendum.customer_rep_email) {
      return new Response(JSON.stringify({ error: "No customer email" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let approvalToken = addendum.approval_token || crypto.randomUUID();
    await supabase.from("po_addendums").update({ 
      approval_token: approvalToken, approval_status: 'pending', sent_for_approval_at: new Date().toISOString() 
    }).eq("id", addendumId);

    const { data: lineItems } = await supabase
      .from("po_addendum_line_items").select("*").eq("po_addendum_id", addendumId).order("sort_order");

    const approvalUrl = `${siteUrl}/approve-change-order/${approvalToken}`;
    const lineItemsHtml = lineItems?.map((item: any) => `
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.description}</td>
      <td style="padding:8px;text-align:right;">${item.quantity}</td>
      <td style="padding:8px;text-align:right;">$${item.unit_price.toFixed(2)}</td>
      <td style="padding:8px;text-align:right;">$${item.total.toFixed(2)}</td></tr>
    `).join('') || '';

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "Fairfield <admin@fairfieldrg.com>",
        to: [addendum.customer_rep_email],
        subject: `Change Order ${addendum.number} Requires Your Approval`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h1 style="color:#1d4ed8;">Change Order Approval Required</h1>
          <p>Dear ${addendum.customer_rep_name || 'Customer'},</p>
          <p>Change order <strong>${addendum.number}</strong> for PO <strong>${addendum.purchase_orders?.number || 'N/A'}</strong> requires your approval.</p>
          <p><strong>Description:</strong> ${addendum.description}</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <thead><tr style="background:#f3f4f6;"><th style="padding:10px;text-align:left;">Description</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Total</th></tr></thead>
            <tbody>${lineItemsHtml}</tbody>
            <tfoot><tr><td colspan="3" style="padding:12px;text-align:right;font-weight:bold;">Total:</td><td style="text-align:right;font-weight:bold;color:#2563eb;">$${addendum.amount.toFixed(2)}</td></tr></tfoot>
          </table>
          <a href="${approvalUrl}" style="display:inline-block;background:#1d4ed8;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Review & Sign</a>
        </div>`,
      }),
    });

    const emailResponse = await res.json();
    console.log("Email sent:", emailResponse);

    return new Response(JSON.stringify({ success: true }), 
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
};

serve(handler);