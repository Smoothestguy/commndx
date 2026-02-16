import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VendorOnboardingSMSRequest {
  vendorId: string;
  vendorName: string;
  phone: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Verify admin or manager role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || !["admin", "manager"].includes(roleData.role)) {
      throw new Error("Only admins and managers can send vendor onboarding invitations");
    }

    const { vendorId, vendorName, phone }: VendorOnboardingSMSRequest = await req.json();

    if (!phone) {
      throw new Error("Phone number is required");
    }

    // Normalize phone number
    let normalizedPhone = phone.replace(/\D/g, "");
    if (normalizedPhone.length === 10) {
      normalizedPhone = "+1" + normalizedPhone;
    } else if (!normalizedPhone.startsWith("+")) {
      normalizedPhone = "+" + normalizedPhone;
    }

    console.log("Creating onboarding token for vendor:", vendorId);

    // Create onboarding token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("vendor_onboarding_tokens")
      .insert({ vendor_id: vendorId })
      .select("token")
      .single();

    if (tokenError) {
      console.error("Error creating token:", tokenError);
      throw new Error("Failed to create onboarding token");
    }

    // Update vendor status to 'invited'
    await supabaseAdmin
      .from("vendors")
      .update({ onboarding_status: "invited" })
      .eq("id", vendorId);

    const siteUrl = Deno.env.get("SITE_URL") || "https://lovable.dev";
    const onboardingLink = `${siteUrl}/vendor-onboarding/${tokenData.token}`;

    console.log("Sending vendor onboarding SMS to:", normalizedPhone);

    // Send SMS via Twilio
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER")!;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const body = new URLSearchParams({
      To: normalizedPhone,
      From: fromNumber,
      Body: `Hi ${vendorName}! Please complete your vendor registration here: ${onboardingLink}`,
    });

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
      },
      body: body.toString(),
    });

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio error:", twilioResult);
      throw new Error(`Failed to send SMS: ${twilioResult.message || "Unknown error"}`);
    }

    console.log("SMS sent successfully:", twilioResult.sid);

    return new Response(JSON.stringify({ success: true, sid: twilioResult.sid }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending vendor onboarding SMS:", error);
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
