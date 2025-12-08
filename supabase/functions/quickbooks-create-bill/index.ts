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
    console.log('Token expiring soon, refreshing...');
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
  
  console.log(`QuickBooks API ${method} ${endpoint}`);
  
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
    throw new Error(`QuickBooks API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Get or create vendor in QuickBooks
async function getOrCreateQBVendor(supabase: any, vendorId: string, accessToken: string, realmId: string): Promise<string> {
  // Check if vendor already mapped
  const { data: mapping } = await supabase
    .from('quickbooks_vendor_mappings')
    .select('quickbooks_vendor_id')
    .eq('vendor_id', vendorId)
    .single();

  if (mapping) {
    console.log(`Found existing vendor mapping: ${mapping.quickbooks_vendor_id}`);
    return mapping.quickbooks_vendor_id;
  }

  // Get vendor details
  const { data: vendor, error: vendorError } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', vendorId)
    .single();

  if (vendorError || !vendor) {
    throw new Error(`Vendor not found: ${vendorId}`);
  }

  console.log(`Creating vendor in QuickBooks: ${vendor.name}`);

  // Create vendor in QuickBooks
  const qbVendor = {
    DisplayName: vendor.name,
    CompanyName: vendor.company || vendor.name,
    PrimaryEmailAddr: vendor.email ? { Address: vendor.email } : undefined,
    PrimaryPhone: vendor.phone ? { FreeFormNumber: vendor.phone } : undefined,
    BillAddr: vendor.address ? {
      Line1: vendor.address,
    } : undefined,
    Active: vendor.status === 'active',
  };

  const result = await qbRequest('POST', '/vendor?minorversion=65', accessToken, realmId, qbVendor);

  const qbVendorId = result.Vendor.Id;

  // Create mapping
  await supabase.from('quickbooks_vendor_mappings').insert({
    vendor_id: vendorId,
    quickbooks_vendor_id: qbVendorId,
    sync_status: 'synced',
    last_synced_at: new Date().toISOString(),
    sync_direction: 'export',
  });

  console.log(`Created vendor in QuickBooks with ID: ${qbVendorId}`);

  return qbVendorId;
}

// Get expense account reference (uses default expense account)
async function getExpenseAccountRef(accessToken: string, realmId: string): Promise<{ value: string; name: string }> {
  // Query for an expense account - prefer "Cost of Goods Sold" or similar
  const query = encodeURIComponent("SELECT * FROM Account WHERE AccountType = 'Cost of Goods Sold' MAXRESULTS 1");
  
  try {
    const result = await qbRequest('GET', `/query?query=${query}&minorversion=65`, accessToken, realmId);
    
    if (result.QueryResponse?.Account?.length > 0) {
      const account = result.QueryResponse.Account[0];
      return { value: account.Id, name: account.Name };
    }
  } catch (e) {
    console.log('Could not find COGS account, trying Expense account');
  }

  // Fallback to expense account
  const expenseQuery = encodeURIComponent("SELECT * FROM Account WHERE AccountType = 'Expense' MAXRESULTS 1");
  const expenseResult = await qbRequest('GET', `/query?query=${expenseQuery}&minorversion=65`, accessToken, realmId);
  
  if (expenseResult.QueryResponse?.Account?.length > 0) {
    const account = expenseResult.QueryResponse.Account[0];
    return { value: account.Id, name: account.Name };
  }

  throw new Error('No expense account found in QuickBooks');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { billId } = await req.json();
    
    if (!billId) {
      throw new Error('billId is required');
    }

    console.log(`Creating QuickBooks bill for bill ID: ${billId}`);

    const { accessToken, realmId } = await getValidToken(supabase);

    // Get the vendor bill with line items
    const { data: bill, error: billError } = await supabase
      .from('vendor_bills')
      .select('*')
      .eq('id', billId)
      .single();

    if (billError || !bill) {
      throw new Error(`Vendor bill not found: ${billId}`);
    }

    // Get line items
    const { data: lineItems, error: lineItemsError } = await supabase
      .from('vendor_bill_line_items')
      .select('*')
      .eq('bill_id', billId);

    if (lineItemsError) {
      throw new Error(`Failed to get line items: ${lineItemsError.message}`);
    }

    console.log(`Found ${lineItems?.length || 0} line items for bill ${bill.number}`);

    // Check if already synced
    const { data: existingMapping } = await supabase
      .from('quickbooks_bill_mappings')
      .select('*')
      .eq('bill_id', billId)
      .single();

    if (existingMapping && existingMapping.sync_status === 'synced') {
      console.log(`Bill already synced to QuickBooks: ${existingMapping.quickbooks_bill_id}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Bill already synced',
        quickbooksBillId: existingMapping.quickbooks_bill_id,
        quickbooksDocNumber: existingMapping.quickbooks_doc_number,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get or create QB vendor
    const qbVendorId = await getOrCreateQBVendor(supabase, bill.vendor_id, accessToken, realmId);

    // Get expense account reference
    const expenseAccountRef = await getExpenseAccountRef(accessToken, realmId);
    console.log(`Using expense account: ${expenseAccountRef.name} (${expenseAccountRef.value})`);

    // Build QB bill line items
    const qbLineItems = [];

    if (lineItems && lineItems.length > 0) {
      for (const item of lineItems) {
        qbLineItems.push({
          DetailType: 'AccountBasedExpenseLineDetail',
          Amount: Number(item.total),
          Description: item.description,
          AccountBasedExpenseLineDetail: {
            AccountRef: expenseAccountRef,
          },
        });
      }
    } else {
      // If no line items, create one with the total
      qbLineItems.push({
        DetailType: 'AccountBasedExpenseLineDetail',
        Amount: Number(bill.subtotal),
        Description: `Bill ${bill.number}`,
        AccountBasedExpenseLineDetail: {
          AccountRef: expenseAccountRef,
        },
      });
    }

    // Create QB bill
    const qbBill = {
      VendorRef: { value: qbVendorId },
      Line: qbLineItems,
      TxnDate: bill.bill_date,
      DueDate: bill.due_date,
      DocNumber: bill.number,
      PrivateNote: bill.notes || `CommandX Vendor Bill: ${bill.number}`,
    };

    console.log('Creating bill in QuickBooks:', JSON.stringify(qbBill, null, 2));

    const result = await qbRequest('POST', '/bill?minorversion=65', accessToken, realmId, qbBill);

    const qbBillId = result.Bill.Id;
    const qbDocNumber = result.Bill.DocNumber;

    console.log(`Bill created in QuickBooks with ID: ${qbBillId}, DocNumber: ${qbDocNumber}`);

    // Create or update mapping
    if (existingMapping) {
      await supabase
        .from('quickbooks_bill_mappings')
        .update({
          quickbooks_bill_id: qbBillId,
          quickbooks_doc_number: qbDocNumber,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', existingMapping.id);
    } else {
      await supabase
        .from('quickbooks_bill_mappings')
        .insert({
          bill_id: billId,
          quickbooks_bill_id: qbBillId,
          quickbooks_doc_number: qbDocNumber,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
        });
    }

    // Log the sync
    await supabase.from('quickbooks_sync_log').insert({
      entity_type: 'vendor_bill',
      entity_id: billId,
      quickbooks_id: qbBillId,
      action: 'create',
      status: 'success',
      details: { doc_number: qbDocNumber, vendor_name: bill.vendor_name },
    });

    return new Response(JSON.stringify({ 
      success: true, 
      quickbooksBillId: qbBillId,
      quickbooksDocNumber: qbDocNumber,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('QuickBooks bill creation error:', errorMessage);
    
    // Try to get billId from request for logging
    let billId: string | null = null;
    try {
      const body = await req.clone().json();
      billId = body.billId;
    } catch {}

    // Update mapping with error if it exists
    if (billId) {
      await supabase
        .from('quickbooks_bill_mappings')
        .upsert({
          bill_id: billId,
          quickbooks_bill_id: '',
          sync_status: 'error',
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'bill_id',
        });
    }

    // Log the error
    await supabase.from('quickbooks_sync_log').insert({
      entity_type: 'vendor_bill',
      entity_id: billId,
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
