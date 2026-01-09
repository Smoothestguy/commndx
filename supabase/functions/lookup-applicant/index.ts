import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LookupRequest {
  email?: string;
  phone?: string;
}

interface ApplicantData {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string;
  address: string | null;
  city: string | null;
  state: string | null;
  home_zip: string | null;
  photo_url: string | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, phone }: LookupRequest = await req.json();

    // Validate input
    if (!email && !phone) {
      return new Response(
        JSON.stringify({ found: false, error: "Email or phone required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build query - prioritize email lookup
    let query = supabase
      .from("applicants")
      .select("id, first_name, last_name, phone, email, address, city, state, home_zip, photo_url")
      .order("created_at", { ascending: false })
      .limit(1);

    if (email) {
      query = query.eq("email", email.toLowerCase().trim());
    } else if (phone) {
      // Normalize phone to 10 digits for comparison
      const normalizedPhone = phone.replace(/\D/g, "").slice(-10);
      query = query.eq("phone", normalizedPhone);
    }

    const { data: applicants, error } = await query;

    if (error) {
      console.error("[lookup-applicant] Database error:", error);
      return new Response(
        JSON.stringify({ found: false, error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!applicants || applicants.length === 0) {
      return new Response(
        JSON.stringify({ found: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const applicant: ApplicantData = applicants[0];

    // Fetch the most recent application's answers for this applicant
    // Also fetch the form template fields so we can do smart matching by label
    const { data: applications, error: appError } = await supabase
      .from("applications")
      .select(`
        answers, 
        sms_consent,
        job_postings!inner (
          form_template_id,
          application_form_templates!inner (
            fields
          )
        )
      `)
      .eq("applicant_id", applicant.id)
      .order("created_at", { ascending: false })
      .limit(1);

    let previousAnswers: Record<string, any> | null = null;
    let previousSmsConsent = false;
    let previousFields: Array<{ id: string; label: string; type: string; options?: string[] }> = [];
    
    if (!appError && applications && applications.length > 0) {
      previousAnswers = applications[0].answers as Record<string, any> | null;
      previousSmsConsent = applications[0].sms_consent || false;
      
      // Extract the form template fields from the nested join
      const jobPosting = applications[0].job_postings as any;
      if (jobPosting?.application_form_templates?.fields) {
        const fields = jobPosting.application_form_templates.fields as any[];
        previousFields = fields.map((f: any) => ({
          id: f.id,
          label: f.label,
          type: f.type,
          options: f.options,
        }));
      }
    }

    console.log(`[lookup-applicant] Found applicant: ${applicant.id} for ${email || phone}, has previous answers: ${!!previousAnswers}, fields: ${previousFields.length}`);

    return new Response(
      JSON.stringify({ 
        found: true, 
        applicant: {
          id: applicant.id,
          first_name: applicant.first_name,
          last_name: applicant.last_name,
          phone: applicant.phone,
          email: applicant.email,
          address: applicant.address,
          city: applicant.city,
          state: applicant.state,
          home_zip: applicant.home_zip,
          photo_url: applicant.photo_url,
        },
        previousAnswers,
        previousFields,
        previousSmsConsent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[lookup-applicant] Error:", err);
    return new Response(
      JSON.stringify({ found: false, error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
