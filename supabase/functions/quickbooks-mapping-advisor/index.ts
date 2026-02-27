import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a senior QuickBooks Online integration expert and tax-aware accounting advisor.

Your job is to analyze unmapped QuickBooks sync data and return prioritized, actionable guidance that helps users restore accurate financials without creating accounting or tax errors.

Context: You are given mapping summaries for multiple QuickBooks entities, counts of mapped vs unmapped records, and samples of unmapped records per entity.

Core Principles:
- Accounting safety first. Never recommend mappings that could distort revenue, expenses, equity, or taxes.
- Upstream before downstream. Prioritize root causes (missing Items, Accounts, Tax Codes) before downstream records.
- Impact-driven prioritization based on open dollar amount, age, dependent records, and reporting impact.
- Every critical issue must include what to do next.
- Explain reasoning with confidence levels.

For each entity analyze: unmapped vs mapped count, open vs closed records, dollar amounts, record age, dependencies.

Detect anomalies like: high unmapped invoices with zero unmapped customers, large dollar exposure in few records, downstream unmapped while upstream is fully mapped.

Classify root causes as: missing dependency, name collision/duplicate, inactive/archived QB record, validation failure, permissions/API error, closed books/locked period, or unknown.

Return valid JSON only using the provided tool schema. No prose outside JSON.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch counts for all entities
    const [
      vendors, vendorMappings,
      customers, customerMappings,
      invoices, invoiceMappings,
      estimates, estimateMappings,
      vendorBills, billMappings,
      expenseCategories, accountMappings,
      products, productsMapped,
    ] = await Promise.all([
      supabase.from("vendors").select("id", { count: "exact", head: true }).is("merged_into_id", null),
      supabase.from("quickbooks_vendor_mappings").select("id", { count: "exact", head: true }),
      supabase.from("customers").select("id", { count: "exact", head: true }).is("merged_into_id", null),
      supabase.from("quickbooks_customer_mappings").select("id", { count: "exact", head: true }),
      supabase.from("invoices").select("id", { count: "exact", head: true }),
      supabase.from("quickbooks_invoice_mappings").select("id", { count: "exact", head: true }),
      supabase.from("estimates").select("id", { count: "exact", head: true }),
      supabase.from("quickbooks_estimate_mappings").select("id", { count: "exact", head: true }),
      supabase.from("vendor_bills").select("id", { count: "exact", head: true }),
      supabase.from("quickbooks_bill_mappings").select("id", { count: "exact", head: true }),
      supabase.from("expense_categories").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("quickbooks_account_mappings").select("id", { count: "exact", head: true }),
      supabase.from("qb_product_service_mappings").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("qb_product_service_mappings").select("id", { count: "exact", head: true }).eq("is_active", true).not("quickbooks_item_id", "is", null),
    ]);

    const mappingSummary = {
      vendors: { total: vendors.count ?? 0, synced: vendorMappings.count ?? 0 },
      customers: { total: customers.count ?? 0, synced: customerMappings.count ?? 0 },
      invoices: { total: invoices.count ?? 0, synced: invoiceMappings.count ?? 0 },
      estimates: { total: estimates.count ?? 0, synced: estimateMappings.count ?? 0 },
      vendor_bills: { total: vendorBills.count ?? 0, synced: billMappings.count ?? 0 },
      expense_categories: { total: expenseCategories.count ?? 0, synced: accountMappings.count ?? 0 },
      products: { total: products.count ?? 0, synced: productsMapped.count ?? 0 },
    };

    // Fetch sample unmapped records (up to 20 per entity)
    // Unmapped vendors: vendors without a mapping row
    const { data: unmappedVendors } = await supabase
      .from("vendors")
      .select("id, name, company, email, status, created_at")
      .is("merged_into_id", null)
      .not("id", "in", `(SELECT vendor_id FROM quickbooks_vendor_mappings)`)
      .limit(20);

    // For entities with complex joins, use simpler approaches
    // Unmapped invoices
    const { data: allInvoiceMappingIds } = await supabase
      .from("quickbooks_invoice_mappings")
      .select("invoice_id");
    const mappedInvoiceIds = (allInvoiceMappingIds ?? []).map((m: any) => m.invoice_id);

    const invoiceQuery = supabase
      .from("invoices")
      .select("id, number, customer_name, total, status, remaining_amount, created_at, due_date")
      .order("total", { ascending: false })
      .limit(20);
    if (mappedInvoiceIds.length > 0) {
      invoiceQuery.not("id", "in", `(${mappedInvoiceIds.join(",")})`);
    }
    const { data: unmappedInvoices } = await invoiceQuery;

    // Unmapped estimates
    const { data: allEstimateMappingIds } = await supabase
      .from("quickbooks_estimate_mappings")
      .select("estimate_id");
    const mappedEstimateIds = (allEstimateMappingIds ?? []).map((m: any) => m.estimate_id);

    const estimateQuery = supabase
      .from("estimates")
      .select("id, number, customer_name, total, status, created_at")
      .order("total", { ascending: false })
      .limit(20);
    if (mappedEstimateIds.length > 0) {
      estimateQuery.not("id", "in", `(${mappedEstimateIds.join(",")})`);
    }
    const { data: unmappedEstimates } = await estimateQuery;

    // Unmapped vendor bills
    const { data: allBillMappingIds } = await supabase
      .from("quickbooks_bill_mappings")
      .select("bill_id");
    const mappedBillIds = (allBillMappingIds ?? []).map((m: any) => m.bill_id);

    const billQuery = supabase
      .from("vendor_bills")
      .select("id, number, vendor_name, total, status, remaining_amount, created_at, due_date")
      .order("total", { ascending: false })
      .limit(20);
    if (mappedBillIds.length > 0) {
      billQuery.not("id", "in", `(${mappedBillIds.join(",")})`);
    }
    const { data: unmappedBills } = await billQuery;

    // Unmapped customers
    const { data: allCustomerMappingIds } = await supabase
      .from("quickbooks_customer_mappings")
      .select("customer_id");
    const mappedCustomerIds = (allCustomerMappingIds ?? []).map((m: any) => m.customer_id);

    const customerQuery = supabase
      .from("customers")
      .select("id, name, company, email, created_at")
      .is("merged_into_id", null)
      .limit(20);
    if (mappedCustomerIds.length > 0) {
      customerQuery.not("id", "in", `(${mappedCustomerIds.join(",")})`);
    }
    const { data: unmappedCustomers } = await customerQuery;

    // Unmapped expense categories
    const { data: allAccountMappingIds } = await supabase
      .from("quickbooks_account_mappings")
      .select("expense_category_id");
    const mappedAccountIds = (allAccountMappingIds ?? []).map((m: any) => m.expense_category_id);

    const categoryQuery = supabase
      .from("expense_categories")
      .select("id, name, category_type, created_at")
      .eq("is_active", true)
      .limit(20);
    if (mappedAccountIds.length > 0) {
      categoryQuery.not("id", "in", `(${mappedAccountIds.join(",")})`);
    }
    const { data: unmappedCategories } = await categoryQuery;

    // Unmapped products
    const { data: unmappedProducts } = await supabase
      .from("qb_product_service_mappings")
      .select("id, product_name, item_type, created_at")
      .eq("is_active", true)
      .is("quickbooks_item_id", null)
      .limit(20);

    const now = new Date();
    const ageDays = (dateStr: string | null) => {
      if (!dateStr) return null;
      return Math.floor((now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    };

    const dataContext = {
      mapping_summary: mappingSummary,
      unmapped_samples: {
        vendors: (unmappedVendors ?? []).map((v: any) => ({
          id: v.id, name: v.name, company: v.company, status: v.status, age_days: ageDays(v.created_at),
        })),
        customers: (unmappedCustomers ?? []).map((c: any) => ({
          id: c.id, name: c.name, company: c.company, age_days: ageDays(c.created_at),
        })),
        invoices: (unmappedInvoices ?? []).map((i: any) => ({
          id: i.id, number: i.number, customer: i.customer_name, total: i.total, status: i.status,
          remaining: i.remaining_amount, age_days: ageDays(i.created_at),
          due_date: i.due_date, overdue: i.due_date ? new Date(i.due_date) < now : false,
        })),
        estimates: (unmappedEstimates ?? []).map((e: any) => ({
          id: e.id, number: e.number, customer: e.customer_name, total: e.total, status: e.status,
          age_days: ageDays(e.created_at),
        })),
        vendor_bills: (unmappedBills ?? []).map((b: any) => ({
          id: b.id, number: b.number, vendor: b.vendor_name, total: b.total, status: b.status,
          remaining: b.remaining_amount, age_days: ageDays(b.created_at),
          due_date: b.due_date, overdue: b.due_date ? new Date(b.due_date) < now : false,
        })),
        expense_categories: (unmappedCategories ?? []).map((c: any) => ({
          id: c.id, name: c.name, type: c.category_type, age_days: ageDays(c.created_at),
        })),
        products: (unmappedProducts ?? []).map((p: any) => ({
          id: p.id, name: p.product_name, type: p.item_type, age_days: ageDays(p.created_at),
        })),
      },
    };

    const userPrompt = `Analyze the following QuickBooks sync mapping data and provide your expert assessment:\n\n${JSON.stringify(dataContext, null, 2)}`;

    const toolSchema = {
      type: "function",
      function: {
        name: "provide_mapping_analysis",
        description: "Return structured mapping analysis with priorities, recommendations, and warnings.",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string", description: "High-level overview of the most serious risks and why they matter." },
            entity_overview: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entity: { type: "string" },
                  unmapped_count: { type: "number" },
                  open_count: { type: "number" },
                  total_open_amount: { type: "number" },
                  oldest_age_days: { type: "number" },
                  likely_root_causes: { type: "array", items: { type: "string" } },
                },
                required: ["entity", "unmapped_count", "likely_root_causes"],
              },
            },
            critical_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entity: { type: "string" },
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                  impact: {
                    type: "object",
                    properties: {
                      amount: { type: "number" },
                      count: { type: "number" },
                      oldest_age_days: { type: "number" },
                    },
                    required: ["count"],
                  },
                  reason: { type: "string" },
                  root_cause: { type: "string" },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                  records: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        summary: { type: "string" },
                      },
                      required: ["id", "summary"],
                    },
                  },
                  next_actions: { type: "array", items: { type: "string" } },
                },
                required: ["entity", "priority", "impact", "reason", "root_cause", "confidence", "next_actions"],
              },
            },
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  order: { type: "number" },
                  title: { type: "string" },
                  rationale: { type: "string" },
                  steps: { type: "array", items: { type: "string" } },
                  risk_if_ignored: { type: "string" },
                },
                required: ["order", "title", "rationale", "steps", "risk_if_ignored"],
              },
            },
            warnings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["tax", "accounting", "data", "permissions"] },
                  message: { type: "string" },
                },
                required: ["type", "message"],
              },
            },
          },
          required: ["summary", "entity_overview", "critical_items", "recommendations", "warnings"],
          additionalProperties: false,
        },
      },
    };

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "provide_mapping_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const body = await aiResponse.text();
      console.error("AI gateway error:", status, body);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI usage credits exhausted. Please add credits in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway returned ${status}`);
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      // Fallback: try to parse content directly
      const content = aiResult.choices?.[0]?.message?.content;
      if (content) {
        try {
          const parsed = JSON.parse(content);
          return new Response(JSON.stringify(parsed), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch {
          throw new Error("AI did not return structured output");
        }
      }
      throw new Error("AI did not return tool call or content");
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Mapping advisor error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
