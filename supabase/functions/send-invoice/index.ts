import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendInvoiceRequest {
  invoiceId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { invoiceId }: SendInvoiceRequest = await req.json();
    console.log("Sending invoice:", invoiceId);

    // Fetch invoice with line items
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .select(`
        *,
        line_items:invoice_line_items(*)
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      console.error("Error fetching invoice:", invoiceError);
      throw new Error("Invoice not found");
    }

    // Fetch customer email
    const { data: customer, error: customerError } = await supabaseClient
      .from("customers")
      .select("email, name")
      .eq("id", invoice.customer_id)
      .single();

    if (customerError || !customer) {
      console.error("Error fetching customer:", customerError);
      throw new Error("Customer not found");
    }

    // Build line items HTML
    const lineItemsHtml = invoice.line_items
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
      to: [customer.email],
      subject: `Invoice ${invoice.number} from Fairfield`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Invoice ${invoice.number}</h1>
            </div>
            
            <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <div style="margin-bottom: 30px;">
                <p style="margin: 5px 0;"><strong>To:</strong> ${customer.name}</p>
                <p style="margin: 5px 0;"><strong>Invoice Date:</strong> ${new Date(invoice.created_at).toLocaleDateString()}</p>
                <p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
                ${invoice.project_name ? `<p style="margin: 5px 0;"><strong>Project:</strong> ${invoice.project_name}</p>` : ''}
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
                    <td style="text-align: right; padding: 8px 0;">$${invoice.subtotal.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Tax (${invoice.tax_rate}%):</strong></td>
                    <td style="text-align: right; padding: 8px 0;">$${invoice.tax_amount.toFixed(2)}</td>
                  </tr>
                  <tr style="font-size: 18px; font-weight: bold; border-top: 2px solid #e5e7eb;">
                    <td style="padding: 12px 0;">Total:</td>
                    <td style="text-align: right; padding: 12px 0; color: #667eea;">$${invoice.total.toFixed(2)}</td>
                  </tr>
                </table>
              </div>

              <div style="margin-top: 40px; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
                <h3 style="margin-top: 0; color: #374151;">Payment Instructions</h3>
                <p style="margin: 5px 0;">Please make payment by ${new Date(invoice.due_date).toLocaleDateString()}.</p>
                <p style="margin: 5px 0;">Thank you for your business!</p>
              </div>
            </div>

            <div style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px;">
              <p>Fairfield - Project Management System</p>
            </div>
          </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      console.error("Resend error:", emailResponse.error);
      throw new Error(emailResponse.error.message || "Failed to send email");
    }

    console.log("Email sent successfully:", emailResponse.data);

    // Update invoice status to "sent"
    const { error: updateError } = await supabaseClient
      .from("invoices")
      .update({ status: "sent" })
      .eq("id", invoiceId);

    if (updateError) {
      console.error("Error updating invoice status:", updateError);
    }

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invoice function:", error);
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
