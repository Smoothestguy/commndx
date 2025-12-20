import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DuplicateCheckRequest {
  entityType: "customer" | "vendor" | "personnel";
  entityId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const request: DuplicateCheckRequest = await req.json();
    const { entityType, entityId } = request;

    console.log(`Checking duplicates for ${entityType}: ${entityId}`);

    let duplicates: any[] = [];

    switch (entityType) {
      case "customer":
        const { data: customerDupes, error: customerError } = await supabase
          .rpc("find_duplicate_customers", { p_customer_id: entityId });
        
        if (customerError) {
          console.error("Customer duplicate check error:", customerError);
          throw customerError;
        }
        duplicates = customerDupes || [];
        break;

      case "vendor":
        const { data: vendorDupes, error: vendorError } = await supabase
          .rpc("find_duplicate_vendors", { p_vendor_id: entityId });
        
        if (vendorError) {
          console.error("Vendor duplicate check error:", vendorError);
          throw vendorError;
        }
        duplicates = vendorDupes || [];
        break;

      case "personnel":
        const { data: personnelDupes, error: personnelError } = await supabase
          .rpc("find_duplicate_personnel", { p_personnel_id: entityId });
        
        if (personnelError) {
          console.error("Personnel duplicate check error:", personnelError);
          throw personnelError;
        }
        duplicates = personnelDupes || [];
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Invalid entity type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`Found ${duplicates.length} potential duplicates`);

    return new Response(
      JSON.stringify({ duplicates }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Duplicate check error:", error);
    const message = error instanceof Error ? error.message : "Duplicate check failed";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
