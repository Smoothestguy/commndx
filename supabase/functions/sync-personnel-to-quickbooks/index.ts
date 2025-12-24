import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QUICKBOOKS_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { personnel_id } = await req.json();

    if (!personnel_id) {
      console.error('[sync-personnel-to-qb] Missing personnel_id');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing personnel_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-personnel-to-qb] Starting sync for personnel: ${personnel_id}`);

    // Check if QuickBooks is connected
    const { data: qbConfig, error: qbConfigError } = await supabase
      .from('quickbooks_config')
      .select('*')
      .eq('is_connected', true)
      .maybeSingle();

    if (qbConfigError) {
      console.error('[sync-personnel-to-qb] Error fetching QB config:', qbConfigError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch QuickBooks config' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!qbConfig) {
      console.log('[sync-personnel-to-qb] QuickBooks not connected, skipping sync');
      return new Response(
        JSON.stringify({ success: true, message: 'QuickBooks not connected, skipping sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the personnel record
    const { data: personnel, error: personnelError } = await supabase
      .from('personnel')
      .select('id, first_name, last_name, email, phone, address, city, state, zip, linked_vendor_id, onboarding_status')
      .eq('id', personnel_id)
      .maybeSingle();

    if (personnelError || !personnel) {
      console.error('[sync-personnel-to-qb] Personnel not found:', personnelError);
      return new Response(
        JSON.stringify({ success: false, error: 'Personnel not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if personnel has completed onboarding
    if (personnel.onboarding_status !== 'completed') {
      console.log('[sync-personnel-to-qb] Personnel has not completed onboarding');
      return new Response(
        JSON.stringify({ success: false, error: 'Personnel has not completed onboarding' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let vendorId = personnel.linked_vendor_id;

    // Create vendor if not linked
    if (!vendorId) {
      console.log('[sync-personnel-to-qb] Creating vendor for personnel');
      
      const { data: createResult, error: createError } = await supabase.rpc('create_personnel_vendor', {
        p_personnel_id: personnel_id
      });

      if (createError) {
        console.error('[sync-personnel-to-qb] Error creating vendor:', createError);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to create vendor: ${createError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      vendorId = createResult;
      console.log('[sync-personnel-to-qb] Created vendor:', vendorId);
    }

    // Get the vendor record
    const { data: vendor, error: vendorFetchError } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .maybeSingle();

    if (vendorFetchError || !vendor) {
      console.error('[sync-personnel-to-qb] Vendor not found:', vendorFetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Vendor not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Refresh token if needed
    const tokenExpiresAt = new Date(qbConfig.token_expires_at);
    const now = new Date();
    let accessToken = qbConfig.access_token;
    const realmId = qbConfig.realm_id;

    if (tokenExpiresAt <= new Date(now.getTime() + 5 * 60 * 1000)) {
      console.log('[sync-personnel-to-qb] Refreshing QuickBooks token');
      
      const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
      const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
      
      if (!clientId || !clientSecret) {
        console.error('[sync-personnel-to-qb] Missing QuickBooks credentials');
        return new Response(
          JSON.stringify({ success: false, error: 'QuickBooks credentials not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: qbConfig.refresh_token,
        }),
      });

      if (!tokenResponse.ok) {
        console.error('[sync-personnel-to-qb] Token refresh failed');
        return new Response(
          JSON.stringify({ success: false, error: 'Token refresh failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;

      // Update tokens in database
      await supabase
        .from('quickbooks_config')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        })
        .eq('id', qbConfig.id);
    }

    // Check for existing QB vendor mapping
    const { data: existingMapping } = await supabase
      .from('quickbooks_vendor_mappings')
      .select('quickbooks_vendor_id')
      .eq('vendor_id', vendorId)
      .maybeSingle();

    const qbVendorPayload = {
      DisplayName: vendor.name,
      PrintOnCheckName: vendor.name,
      PrimaryEmailAddr: vendor.email ? { Address: vendor.email } : undefined,
      PrimaryPhone: vendor.phone ? { FreeFormNumber: vendor.phone } : undefined,
      BillAddr: vendor.address ? {
        Line1: vendor.address,
        City: vendor.city || undefined,
        CountrySubDivisionCode: vendor.state || undefined,
        PostalCode: vendor.zip || undefined,
      } : undefined,
    };

    let qbVendorId: string;

    if (existingMapping?.quickbooks_vendor_id) {
      // Update existing vendor
      console.log('[sync-personnel-to-qb] Updating existing QB vendor:', existingMapping.quickbooks_vendor_id);
      
      // First get the current SyncToken
      const getResponse = await fetch(
        `${QUICKBOOKS_API_BASE}/${realmId}/vendor/${existingMapping.quickbooks_vendor_id}?minorversion=65`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
        }
      );

      if (!getResponse.ok) {
        console.error('[sync-personnel-to-qb] Failed to fetch QB vendor for update');
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch QB vendor for update' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const existingVendor = await getResponse.json();
      
      const updateResponse = await fetch(
        `${QUICKBOOKS_API_BASE}/${realmId}/vendor?minorversion=65`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            ...qbVendorPayload,
            Id: existingMapping.quickbooks_vendor_id,
            SyncToken: existingVendor.Vendor.SyncToken,
          }),
        }
      );

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('[sync-personnel-to-qb] QB vendor update failed:', errorText);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to update vendor in QuickBooks' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      qbVendorId = existingMapping.quickbooks_vendor_id;
    } else {
      // Create new vendor
      console.log('[sync-personnel-to-qb] Creating new QB vendor');
      
      const createResponse = await fetch(
        `${QUICKBOOKS_API_BASE}/${realmId}/vendor?minorversion=65`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(qbVendorPayload),
        }
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('[sync-personnel-to-qb] QB vendor create failed:', errorText);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create vendor in QuickBooks' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const createResult = await createResponse.json();
      qbVendorId = createResult.Vendor.Id;

      // Create mapping
      await supabase.from('quickbooks_vendor_mappings').insert({
        vendor_id: vendorId,
        quickbooks_vendor_id: qbVendorId,
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
      });
    }

    // Update last synced timestamp
    await supabase
      .from('quickbooks_vendor_mappings')
      .update({
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
      })
      .eq('vendor_id', vendorId);

    // Log the sync
    await supabase.from('quickbooks_sync_logs').insert({
      entity_type: 'vendor',
      action: 'auto-sync',
      status: 'success',
      details: {
        personnel_id,
        vendor_id: vendorId,
        quickbooks_vendor_id: qbVendorId,
        personnel_name: `${personnel.first_name} ${personnel.last_name}`,
      },
    });

    // Notify admin
    await supabase.functions.invoke('create-admin-notification', {
      body: {
        notification_type: 'personnel_synced_to_qb',
        title: `Personnel Synced to QuickBooks`,
        message: `${personnel.first_name} ${personnel.last_name} was automatically synced to QuickBooks as a vendor.`,
        link_url: `/personnel/${personnel_id}`,
        related_id: personnel_id,
        metadata: {
          personnel_name: `${personnel.first_name} ${personnel.last_name}`,
          vendor_id: vendorId,
          quickbooks_vendor_id: qbVendorId,
        },
      },
    });

    console.log('[sync-personnel-to-qb] Sync completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Personnel synced to QuickBooks successfully',
        vendor_id: vendorId,
        quickbooks_vendor_id: qbVendorId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[sync-personnel-to-qb] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
