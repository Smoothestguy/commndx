import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QUICKBOOKS_CLIENT_ID = Deno.env.get('QUICKBOOKS_CLIENT_ID')!;
const QUICKBOOKS_CLIENT_SECRET = Deno.env.get('QUICKBOOKS_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// QuickBooks OAuth endpoints
const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

// Normalize redirect URI for consistency
function normalizeRedirectUri(uri: string): string {
  let normalized = uri;
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');
  // Ensure lowercase path (but keep domain case-sensitive for some providers)
  const url = new URL(normalized);
  url.pathname = url.pathname.toLowerCase();
  return url.toString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, code, realmId, redirectUri } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Debug logging
    console.log('=== QuickBooks OAuth Debug ===');
    console.log('Action:', action);
    console.log('Redirect URI received:', redirectUri);
    console.log('Client ID (first 10 chars):', QUICKBOOKS_CLIENT_ID?.substring(0, 10) + '...');
    console.log('Client ID length:', QUICKBOOKS_CLIENT_ID?.length);
    console.log('Client Secret set:', !!QUICKBOOKS_CLIENT_SECRET);
    console.log('==============================');

    if (action === 'get-auth-url') {
      // Generate OAuth URL for QuickBooks authorization
      const state = crypto.randomUUID();
      const scope = 'com.intuit.quickbooks.accounting';
      
      // Normalize the redirect URI
      const normalizedRedirectUri = normalizeRedirectUri(redirectUri);
      
      console.log('=== Auth URL Generation ===');
      console.log('Original redirect_uri:', redirectUri);
      console.log('Normalized redirect_uri:', normalizedRedirectUri);
      console.log('Encoded redirect_uri:', encodeURIComponent(normalizedRedirectUri));
      
      const authUrl = `${QB_AUTH_URL}?client_id=${QUICKBOOKS_CLIENT_ID}&response_type=code&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(normalizedRedirectUri)}&state=${state}`;
      
      console.log('Full auth URL:', authUrl);
      console.log('===========================');
      
      return new Response(JSON.stringify({ authUrl, state }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'exchange-code') {
      // Exchange authorization code for tokens
      console.log('=== Token Exchange ===');
      console.log('Code received (first 10 chars):', code?.substring(0, 10) + '...');
      console.log('Realm ID:', realmId);
      console.log('Redirect URI for exchange:', redirectUri);
      
      const normalizedRedirectUri = normalizeRedirectUri(redirectUri);
      console.log('Normalized redirect URI:', normalizedRedirectUri);
      
      const credentials = btoa(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`);
      
      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: normalizedRedirectUri,
      });
      
      console.log('Token request body:', tokenBody.toString());
      console.log('======================');
      
      const tokenResponse = await fetch(QB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenBody,
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange failed:', errorText);
        console.error('Token response status:', tokenResponse.status);
        throw new Error(`Token exchange failed: ${errorText}`);
      }

      const tokens = await tokenResponse.json();
      console.log('Token exchange successful');

      // Get company info from QuickBooks
      const companyResponse = await fetch(
        `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}?minorversion=65`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${tokens.access_token}`,
          },
        }
      );

      let companyName = 'QuickBooks Company';
      if (companyResponse.ok) {
        const companyData = await companyResponse.json();
        companyName = companyData.CompanyInfo?.CompanyName || companyName;
      }

      // Calculate token expiration
      const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Check if config already exists
      const { data: existingConfig } = await supabase
        .from('quickbooks_config')
        .select('id')
        .single();

      if (existingConfig) {
        // Update existing config
        const { error: updateError } = await supabase
          .from('quickbooks_config')
          .update({
            realm_id: realmId,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: tokenExpiresAt,
            company_name: companyName,
            is_connected: true,
          })
          .eq('id', existingConfig.id);

        if (updateError) throw updateError;
      } else {
        // Insert new config
        const { error: insertError } = await supabase
          .from('quickbooks_config')
          .insert({
            realm_id: realmId,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: tokenExpiresAt,
            company_name: companyName,
            is_connected: true,
          });

        if (insertError) throw insertError;
      }

      // Log the connection
      await supabase.from('quickbooks_sync_log').insert({
        entity_type: 'config',
        action: 'connect',
        status: 'success',
        details: { company_name: companyName, realm_id: realmId },
      });

      console.log('QuickBooks connected successfully');

      return new Response(JSON.stringify({ 
        success: true, 
        companyName,
        realmId 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'disconnect') {
      // Disconnect QuickBooks
      const { error } = await supabase
        .from('quickbooks_config')
        .update({
          is_connected: false,
          access_token: null,
          refresh_token: null,
        })
        .not('id', 'is', null);

      if (error) throw error;

      await supabase.from('quickbooks_sync_log').insert({
        entity_type: 'config',
        action: 'disconnect',
        status: 'success',
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'refresh-token') {
      // Get current config
      const { data: config, error: configError } = await supabase
        .from('quickbooks_config')
        .select('*')
        .eq('is_connected', true)
        .single();

      if (configError || !config) {
        throw new Error('QuickBooks not connected');
      }

      const credentials = btoa(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`);
      
      const tokenResponse = await fetch(QB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: config.refresh_token,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token refresh failed:', errorText);
        
        // Mark as disconnected on refresh failure
        await supabase
          .from('quickbooks_config')
          .update({ is_connected: false })
          .eq('id', config.id);
          
        throw new Error(`Token refresh failed: ${errorText}`);
      }

      const tokens = await tokenResponse.json();
      const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      await supabase
        .from('quickbooks_config')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokenExpiresAt,
        })
        .eq('id', config.id);

      console.log('Token refreshed successfully');

      return new Response(JSON.stringify({ 
        success: true,
        access_token: tokens.access_token,
        realm_id: config.realm_id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error: unknown) {
    console.error('QuickBooks OAuth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
