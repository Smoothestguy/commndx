import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Authentication helper - validates user and checks admin/manager/accounting role
async function authenticateRequest(req: Request): Promise<{ userId: string; error?: never } | { userId?: never; error: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.error("No authorization header provided");
    return {
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    };
  }

  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    console.error("User authentication failed:", userError);
    return {
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    };
  }

  // Check user role - admin, manager, or accounting can access journal entries
  const { data: roleData, error: roleError } = await supabaseClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (roleError) {
    console.error("Error fetching user role:", roleError);
  }

  if (!roleData || !['admin', 'manager', 'accounting'].includes(roleData.role)) {
    console.error("User does not have required role:", user.id);
    return {
      error: new Response(JSON.stringify({ error: "Insufficient permissions. Only admins, managers, and accounting can access journal entries." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    };
  }

  console.log(`Authenticated user ${user.id} with role ${roleData.role}`);
  return { userId: user.id };
}

// Helper to get valid access token
async function getValidToken(supabase: ReturnType<typeof createClient>) {
  const { data: config, error } = await supabase
    .from('quickbooks_config')
    .select('*')
    .eq('is_connected', true)
    .single();

  if (error || !config) {
    throw new Error('QuickBooks not connected');
  }

  // Check if token is expired or will expire in next 5 minutes
  const tokenExpires = new Date(config.token_expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (tokenExpires < fiveMinutesFromNow) {
    // Refresh the token
    console.log('Token expired or expiring soon, attempting refresh...');
    console.log('Token expires at:', config.token_expires_at);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/quickbooks-oauth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ action: 'refresh-token' }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token refresh failed:', response.status, errorText);
      
      // If refresh fails, the user needs to re-authorize
      throw new Error(`Token refresh failed (${response.status}): ${errorText}. QuickBooks may need to be re-connected.`);
    }

    const refreshResult = await response.json();
    console.log('Token refreshed successfully');
    return { accessToken: refreshResult.access_token, realmId: refreshResult.realm_id };
  }

  return { accessToken: config.access_token, realmId: config.realm_id };
}

// QuickBooks API helper
async function qbRequest(method: string, endpoint: string, accessToken: string, realmId: string): Promise<unknown> {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}${endpoint}`;
  
  const options: RequestInit = {
    method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  };

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`QuickBooks API error: ${errorText}`);
    throw new Error(`QuickBooks API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

interface QBJournalEntryLine {
  Id: string;
  Description?: string;
  Amount: number;
  DetailType: string;
  JournalEntryLineDetail?: {
    PostingType: 'Debit' | 'Credit';
    AccountRef?: { value: string; name: string };
    Entity?: {
      Type: string;
      EntityRef?: { value: string; name: string };
    };
  };
}

interface QBJournalEntry {
  Id: string;
  DocNumber?: string;
  TxnDate: string;
  PrivateNote?: string;
  TotalAmt: number;
  Adjustment?: boolean;
  CurrencyRef?: { value: string };
  Line: QBJournalEntryLine[];
  MetaData?: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

interface ParsedLineItem {
  lineId: string;
  description: string | null;
  accountId: string;
  accountName: string;
  amount: number;
  postingType: 'Debit' | 'Credit';
  entityType?: string;
  entityName?: string;
}

// Parse QB journal entry lines into structured format
function parseLineItems(lines: QBJournalEntryLine[]): ParsedLineItem[] {
  return lines
    .filter(line => line.DetailType === 'JournalEntryLineDetail' && line.JournalEntryLineDetail)
    .map(line => {
      const detail = line.JournalEntryLineDetail!;
      return {
        lineId: line.Id,
        description: line.Description || null,
        accountId: detail.AccountRef?.value || '',
        accountName: detail.AccountRef?.name || 'Unknown Account',
        amount: line.Amount,
        postingType: detail.PostingType,
        entityType: detail.Entity?.Type,
        entityName: detail.Entity?.EntityRef?.name,
      };
    });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authResult = await authenticateRequest(req);
    if (authResult.error) {
      return authResult.error;
    }

    const body = await req.json();
    const { startDate, endDate } = body;
    
    console.log(`Fetching journal entries - Start: ${startDate}, End: ${endDate}`);
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { accessToken, realmId } = await getValidToken(supabase);

    // Build query - default to last 90 days if no dates provided
    const today = new Date();
    const defaultStart = new Date(today);
    defaultStart.setDate(defaultStart.getDate() - 90);
    
    const queryStartDate = startDate || defaultStart.toISOString().split('T')[0];
    const queryEndDate = endDate || today.toISOString().split('T')[0];
    
    // QuickBooks query for journal entries
    let query = `SELECT * FROM JournalEntry WHERE TxnDate >= '${queryStartDate}'`;
    if (endDate) {
      query += ` AND TxnDate <= '${queryEndDate}'`;
    }
    query += ` ORDER BY TxnDate DESC MAXRESULTS 500`;
    
    console.log(`QuickBooks query: ${query}`);
    
    const result = await qbRequest(
      'GET', 
      `/query?query=${encodeURIComponent(query)}&minorversion=65`, 
      accessToken, 
      realmId
    ) as { QueryResponse?: { JournalEntry?: QBJournalEntry[] } };
    
    const journalEntries = result.QueryResponse?.JournalEntry || [];
    console.log(`Found ${journalEntries.length} journal entries in QuickBooks`);

    let fetched = 0;
    let updated = 0;

    for (const entry of journalEntries) {
      const parsedLineItems = parseLineItems(entry.Line);
      
      const entryData = {
        quickbooks_id: entry.Id,
        doc_number: entry.DocNumber || null,
        txn_date: entry.TxnDate,
        private_note: entry.PrivateNote || null,
        total_amount: entry.TotalAmt,
        is_adjustment: entry.Adjustment || false,
        currency_code: entry.CurrencyRef?.value || 'USD',
        line_items: parsedLineItems,
        raw_data: entry,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Upsert the journal entry
      const { data: existing } = await supabase
        .from('quickbooks_journal_entries')
        .select('id')
        .eq('quickbooks_id', entry.Id)
        .single();

      if (existing) {
        await supabase
          .from('quickbooks_journal_entries')
          .update(entryData)
          .eq('quickbooks_id', entry.Id);
        updated++;
      } else {
        await supabase
          .from('quickbooks_journal_entries')
          .insert(entryData);
        fetched++;
      }
    }

    // Log the fetch operation
    await supabase.from('quickbooks_sync_log').insert({
      entity_type: 'journal_entry',
      action: 'fetch',
      status: 'success',
      details: { 
        fetched, 
        updated, 
        total: journalEntries.length,
        dateRange: { start: queryStartDate, end: queryEndDate }
      },
    });

    console.log(`Journal entries fetch complete - New: ${fetched}, Updated: ${updated}`);

    return new Response(JSON.stringify({ 
      success: true, 
      fetched, 
      updated, 
      total: journalEntries.length,
      dateRange: { start: queryStartDate, end: queryEndDate }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching journal entries:', error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
