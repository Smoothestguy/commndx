import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Helper to get valid access token
async function getValidToken(supabase: any) {
  const { data: config, error } = await supabase
    .from('quickbooks_config')
    .select('*')
    .eq('is_connected', true)
    .single();

  if (error || !config) {
    throw new Error('QuickBooks not connected');
  }

  const tokenExpires = new Date(config.token_expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (tokenExpires < fiveMinutesFromNow) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/quickbooks-oauth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ action: 'refresh-token' }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const { access_token, realm_id } = await response.json();
    return { accessToken: access_token, realmId: realm_id };
  }

  return { accessToken: config.access_token, realmId: config.realm_id };
}

// QuickBooks API helper
async function qbRequest(method: string, endpoint: string, accessToken: string, realmId: string, body?: any) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}${endpoint}`;
  
  const options: RequestInit = {
    method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`QuickBooks API error: ${errorText}`);
    throw new Error(`QuickBooks API error: ${response.status}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoiceId } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { accessToken, realmId } = await getValidToken(supabase);

    console.log(`Creating QuickBooks invoice for invoice ID: ${invoiceId}`);

    // Get the invoice with line items
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError) throw invoiceError;

    // Get line items
    const { data: lineItems, error: lineItemsError } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId);

    if (lineItemsError) throw lineItemsError;

    // Check if already synced
    const { data: existingMapping } = await supabase
      .from('quickbooks_invoice_mappings')
      .select('*')
      .eq('invoice_id', invoiceId)
      .single();

    if (existingMapping) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Invoice already synced',
        quickbooksInvoiceId: existingMapping.quickbooks_invoice_id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get or create QB customer
    const customerResponse = await fetch(`${SUPABASE_URL}/functions/v1/quickbooks-sync-customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ 
        action: 'find-or-create', 
        customerId: invoice.customer_id 
      }),
    });

    if (!customerResponse.ok) {
      throw new Error('Failed to get/create QuickBooks customer');
    }

    const { quickbooksCustomerId } = await customerResponse.json();

    // Build QB invoice line items
    const qbLineItems = [];

    for (const item of lineItems) {
      // QuickBooks requires Amount = Qty × UnitPrice
      // Since our total may include markup, calculate the effective unit price
      const effectiveUnitPrice = item.quantity !== 0 
        ? Math.round((item.total / item.quantity) * 100) / 100 
        : item.unit_price;
      const qbAmount = Math.round(effectiveUnitPrice * item.quantity * 100) / 100;
      
      qbLineItems.push({
        DetailType: 'SalesItemLineDetail',
        Amount: qbAmount,
        Description: item.description,
        SalesItemLineDetail: {
          Qty: item.quantity,
          UnitPrice: effectiveUnitPrice,
        },
      });
    }

    // Add tax as a separate line item so QuickBooks includes it in the total
    if (invoice.tax_amount > 0) {
      qbLineItems.push({
        DetailType: 'SalesItemLineDetail',
        Amount: invoice.tax_amount,
        Description: 'Sales Tax',
        SalesItemLineDetail: {
          Qty: 1,
          UnitPrice: invoice.tax_amount,
        },
      });
    }

    // Create QB invoice
    const qbInvoice = {
      CustomerRef: { value: quickbooksCustomerId },
      Line: qbLineItems,
      DueDate: invoice.due_date,
      DocNumber: invoice.number,
      PrivateNote: `CommandX Invoice: ${invoice.number}`,
    };

    console.log('Creating invoice in QuickBooks:', JSON.stringify(qbInvoice, null, 2));

    const result = await qbRequest('POST', '/invoice?minorversion=65', accessToken, realmId, qbInvoice);

    // Create mapping
    await supabase
      .from('quickbooks_invoice_mappings')
      .insert({
        invoice_id: invoiceId,
        quickbooks_invoice_id: result.Invoice.Id,
        quickbooks_doc_number: result.Invoice.DocNumber,
        sync_status: 'synced',
        synced_at: new Date().toISOString(),
      });

    // Log the sync
    await supabase.from('quickbooks_sync_log').insert({
      entity_type: 'invoice',
      entity_id: invoiceId,
      quickbooks_id: result.Invoice.Id,
      action: 'create',
      status: 'success',
      details: { doc_number: result.Invoice.DocNumber },
    });

    console.log(`Invoice created in QuickBooks with ID: ${result.Invoice.Id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      quickbooksInvoiceId: result.Invoice.Id,
      quickbooksDocNumber: result.Invoice.DocNumber,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('QuickBooks invoice creation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log the error
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from('quickbooks_sync_log').insert({
      entity_type: 'invoice',
      action: 'create',
      status: 'failed',
      error_message: errorMessage,
    });

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
