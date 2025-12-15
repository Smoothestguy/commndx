import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendEstimateRequest {
  estimateId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { estimateId }: SendEstimateRequest = await req.json();

    console.log("Sending estimate:", estimateId);

    // Fetch estimate with customer details
    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select(`
        *,
        customers!inner(email, name)
      `)
      .eq("id", estimateId)
      .single();

    if (estimateError || !estimate) {
      console.error("Error fetching estimate:", estimateError);
      return new Response(
        JSON.stringify({ error: "Estimate not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch line items
    const { data: lineItems, error: lineItemsError } = await supabase
      .from("estimate_line_items")
      .select("*")
      .eq("estimate_id", estimateId)
      .order("created_at");

    if (lineItemsError) {
      console.error("Error fetching line items:", lineItemsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch line items" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique approval token
    const approvalToken = crypto.randomUUID();
    const SITE_URL = Deno.env.get("SITE_URL");
    // Remove trailing slash if present to avoid double slashes in URL
    const baseUrl = (SITE_URL || req.headers.get("origin") || "").replace(/\/$/, "");
    const approvalUrl = `${baseUrl}/approve-estimate/${approvalToken}`;

    // Build line items HTML
    const lineItemsHtml = lineItems
      ?.map(
        (item) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${Number(item.unit_price).toFixed(2)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">$${Number(item.total).toFixed(2)}</td>
        </tr>
      `
      )
      .join("");

    // Send email
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Fairfield <admin@fairfieldrg.com>",
        to: [estimate.customers.email],
        subject: `Estimate ${estimate.number} - ${estimate.project_name || "Your Project"}`,
        html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f9fafb;">
            <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
              
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">New Estimate</h1>
                <p style="color: #e0e7ff; margin: 8px 0 0 0; font-size: 16px;">Estimate #${estimate.number}</p>
              </div>

              <!-- Content -->
              <div style="padding: 32px;">
                <p style="font-size: 16px; margin-bottom: 24px;">Dear ${estimate.customers.name},</p>
                
                <p style="font-size: 16px; margin-bottom: 24px;">We're pleased to send you the following estimate for your project${estimate.project_name ? `: <strong>${estimate.project_name}</strong>` : ''}.</p>

                <!-- Estimate Details -->
                <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
                  <table style="width: 100%; font-size: 14px;">
                    <tr>
                      <td style="padding: 4px 0; color: #6b7280;">Estimate Date:</td>
                      <td style="padding: 4px 0; text-align: right; font-weight: 600;">${new Date(estimate.created_at).toLocaleDateString()}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #6b7280;">Valid Until:</td>
                      <td style="padding: 4px 0; text-align: right; font-weight: 600;">${new Date(estimate.valid_until).toLocaleDateString()}</td>
                    </tr>
                  </table>
                </div>

                <!-- Line Items -->
                <h2 style="font-size: 18px; font-weight: 600; margin: 24px 0 16px 0; color: #111827;">Estimate Details</h2>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
                  <thead>
                    <tr style="background-color: #f9fafb;">
                      <th style="padding: 12px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Description</th>
                      <th style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Qty</th>
                      <th style="padding: 12px; text-align: right; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Unit Price</th>
                      <th style="padding: 12px; text-align: right; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${lineItemsHtml}
                  </tbody>
                </table>

                <!-- Totals -->
                <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px; margin-bottom: 32px;">
                  <table style="width: 100%; font-size: 14px;">
                    <tr>
                      <td style="padding: 4px 0; color: #6b7280;">Subtotal:</td>
                      <td style="padding: 4px 0; text-align: right; font-weight: 600;">$${Number(estimate.subtotal).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #6b7280;">Tax (${Number(estimate.tax_rate).toFixed(1)}%):</td>
                      <td style="padding: 4px 0; text-align: right; font-weight: 600;">$${Number(estimate.tax_amount).toFixed(2)}</td>
                    </tr>
                    <tr style="border-top: 2px solid #e5e7eb;">
                      <td style="padding: 12px 0 0 0; font-size: 18px; font-weight: 700; color: #111827;">Total:</td>
                      <td style="padding: 12px 0 0 0; text-align: right; font-size: 18px; font-weight: 700; color: #667eea;">$${Number(estimate.total).toFixed(2)}</td>
                    </tr>
                  </table>
                </div>

                ${estimate.notes ? `
                  <div style="margin-bottom: 32px;">
                    <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 8px 0; color: #111827;">Notes:</h3>
                    <p style="font-size: 14px; color: #6b7280; margin: 0; white-space: pre-wrap;">${estimate.notes}</p>
                  </div>
                ` : ''}

                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${approvalUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    View & Approve Estimate
                  </a>
                </div>

                <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 24px;">
                  This estimate is valid until ${new Date(estimate.valid_until).toLocaleDateString()}
                </p>
              </div>

              <!-- Footer -->
              <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 14px; color: #6b7280; margin: 0;">
                  Questions? Reply to this email or contact us directly.
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Resend API error:", JSON.stringify(errorData, null, 2));
      throw new Error(JSON.stringify(errorData));
    }

    const emailData = await emailResponse.json();
    console.log("Email sent successfully:", emailData);

    // Update estimate with token and sent_at
    const { error: updateError } = await supabase
      .from("estimates")
      .update({
        approval_token: approvalToken,
        sent_at: new Date().toISOString(),
        status: "sent",
      })
      .eq("id", estimateId);

    if (updateError) {
      console.error("Error updating estimate:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update estimate" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        approvalUrl,
        message: "Estimate sent successfully" 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-estimate function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
