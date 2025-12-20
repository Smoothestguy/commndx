import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MergeRequest {
  entityType: "customer" | "vendor" | "personnel";
  sourceId: string;
  targetId: string;
  fieldResolutions: Record<string, "source" | "target">;
  quickbooksResolution?: {
    keepSourceQB: boolean;
  };
  mergeReason?: string;
}

interface MergeResult {
  success: boolean;
  error?: string;
  auditId?: string;
  recordsUpdated?: Record<string, number>;
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

    // Verify user and check admin role
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only admins can perform merges" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const request: MergeRequest = await req.json();
    const { entityType, sourceId, targetId, fieldResolutions, quickbooksResolution, mergeReason } = request;

    console.log(`Starting ${entityType} merge: ${sourceId} -> ${targetId}`);

    // Validate that source and target are different
    if (sourceId === targetId) {
      return new Response(
        JSON.stringify({ error: "Cannot merge an entity with itself" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: MergeResult;

    switch (entityType) {
      case "customer":
        result = await mergeCustomers(supabase, sourceId, targetId, fieldResolutions, quickbooksResolution, mergeReason, userData.user.id, userData.user.email!);
        break;
      case "vendor":
        result = await mergeVendors(supabase, sourceId, targetId, fieldResolutions, quickbooksResolution, mergeReason, userData.user.id, userData.user.email!);
        break;
      case "personnel":
        result = await mergePersonnel(supabase, sourceId, targetId, fieldResolutions, mergeReason, userData.user.id, userData.user.email!);
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Invalid entity type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Merge completed successfully:", result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Merge error:", error);
    const message = error instanceof Error ? error.message : "Merge failed";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function mergeCustomers(
  supabase: any,
  sourceId: string,
  targetId: string,
  fieldResolutions: Record<string, "source" | "target">,
  quickbooksResolution: { keepSourceQB: boolean } | undefined,
  mergeReason: string | undefined,
  userId: string,
  userEmail: string
): Promise<MergeResult> {
  try {
    // Fetch source and target customers
    const [sourceResult, targetResult] = await Promise.all([
      supabase.from("customers").select("*").eq("id", sourceId).single(),
      supabase.from("customers").select("*").eq("id", targetId).single()
    ]);

    if (sourceResult.error || !sourceResult.data) {
      return { success: false, error: "Source customer not found" };
    }
    if (targetResult.error || !targetResult.data) {
      return { success: false, error: "Target customer not found" };
    }

    const source = sourceResult.data;
    const target = targetResult.data;

    // Build merged data based on field resolutions
    const mergedData: Record<string, any> = { ...target };
    for (const [field, choice] of Object.entries(fieldResolutions)) {
      if (choice === "source" && field in source) {
        mergedData[field] = source[field];
      }
    }

    // Remove system fields from update
    delete mergedData.id;
    delete mergedData.created_at;
    delete mergedData.merged_into_id;
    delete mergedData.merged_at;
    delete mergedData.merged_by;
    delete mergedData.merge_reason;
    mergedData.updated_at = new Date().toISOString();

    const recordsUpdated: Record<string, number> = {};

    // Update target customer with merged data
    const { error: updateTargetError } = await supabase
      .from("customers")
      .update(mergedData)
      .eq("id", targetId);

    if (updateTargetError) throw updateTargetError;

    // Repoint all foreign keys from source to target
    // Projects
    const { data: projectsUpdated } = await supabase
      .from("projects")
      .update({ customer_id: targetId })
      .eq("customer_id", sourceId)
      .select("id");
    recordsUpdated.projects = projectsUpdated?.length || 0;

    // Estimates
    const { data: estimatesUpdated } = await supabase
      .from("estimates")
      .update({ customer_id: targetId, customer_name: mergedData.name })
      .eq("customer_id", sourceId)
      .select("id");
    recordsUpdated.estimates = estimatesUpdated?.length || 0;

    // Invoices
    const { data: invoicesUpdated } = await supabase
      .from("invoices")
      .update({ customer_id: targetId, customer_name: mergedData.name })
      .eq("customer_id", sourceId)
      .select("id");
    recordsUpdated.invoices = invoicesUpdated?.length || 0;

    // Job Orders
    const { data: jobOrdersUpdated } = await supabase
      .from("job_orders")
      .update({ customer_id: targetId, customer_name: mergedData.name })
      .eq("customer_id", sourceId)
      .select("id");
    recordsUpdated.job_orders = jobOrdersUpdated?.length || 0;

    // Change Orders
    const { data: changeOrdersUpdated } = await supabase
      .from("change_orders")
      .update({ customer_id: targetId, customer_name: mergedData.name })
      .eq("customer_id", sourceId)
      .select("id");
    recordsUpdated.change_orders = changeOrdersUpdated?.length || 0;

    // Activities
    const { data: activitiesUpdated } = await supabase
      .from("activities")
      .update({ customer_id: targetId })
      .eq("customer_id", sourceId)
      .select("id");
    recordsUpdated.activities = activitiesUpdated?.length || 0;

    // Appointments
    const { data: appointmentsUpdated } = await supabase
      .from("appointments")
      .update({ customer_id: targetId })
      .eq("customer_id", sourceId)
      .select("id");
    recordsUpdated.appointments = appointmentsUpdated?.length || 0;

    // Insurance Claims
    const { data: claimsUpdated } = await supabase
      .from("insurance_claims")
      .update({ customer_id: targetId })
      .eq("customer_id", sourceId)
      .select("id");
    recordsUpdated.insurance_claims = claimsUpdated?.length || 0;

    // Mark source as merged
    const { error: mergeSourceError } = await supabase
      .from("customers")
      .update({
        merged_into_id: targetId,
        merged_at: new Date().toISOString(),
        merged_by: userId,
        merge_reason: mergeReason || null
      })
      .eq("id", sourceId);

    if (mergeSourceError) throw mergeSourceError;

    // Create audit record
    const { data: auditData, error: auditError } = await supabase
      .from("entity_merge_audit")
      .insert({
        entity_type: "customer",
        source_entity_id: sourceId,
        target_entity_id: targetId,
        source_entity_snapshot: source,
        target_entity_snapshot: target,
        merged_entity_snapshot: mergedData,
        field_overrides: fieldResolutions,
        related_records_updated: recordsUpdated,
        quickbooks_resolution: quickbooksResolution || null,
        merged_by: userId,
        merged_by_email: userEmail,
        notes: mergeReason || null
      })
      .select("id")
      .single();

    if (auditError) {
      console.error("Failed to create audit record:", auditError);
    }

    return {
      success: true,
      auditId: auditData?.id,
      recordsUpdated
    };

  } catch (error) {
    console.error("Customer merge error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function mergeVendors(
  supabase: any,
  sourceId: string,
  targetId: string,
  fieldResolutions: Record<string, "source" | "target">,
  quickbooksResolution: { keepSourceQB: boolean } | undefined,
  mergeReason: string | undefined,
  userId: string,
  userEmail: string
): Promise<MergeResult> {
  try {
    // Fetch source and target vendors
    const [sourceResult, targetResult] = await Promise.all([
      supabase.from("vendors").select("*").eq("id", sourceId).single(),
      supabase.from("vendors").select("*").eq("id", targetId).single()
    ]);

    if (sourceResult.error || !sourceResult.data) {
      return { success: false, error: "Source vendor not found" };
    }
    if (targetResult.error || !targetResult.data) {
      return { success: false, error: "Target vendor not found" };
    }

    const source = sourceResult.data;
    const target = targetResult.data;

    // Build merged data based on field resolutions
    const mergedData: Record<string, any> = { ...target };
    for (const [field, choice] of Object.entries(fieldResolutions)) {
      if (choice === "source" && field in source) {
        mergedData[field] = source[field];
      }
    }

    // Remove system fields from update
    delete mergedData.id;
    delete mergedData.created_at;
    delete mergedData.merged_into_id;
    delete mergedData.merged_at;
    delete mergedData.merged_by;
    delete mergedData.merge_reason;
    delete mergedData.is_active;
    mergedData.updated_at = new Date().toISOString();

    const recordsUpdated: Record<string, number> = {};

    // Update target vendor with merged data
    const { error: updateTargetError } = await supabase
      .from("vendors")
      .update(mergedData)
      .eq("id", targetId);

    if (updateTargetError) throw updateTargetError;

    // Repoint all foreign keys from source to target
    // Purchase Orders
    const { data: purchaseOrdersUpdated } = await supabase
      .from("purchase_orders")
      .update({ vendor_id: targetId, vendor_name: mergedData.name })
      .eq("vendor_id", sourceId)
      .select("id");
    recordsUpdated.purchase_orders = purchaseOrdersUpdated?.length || 0;

    // Vendor Bills
    const { data: vendorBillsUpdated } = await supabase
      .from("vendor_bills")
      .update({ vendor_id: targetId, vendor_name: mergedData.name })
      .eq("vendor_id", sourceId)
      .select("id");
    recordsUpdated.vendor_bills = vendorBillsUpdated?.length || 0;

    // Change Orders (vendor_id)
    const { data: changeOrdersUpdated } = await supabase
      .from("change_orders")
      .update({ vendor_id: targetId, vendor_name: mergedData.name })
      .eq("vendor_id", sourceId)
      .select("id");
    recordsUpdated.change_orders = changeOrdersUpdated?.length || 0;

    // Personnel linked to vendor
    const { data: personnelUpdated } = await supabase
      .from("personnel")
      .update({ linked_vendor_id: targetId })
      .eq("linked_vendor_id", sourceId)
      .select("id");
    recordsUpdated.personnel = personnelUpdated?.length || 0;

    // Mark source as merged
    const { error: mergeSourceError } = await supabase
      .from("vendors")
      .update({
        is_active: false,
        merged_into_id: targetId,
        merged_at: new Date().toISOString(),
        merged_by: userId,
        merge_reason: mergeReason || null
      })
      .eq("id", sourceId);

    if (mergeSourceError) throw mergeSourceError;

    // Create audit record
    const { data: auditData, error: auditError } = await supabase
      .from("entity_merge_audit")
      .insert({
        entity_type: "vendor",
        source_entity_id: sourceId,
        target_entity_id: targetId,
        source_entity_snapshot: source,
        target_entity_snapshot: target,
        merged_entity_snapshot: mergedData,
        field_overrides: fieldResolutions,
        related_records_updated: recordsUpdated,
        quickbooks_resolution: quickbooksResolution || null,
        merged_by: userId,
        merged_by_email: userEmail,
        notes: mergeReason || null
      })
      .select("id")
      .single();

    if (auditError) {
      console.error("Failed to create audit record:", auditError);
    }

    return {
      success: true,
      auditId: auditData?.id,
      recordsUpdated
    };

  } catch (error) {
    console.error("Vendor merge error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function mergePersonnel(
  supabase: any,
  sourceId: string,
  targetId: string,
  fieldResolutions: Record<string, "source" | "target">,
  mergeReason: string | undefined,
  userId: string,
  userEmail: string
): Promise<MergeResult> {
  try {
    // Fetch source and target personnel
    const [sourceResult, targetResult] = await Promise.all([
      supabase.from("personnel").select("*").eq("id", sourceId).single(),
      supabase.from("personnel").select("*").eq("id", targetId).single()
    ]);

    if (sourceResult.error || !sourceResult.data) {
      return { success: false, error: "Source personnel not found" };
    }
    if (targetResult.error || !targetResult.data) {
      return { success: false, error: "Target personnel not found" };
    }

    const source = sourceResult.data;
    const target = targetResult.data;

    // Build merged data based on field resolutions
    const mergedData: Record<string, any> = { ...target };
    for (const [field, choice] of Object.entries(fieldResolutions)) {
      if (choice === "source" && field in source) {
        mergedData[field] = source[field];
      }
    }

    // Remove system fields from update
    delete mergedData.id;
    delete mergedData.created_at;
    delete mergedData.merged_into_id;
    delete mergedData.merged_at;
    delete mergedData.merged_by;
    delete mergedData.merge_reason;
    delete mergedData.personnel_number; // Keep target's personnel number
    mergedData.updated_at = new Date().toISOString();

    const recordsUpdated: Record<string, number> = {};

    // Update target personnel with merged data
    const { error: updateTargetError } = await supabase
      .from("personnel")
      .update(mergedData)
      .eq("id", targetId);

    if (updateTargetError) throw updateTargetError;

    // Repoint all foreign keys from source to target
    // Time Entries
    const { data: timeEntriesUpdated } = await supabase
      .from("time_entries")
      .update({ personnel_id: targetId })
      .eq("personnel_id", sourceId)
      .select("id");
    recordsUpdated.time_entries = timeEntriesUpdated?.length || 0;

    // Personnel Payments
    const { data: paymentsUpdated } = await supabase
      .from("personnel_payments")
      .update({ personnel_id: targetId })
      .eq("personnel_id", sourceId)
      .select("id");
    recordsUpdated.personnel_payments = paymentsUpdated?.length || 0;

    // Personnel Certifications
    const { data: certsUpdated } = await supabase
      .from("personnel_certifications")
      .update({ personnel_id: targetId })
      .eq("personnel_id", sourceId)
      .select("id");
    recordsUpdated.personnel_certifications = certsUpdated?.length || 0;

    // Personnel Languages
    const { data: langsUpdated } = await supabase
      .from("personnel_languages")
      .update({ personnel_id: targetId })
      .eq("personnel_id", sourceId)
      .select("id");
    recordsUpdated.personnel_languages = langsUpdated?.length || 0;

    // Personnel Capabilities
    const { data: capsUpdated } = await supabase
      .from("personnel_capabilities")
      .update({ personnel_id: targetId })
      .eq("personnel_id", sourceId)
      .select("id");
    recordsUpdated.personnel_capabilities = capsUpdated?.length || 0;

    // Emergency Contacts
    const { data: contactsUpdated } = await supabase
      .from("emergency_contacts")
      .update({ personnel_id: targetId })
      .eq("personnel_id", sourceId)
      .select("id");
    recordsUpdated.emergency_contacts = contactsUpdated?.length || 0;

    // Personnel Project Assignments
    const { data: assignmentsUpdated } = await supabase
      .from("personnel_project_assignments")
      .update({ personnel_id: targetId })
      .eq("personnel_id", sourceId)
      .select("id");
    recordsUpdated.personnel_project_assignments = assignmentsUpdated?.length || 0;

    // Project Labor Expenses
    const { data: laborExpensesUpdated } = await supabase
      .from("project_labor_expenses")
      .update({ personnel_id: targetId })
      .eq("personnel_id", sourceId)
      .select("id");
    recordsUpdated.project_labor_expenses = laborExpensesUpdated?.length || 0;

    // Mark source as merged
    const { error: mergeSourceError } = await supabase
      .from("personnel")
      .update({
        status: "inactive",
        merged_into_id: targetId,
        merged_at: new Date().toISOString(),
        merged_by: userId,
        merge_reason: mergeReason || null
      })
      .eq("id", sourceId);

    if (mergeSourceError) throw mergeSourceError;

    // Create audit record
    const { data: auditData, error: auditError } = await supabase
      .from("entity_merge_audit")
      .insert({
        entity_type: "personnel",
        source_entity_id: sourceId,
        target_entity_id: targetId,
        source_entity_snapshot: source,
        target_entity_snapshot: target,
        merged_entity_snapshot: mergedData,
        field_overrides: fieldResolutions,
        related_records_updated: recordsUpdated,
        merged_by: userId,
        merged_by_email: userEmail,
        notes: mergeReason || null
      })
      .select("id")
      .single();

    if (auditError) {
      console.error("Failed to create audit record:", auditError);
    }

    return {
      success: true,
      auditId: auditData?.id,
      recordsUpdated
    };

  } catch (error) {
    console.error("Personnel merge error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
