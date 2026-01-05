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

    console.log(`Processing QuickBooks bill payment sync for payment: ${paymentId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the payment with bill details
    const { data: payment, error: paymentError } = await supabase
      .from("vendor_bill_payments")
      .select(`
        *,
        vendor_bills (
          id,
          number,
          vendor_id,
          vendor_name,
          total
        )
      `)
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      throw new Error(`Payment not found: ${paymentError?.message}`);
    }

    console.log("Bill payment data:", JSON.stringify(payment, null, 2));

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

    // Get QuickBooks vendor mapping
    const { data: vendorMapping } = await supabase
      .from("quickbooks_vendor_mappings")
      .select("quickbooks_vendor_id")
      .eq("vendor_id", payment.vendor_bills.vendor_id)
      .single();

    if (!vendorMapping?.quickbooks_vendor_id) {
      console.log("Vendor not synced to QuickBooks, skipping payment sync");
      return new Response(
        JSON.stringify({ success: true, message: "Vendor not synced to QuickBooks" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get QuickBooks bill mapping
    const { data: billMapping } = await supabase
      .from("quickbooks_bill_mappings")
      .select("quickbooks_bill_id")
      .eq("bill_id", payment.bill_id)
      .single();

    if (!billMapping?.quickbooks_bill_id) {
      console.log("Bill not synced to QuickBooks, skipping payment sync");
      return new Response(
        JSON.stringify({ success: true, message: "Bill not synced to QuickBooks" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First, get a valid AP account (required for BillPayment)
    const baseUrl = qbConfig.sandbox_mode
      ? "https://sandbox-quickbooks.api.intuit.com"
      : "https://quickbooks.api.intuit.com";

    // Query for Accounts Payable account
    const apQuery = encodeURIComponent("SELECT * FROM Account WHERE AccountType = 'Accounts Payable' MAXRESULTS 1");
    const apResponse = await fetch(
      `${baseUrl}/v3/company/${qbConfig.realm_id}/query?query=${apQuery}&minorversion=65`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
      }
    );

    if (!apResponse.ok) {
      const errorText = await apResponse.text();
      console.error("Failed to fetch AP account:", errorText);
      throw new Error("Failed to fetch AP account from QuickBooks");
    }

    const apData = await apResponse.json();
    const apAccount = apData.QueryResponse?.Account?.[0];
    
    if (!apAccount) {
      throw new Error("No Accounts Payable account found in QuickBooks");
    }

    console.log("Found AP Account:", apAccount.Id, apAccount.Name);

    // Query for Bank account
    const bankQuery = encodeURIComponent("SELECT * FROM Account WHERE AccountType = 'Bank' MAXRESULTS 1");
    const bankResponse = await fetch(
      `${baseUrl}/v3/company/${qbConfig.realm_id}/query?query=${bankQuery}&minorversion=65`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
      }
    );

    let bankAccount = null;
    if (bankResponse.ok) {
      const bankData = await bankResponse.json();
      bankAccount = bankData.QueryResponse?.Account?.[0];
      console.log("Found Bank Account:", bankAccount?.Id, bankAccount?.Name);
    }

    // Create BillPayment in QuickBooks
    const qbBillPayment: Record<string, unknown> = {
      VendorRef: {
        value: vendorMapping.quickbooks_vendor_id,
      },
      PayType: "Check", // QuickBooks requires Check or CreditCard
      TotalAmt: payment.amount,
      Line: [
        {
          Amount: payment.amount,
          LinkedTxn: [
            {
              TxnId: billMapping.quickbooks_bill_id,
              TxnType: "Bill",
            },
          ],
        },
      ],
      TxnDate: payment.payment_date,
      PrivateNote: payment.notes || `Payment for Bill ${payment.vendor_bills.number}`,
    };

    // Add CheckPayment or CreditCardPayment based on method
    if (payment.payment_method === "Credit Card") {
      qbBillPayment.PayType = "CreditCard";
      if (bankAccount) {
        qbBillPayment.CreditCardPayment = {
          CCAccountRef: {
            value: bankAccount.Id,
          },
        };
      }
    } else {
      qbBillPayment.PayType = "Check";
      if (bankAccount) {
        qbBillPayment.CheckPayment = {
          BankAccountRef: {
            value: bankAccount.Id,
          },
        };
      }
      if (payment.reference_number) {
        qbBillPayment.DocNumber = payment.reference_number;
      }
    }

    console.log("Creating QuickBooks BillPayment:", JSON.stringify(qbBillPayment, null, 2));

    const qbResponse = await fetch(
      `${baseUrl}/v3/company/${qbConfig.realm_id}/billpayment?minorversion=65`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(qbBillPayment),
      }
    );

    if (!qbResponse.ok) {
      const errorText = await qbResponse.text();
      console.error("QuickBooks API error:", errorText);
      
      // Log the error but don't fail
      await supabase.from("quickbooks_sync_log").insert({
        entity_type: "vendor_bill_payment",
        entity_id: paymentId,
        action: "create",
        status: "error",
        details: { error: errorText },
      });
      
      throw new Error(`QuickBooks API error: ${errorText}`);
    }

    const qbResult = await qbResponse.json();
    console.log("QuickBooks BillPayment created:", qbResult.BillPayment.Id);

    // Store the QuickBooks payment ID
    await supabase
      .from("vendor_bill_payments")
      .update({ quickbooks_payment_id: qbResult.BillPayment.Id })
      .eq("id", paymentId);

    // Log successful sync
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "vendor_bill_payment",
      entity_id: paymentId,
      quickbooks_id: qbResult.BillPayment.Id,
      action: "create",
      status: "success",
      details: { bill_number: payment.vendor_bills.number },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        quickbooks_payment_id: qbResult.BillPayment.Id 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error syncing bill payment to QuickBooks:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
