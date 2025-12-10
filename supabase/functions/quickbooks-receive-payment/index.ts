import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { paymentId } = await req.json();
    
    if (!paymentId) {
      throw new Error("Payment ID is required");
    }

    console.log(`Processing QuickBooks payment sync for payment: ${paymentId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the payment with invoice details
    const { data: payment, error: paymentError } = await supabase
      .from("invoice_payments")
      .select(`
        *,
        invoices (
          id,
          number,
          customer_id,
          customer_name,
          total
        )
      `)
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      throw new Error(`Payment not found: ${paymentError?.message}`);
    }

    console.log("Payment data:", JSON.stringify(payment, null, 2));

    // Check if QuickBooks is connected
    const { data: qbConfig, error: configError } = await supabase
      .from("quickbooks_config")
      .select("*")
      .single();

    if (configError || !qbConfig?.is_connected) {
      console.log("QuickBooks not connected, skipping sync");
      return new Response(
        JSON.stringify({ success: true, message: "QuickBooks not connected, skipping sync" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token needs refresh
    const now = new Date();
    const tokenExpiry = new Date(qbConfig.token_expires_at);
    
    let accessToken = qbConfig.access_token;
    
    if (now >= tokenExpiry) {
      console.log("Refreshing QuickBooks access token...");
      
      const clientId = Deno.env.get("QUICKBOOKS_CLIENT_ID");
      const clientSecret = Deno.env.get("QUICKBOOKS_CLIENT_SECRET");
      
      const refreshResponse = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: qbConfig.refresh_token,
        }),
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        throw new Error(`Failed to refresh token: ${errorText}`);
      }

      const tokenData = await refreshResponse.json();
      accessToken = tokenData.access_token;

      // Update stored tokens
      await supabase
        .from("quickbooks_config")
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        })
        .eq("id", qbConfig.id);
    }

    // Get QuickBooks customer mapping
    const { data: customerMapping } = await supabase
      .from("quickbooks_customer_mappings")
      .select("quickbooks_id")
      .eq("customer_id", payment.invoices.customer_id)
      .single();

    if (!customerMapping?.quickbooks_id) {
      console.log("Customer not synced to QuickBooks, skipping payment sync");
      return new Response(
        JSON.stringify({ success: true, message: "Customer not synced to QuickBooks" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get QuickBooks invoice mapping
    const { data: invoiceMapping } = await supabase
      .from("quickbooks_invoice_mappings")
      .select("quickbooks_id")
      .eq("invoice_id", payment.invoice_id)
      .single();

    if (!invoiceMapping?.quickbooks_id) {
      console.log("Invoice not synced to QuickBooks, skipping payment sync");
      return new Response(
        JSON.stringify({ success: true, message: "Invoice not synced to QuickBooks" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create payment in QuickBooks
    const qbPayment = {
      CustomerRef: {
        value: customerMapping.quickbooks_id,
      },
      TotalAmt: payment.amount,
      Line: [
        {
          Amount: payment.amount,
          LinkedTxn: [
            {
              TxnId: invoiceMapping.quickbooks_id,
              TxnType: "Invoice",
            },
          ],
        },
      ],
      PaymentMethodRef: {
        value: getQBPaymentMethodId(payment.payment_method),
      },
      TxnDate: payment.payment_date,
      PrivateNote: payment.notes || `Payment for Invoice ${payment.invoices.number}`,
      PaymentRefNum: payment.reference_number || undefined,
    };

    console.log("Creating QuickBooks payment:", JSON.stringify(qbPayment, null, 2));

    const baseUrl = qbConfig.sandbox_mode
      ? "https://sandbox-quickbooks.api.intuit.com"
      : "https://quickbooks.api.intuit.com";

    const qbResponse = await fetch(
      `${baseUrl}/v3/company/${qbConfig.realm_id}/payment?minorversion=65`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(qbPayment),
      }
    );

    if (!qbResponse.ok) {
      const errorText = await qbResponse.text();
      console.error("QuickBooks API error:", errorText);
      
      // Log the error but don't fail
      await supabase.from("quickbooks_sync_logs").insert({
        entity_type: "invoice_payment",
        entity_id: paymentId,
        action: "create",
        status: "error",
        error_message: errorText,
      });
      
      throw new Error(`QuickBooks API error: ${errorText}`);
    }

    const qbResult = await qbResponse.json();
    console.log("QuickBooks payment created:", qbResult.Payment.Id);

    // Store the QuickBooks payment ID
    await supabase
      .from("invoice_payments")
      .update({ quickbooks_payment_id: qbResult.Payment.Id })
      .eq("id", paymentId);

    // Log successful sync
    await supabase.from("quickbooks_sync_logs").insert({
      entity_type: "invoice_payment",
      entity_id: paymentId,
      action: "create",
      status: "success",
      quickbooks_id: qbResult.Payment.Id,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        quickbooks_payment_id: qbResult.Payment.Id 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error syncing payment to QuickBooks:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

function getQBPaymentMethodId(method: string): string {
  // Default payment method mappings - these may need to be customized
  const methodMap: Record<string, string> = {
    "Check": "2",
    "Cash": "1",
    "Credit Card": "3",
    "ACH": "4",
    "Wire Transfer": "5",
    "Other": "6",
  };
  return methodMap[method] || "1";
}