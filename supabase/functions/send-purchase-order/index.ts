import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendPurchaseOrderRequest {
  purchaseOrderId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the current user from the auth header
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { purchaseOrderId }: SendPurchaseOrderRequest = await req.json();
    console.log("Sending purchase order:", purchaseOrderId);

    // Fetch PO with line items
    const { data: po, error: poError } = await supabaseClient
      .from("purchase_orders")
      .select("*")
      .eq("id", purchaseOrderId)
      .single();

    if (poError || !po) {
      console.error("Error fetching purchase order:", poError);
      throw new Error("Purchase order not found");
    }

    // Check if user is admin or if PO has been approved (status = draft after approval)
    const { data: userRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const isAdmin = userRole?.role === 'admin';
    const isApproved = po.status === 'draft' && po.approved_by;

    if (!isAdmin && !isApproved) {
      throw new Error('Purchase order must be approved before sending. Current status: ' + po.status);
    }

    // Fetch line items
    const { data: lineItems, error: lineItemsError } = await supabaseClient
      .from("po_line_items")
      .select("*")
      .eq("purchase_order_id", purchaseOrderId);

    if (lineItemsError) {
      console.error("Error fetching line items:", lineItemsError);
      throw new Error("Line items not found");
    }

    // Fetch vendor email
    const { data: vendor, error: vendorError } = await supabaseClient
      .from("vendors")
      .select("email, name")
      .eq("id", po.vendor_id)
      .single();

    if (vendorError || !vendor) {
      console.error("Error fetching vendor:", vendorError);
      throw new Error("Vendor not found");
    }

    // Build line items HTML
    const lineItemsHtml = lineItems
      .map(
        (item: any) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.unit_price.toFixed(2)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.total.toFixed(2)}</td>
        </tr>
      `
      )
      .join("");

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Fairfield <admin@fairfieldrg.com>",
      to: [vendor.email],
      subject: `Purchase Order ${po.number} from Fairfield`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Purchase Order ${po.number}</h1>
            </div>
            
            <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <div style="margin-bottom: 30px;">
                <p style="margin: 5px 0;"><strong>To:</strong> ${vendor.name}</p>
                <p style="margin: 5px 0;"><strong>Job Order:</strong> ${po.job_order_number}</p>
                <p style="margin: 5px 0;"><strong>Project:</strong> ${po.project_name}</p>
                <p style="margin: 5px 0;"><strong>Customer:</strong> ${po.customer_name}</p>
                <p style="margin: 5px 0;"><strong>PO Date:</strong> ${new Date(po.created_at).toLocaleDateString()}</p>
                <p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(po.due_date).toLocaleDateString()}</p>
              </div>

              <table style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Description</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Unit Price</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${lineItemsHtml}
                </tbody>
              </table>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
                <table style="width: 100%; max-width: 300px; margin-left: auto;">
                  <tr>
                    <td style="padding: 8px 0;"><strong>Subtotal:</strong></td>
                    <td style="text-align: right; padding: 8px 0;">$${po.subtotal.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Tax (${po.tax_rate}%):</strong></td>
                    <td style="text-align: right; padding: 8px 0;">$${po.tax_amount.toFixed(2)}</td>
                  </tr>
                  <tr style="font-size: 18px; font-weight: bold; border-top: 2px solid #e5e7eb;">
                    <td style="padding: 12px 0;">Total:</td>
                    <td style="text-align: right; padding: 12px 0; color: #667eea;">$${po.total.toFixed(2)}</td>
                  </tr>
                </table>
              </div>

              ${po.notes ? `
              <div style="margin-top: 30px; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
                <h3 style="margin-top: 0; color: #374151;">Notes</h3>
                <p style="margin: 5px 0;">${po.notes}</p>
              </div>
              ` : ''}

              <div style="margin-top: 40px; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
                <h3 style="margin-top: 0; color: #374151;">Delivery Instructions</h3>
                <p style="margin: 5px 0;">Please confirm receipt and provide delivery timeline.</p>
                <p style="margin: 5px 0;">Contact us if you have any questions.</p>
              </div>
            </div>

            <div style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px;">
              <p>Fairfield - Project Management System</p>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    // Update PO status to "sent"
    const oldStatus = po.status;
    const { error: updateError } = await supabaseClient
      .from("purchase_orders")
      .update({ status: "sent" })
      .eq("id", purchaseOrderId);

    if (updateError) {
      console.error("Error updating PO status:", updateError);
    }

    // Trigger notification about the status change
    try {
      await supabaseClient.functions.invoke('notify-po-status-change', {
        body: {
          purchaseOrderId,
          newStatus: 'sent',
          oldStatus,
        },
      });
    } catch (notifyError) {
      console.error('Error sending notification:', notifyError);
      // Don't fail the send if notification fails
    }

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-purchase-order function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);