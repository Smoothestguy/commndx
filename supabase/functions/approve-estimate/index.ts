import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ApproveEstimateRequest {
  token: string;
  action: "approve" | "request_changes";
  message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { token, action, message }: ApproveEstimateRequest = await req.json();

    console.log("Processing estimate action:", { token, action });

    // Fetch estimate by token
    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select("*")
      .eq("approval_token", token)
      .single();

    if (estimateError || !estimate) {
      console.error("Error fetching estimate:", estimateError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired approval link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already approved
    if (estimate.status === "approved") {
      return new Response(
        JSON.stringify({ error: "This estimate has already been approved" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if expired
    const validUntil = new Date(estimate.valid_until);
    if (validUntil < new Date()) {
      return new Response(
        JSON.stringify({ error: "This estimate has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "approve") {
      // Update estimate to approved
      const { error: updateError } = await supabase
        .from("estimates")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          customer_approved: true,
        })
        .eq("id", estimate.id);

      if (updateError) {
        console.error("Error updating estimate:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to approve estimate" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Estimate approved successfully:", estimate.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Estimate approved successfully",
          estimateNumber: estimate.number,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else if (action === "request_changes") {
      // Update estimate notes with customer message
      const updatedNotes = estimate.notes
        ? `${estimate.notes}\n\n--- Customer Feedback ---\n${message}`
        : `--- Customer Feedback ---\n${message}`;

      const { error: updateError } = await supabase
        .from("estimates")
        .update({
          notes: updatedNotes,
        })
        .eq("id", estimate.id);

      if (updateError) {
        console.error("Error updating estimate notes:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to submit feedback" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Customer feedback submitted:", estimate.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Your feedback has been submitted",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("Error in approve-estimate function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
