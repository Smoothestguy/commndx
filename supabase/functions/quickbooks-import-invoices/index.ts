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
async function qbRequest(method: string, endpoint: string, accessToken: string, realmId: string, body?: any): Promise<any> {
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
  const responseText = await response.text();
  
  if (!response.ok) {
    console.error(`QuickBooks API error: ${responseText}`);
    throw new Error(`QuickBooks API error: ${response.status}`);
  }

  return responseText ? JSON.parse(responseText) : {};
}

// Generate next invoice number
async function generateInvoiceNumber(supabase: any): Promise<string> {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  
  const { data: lastInvoice } = await supabase
    .from('invoices')
    .select('number')
    .like('number', `INV-${currentYear}%`)
    .order('number', { ascending: false })
    .limit(1)
    .single();

  let nextSeq = 1;
  if (lastInvoice?.number) {
    const match = lastInvoice.number.match(/INV-\d{2}(\d{5})/);
    if (match) {
      nextSeq = parseInt(match[1], 10) + 1;
    }
  }

  return `INV-${currentYear}${nextSeq.toString().padStart(5, '0')}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { accessToken, realmId } = await getValidToken(supabase);

    if (action === 'import') {
      console.log('Importing invoices from QuickBooks...');
      
      // Query all invoices from QuickBooks
      const query = "SELECT * FROM Invoice MAXRESULTS 1000";
      const result = await qbRequest('GET', `/query?query=${encodeURIComponent(query)}&minorversion=65`, accessToken, realmId);
      
      const qbInvoices = result.QueryResponse?.Invoice || [];
      console.log(`Found ${qbInvoices.length} invoices in QuickBooks`);

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];

      // Get all customer mappings for lookup
      const { data: customerMappings } = await supabase
        .from('quickbooks_customer_mappings')
        .select('customer_id, quickbooks_customer_id');
      
      const qbCustomerToLocalMap = new Map(
        (customerMappings || []).map((m: any) => [m.quickbooks_customer_id, m.customer_id])
      );

      // Get all product mappings for lookup
      const { data: productMappings } = await supabase
        .from('quickbooks_product_mappings')
        .select('product_id, quickbooks_item_id');
      
      const qbItemToLocalMap = new Map(
        (productMappings || []).map((m: any) => [m.quickbooks_item_id, m.product_id])
      );

      for (const qbInvoice of qbInvoices) {
        try {
          // Check if already mapped
          const { data: existingMapping } = await supabase
            .from('quickbooks_invoice_mappings')
            .select('*')
            .eq('quickbooks_invoice_id', qbInvoice.Id)
            .single();

          // Find local customer by QB customer ID
          const qbCustomerId = qbInvoice.CustomerRef?.value;
          const localCustomerId = qbCustomerToLocalMap.get(qbCustomerId);

          if (!localCustomerId) {
            console.log(`Skipping invoice ${qbInvoice.DocNumber} - customer not mapped (QB ID: ${qbCustomerId})`);
            skipped++;
            continue;
          }

          // Get customer details
          const { data: customer } = await supabase
            .from('customers')
            .select('name')
            .eq('id', localCustomerId)
            .single();

          // Calculate totals from QB invoice
          const subtotal = Number(qbInvoice.TotalAmt || 0) - Number(qbInvoice.TxnTaxDetail?.TotalTax || 0);
          const taxAmount = Number(qbInvoice.TxnTaxDetail?.TotalTax || 0);
          const total = Number(qbInvoice.TotalAmt || 0);
          const balance = Number(qbInvoice.Balance || 0);
          const paidAmount = total - balance;

          // Determine status
          let status = 'sent';
          if (balance === 0 && total > 0) {
            status = 'paid';
          } else if (paidAmount > 0) {
            status = 'partially_paid';
          }

          const invoiceData = {
            customer_id: localCustomerId,
            customer_name: customer?.name || 'Unknown',
            number: qbInvoice.DocNumber || await generateInvoiceNumber(supabase),
            due_date: qbInvoice.DueDate || qbInvoice.TxnDate,
            subtotal,
            tax_rate: taxAmount > 0 ? (taxAmount / subtotal) * 100 : 0,
            tax_amount: taxAmount,
            total,
            paid_amount: paidAmount,
            remaining_amount: balance,
            status,
            created_at: qbInvoice.TxnDate ? new Date(qbInvoice.TxnDate).toISOString() : new Date().toISOString(),
          };

          if (existingMapping) {
            // Update existing invoice
            await supabase
              .from('invoices')
              .update(invoiceData)
              .eq('id', existingMapping.invoice_id);
            
            await supabase
              .from('quickbooks_invoice_mappings')
              .update({ last_synced_at: new Date().toISOString() })
              .eq('id', existingMapping.id);
            
            updated++;
            console.log(`Updated invoice ${qbInvoice.DocNumber}`);
          } else {
            // Create new invoice
            const { data: newInvoice, error: invoiceError } = await supabase
              .from('invoices')
              .insert(invoiceData)
              .select()
              .single();

            if (invoiceError) {
              console.error(`Error creating invoice ${qbInvoice.DocNumber}:`, invoiceError);
              errors.push(`${qbInvoice.DocNumber}: ${invoiceError.message}`);
              continue;
            }

            // Create line items from QB invoice lines
            const lineItems = [];
            const qbLines = qbInvoice.Line || [];
            
            for (const line of qbLines) {
              if (line.DetailType !== 'SalesItemLineDetail') continue;
              
              const detail = line.SalesItemLineDetail || {};
              const qbItemId = detail.ItemRef?.value;
              const localProductId = qbItemId ? qbItemToLocalMap.get(qbItemId) : null;

              lineItems.push({
                invoice_id: newInvoice.id,
                description: line.Description || detail.ItemRef?.name || 'Item',
                quantity: Number(detail.Qty || 1),
                unit_price: Number(detail.UnitPrice || line.Amount || 0),
                markup: 0,
                total: Number(line.Amount || 0),
                product_id: localProductId || null,
                product_name: detail.ItemRef?.name || null,
              });
            }

            if (lineItems.length > 0) {
              const { error: lineItemsError } = await supabase
                .from('invoice_line_items')
                .insert(lineItems);

              if (lineItemsError) {
                console.error(`Error creating line items for ${qbInvoice.DocNumber}:`, lineItemsError);
              }
            }

            // Create mapping
            await supabase
              .from('quickbooks_invoice_mappings')
              .insert({
                invoice_id: newInvoice.id,
                quickbooks_invoice_id: qbInvoice.Id,
                last_synced_at: new Date().toISOString(),
              });

            imported++;
            console.log(`Imported invoice ${qbInvoice.DocNumber}`);
          }
        } catch (error: any) {
          console.error(`Error processing invoice ${qbInvoice.DocNumber}:`, error);
          errors.push(`${qbInvoice.DocNumber}: ${error.message}`);
        }
      }

      // Log the import
      await supabase.from('quickbooks_sync_log').insert({
        entity_type: 'invoice',
        action: 'import',
        status: errors.length > 0 ? 'partial' : 'success',
        details: { imported, updated, skipped, errors: errors.slice(0, 10), total: qbInvoices.length },
      });

      // Update last sync time
      await supabase
        .from('quickbooks_config')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('is_connected', true);

      return new Response(JSON.stringify({ 
        success: true, 
        imported, 
        updated,
        skipped,
        errors: errors.slice(0, 10),
        total: qbInvoices.length 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error: unknown) {
    console.error('QuickBooks invoice import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
