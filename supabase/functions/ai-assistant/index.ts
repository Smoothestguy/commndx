import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tool definitions for the AI
const tools = [
  {
    type: "function",
    function: {
      name: "search_records",
      description: "Search for records in the system (customers, invoices, estimates, projects, job_orders, purchase_orders, vendors, personnel)",
      parameters: {
        type: "object",
        properties: {
          record_type: {
            type: "string",
            enum: ["customer", "invoice", "estimate", "job_order", "project", "purchase_order", "vendor", "personnel", "vendor_bill"],
            description: "The type of record to search for"
          },
          search_query: {
            type: "string",
            description: "Search term to filter results by name, number, or other relevant fields"
          },
          filters: {
            type: "object",
            properties: {
              status: { type: "string", description: "Filter by status (e.g., 'draft', 'sent', 'paid', 'active')" },
              date_from: { type: "string", description: "Filter records created after this date (YYYY-MM-DD)" },
              date_to: { type: "string", description: "Filter records created before this date (YYYY-MM-DD)" },
              customer_name: { type: "string", description: "Filter by customer name" },
              project_name: { type: "string", description: "Filter by project name" }
            }
          },
          limit: { type: "number", description: "Maximum number of results to return (default: 10)" }
        },
        required: ["record_type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_record_details",
      description: "Get full details of a specific record by ID or number",
      parameters: {
        type: "object",
        properties: {
          record_type: {
            type: "string",
            enum: ["customer", "invoice", "estimate", "job_order", "project", "purchase_order", "vendor", "personnel", "vendor_bill"],
            description: "The type of record"
          },
          identifier: {
            type: "string",
            description: "The ID or number of the record (e.g., 'EST-2500001', 'INV-2500001', or a UUID)"
          }
        },
        required: ["record_type", "identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_statistics",
      description: "Get summary statistics about records in the system",
      parameters: {
        type: "object",
        properties: {
          stat_type: {
            type: "string",
            enum: ["unpaid_invoices", "active_projects", "pending_estimates", "open_purchase_orders", "total_revenue", "overdue_invoices"],
            description: "The type of statistic to retrieve"
          },
          date_range: {
            type: "object",
            properties: {
              from: { type: "string", description: "Start date (YYYY-MM-DD)" },
              to: { type: "string", description: "End date (YYYY-MM-DD)" }
            }
          }
        },
        required: ["stat_type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_estimate",
      description: "Create a new estimate for a customer",
      parameters: {
        type: "object",
        properties: {
          customer_id: {
            type: "string",
            description: "The UUID of the customer. Required if customer_name is for an existing customer."
          },
          customer_name: {
            type: "string",
            description: "The name of the customer"
          },
          project_id: {
            type: "string",
            description: "Optional project ID to associate with the estimate"
          },
          line_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string", description: "Line item description" },
                quantity: { type: "number", description: "Quantity" },
                unit_price: { type: "number", description: "Price per unit" },
                markup: { type: "number", description: "Markup percentage (default: 0)" }
              },
              required: ["description", "quantity", "unit_price"]
            },
            description: "Array of line items for the estimate"
          },
          notes: { type: "string", description: "Optional notes for the estimate" },
          tax_rate: { type: "number", description: "Tax rate percentage (default: 0)" },
          valid_days: { type: "number", description: "Number of days the estimate is valid (default: 30)" }
        },
        required: ["customer_name", "line_items"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "navigate_to",
      description: "Navigate to a specific page or record in the application",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path to navigate to (e.g., '/estimates', '/estimates/123', '/invoices/new')"
          }
        },
        required: ["path"]
      }
    }
  }
];

// Execute tool calls
async function executeTool(
  supabase: any,
  toolName: string,
  args: any,
  userId: string
): Promise<any> {
  console.log(`Executing tool: ${toolName}`, args);

  switch (toolName) {
    case "search_records":
      return await searchRecords(supabase, args);
    case "get_record_details":
      return await getRecordDetails(supabase, args);
    case "get_statistics":
      return await getStatistics(supabase, args);
    case "create_estimate":
      return await createEstimate(supabase, args, userId);
    case "navigate_to":
      return { action: "navigate", path: args.path };
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

async function searchRecords(supabase: any, args: any): Promise<any> {
  const { record_type, search_query, filters = {}, limit = 10 } = args;
  
  const tableMap: Record<string, string> = {
    customer: "customers",
    invoice: "invoices",
    estimate: "estimates",
    job_order: "job_orders",
    project: "projects",
    purchase_order: "purchase_orders",
    vendor: "vendors",
    personnel: "personnel",
    vendor_bill: "vendor_bills"
  };

  const table = tableMap[record_type];
  if (!table) {
    return { error: `Unknown record type: ${record_type}` };
  }

  let query = supabase.from(table).select("*").limit(limit);

  // Apply search filter based on record type
  if (search_query) {
    const searchLower = search_query.toLowerCase();
    switch (record_type) {
      case "customer":
        query = query.or(`name.ilike.%${searchLower}%,company.ilike.%${searchLower}%,email.ilike.%${searchLower}%`);
        break;
      case "invoice":
      case "estimate":
      case "job_order":
      case "purchase_order":
        query = query.or(`number.ilike.%${searchLower}%,customer_name.ilike.%${searchLower}%`);
        break;
      case "project":
        query = query.or(`name.ilike.%${searchLower}%,address.ilike.%${searchLower}%`);
        break;
      case "vendor":
        query = query.or(`name.ilike.%${searchLower}%,company.ilike.%${searchLower}%`);
        break;
      case "personnel":
        query = query.or(`first_name.ilike.%${searchLower}%,last_name.ilike.%${searchLower}%,email.ilike.%${searchLower}%`);
        break;
      case "vendor_bill":
        query = query.or(`number.ilike.%${searchLower}%,vendor_name.ilike.%${searchLower}%`);
        break;
    }
  }

  // Apply status filter
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  // Apply date filters
  if (filters.date_from) {
    query = query.gte("created_at", filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte("created_at", filters.date_to);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("Search error:", error);
    return { error: error.message };
  }

  return {
    record_type,
    count: data?.length || 0,
    results: data || []
  };
}

async function getRecordDetails(supabase: any, args: any): Promise<any> {
  const { record_type, identifier } = args;
  
  const tableMap: Record<string, string> = {
    customer: "customers",
    invoice: "invoices",
    estimate: "estimates",
    job_order: "job_orders",
    project: "projects",
    purchase_order: "purchase_orders",
    vendor: "vendors",
    personnel: "personnel",
    vendor_bill: "vendor_bills"
  };

  const table = tableMap[record_type];
  if (!table) {
    return { error: `Unknown record type: ${record_type}` };
  }

  let query = supabase.from(table).select("*");

  // Check if identifier is a UUID or a number
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  
  if (isUUID) {
    query = query.eq("id", identifier);
  } else {
    // Try to match by number field
    query = query.eq("number", identifier);
  }

  const { data, error } = await query.single();

  if (error) {
    console.error("Get details error:", error);
    return { error: error.message };
  }

  return { record_type, record: data };
}

async function getStatistics(supabase: any, args: any): Promise<any> {
  const { stat_type, date_range } = args;

  switch (stat_type) {
    case "unpaid_invoices": {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, number, customer_name, total, remaining_amount, status")
        .in("status", ["sent", "partially_paid"])
        .order("created_at", { ascending: false });
      
      if (error) return { error: error.message };
      
      const totalUnpaid = data?.reduce((sum: number, inv: any) => sum + (inv.remaining_amount || 0), 0) || 0;
      return {
        stat_type,
        count: data?.length || 0,
        total_amount: totalUnpaid,
        invoices: data?.slice(0, 5) || []
      };
    }
    case "active_projects": {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status, customer_id")
        .eq("status", "active");
      
      if (error) return { error: error.message };
      return { stat_type, count: data?.length || 0, projects: data || [] };
    }
    case "pending_estimates": {
      const { data, error } = await supabase
        .from("estimates")
        .select("id, number, customer_name, total, status")
        .eq("status", "draft");
      
      if (error) return { error: error.message };
      return { stat_type, count: data?.length || 0, estimates: data || [] };
    }
    case "open_purchase_orders": {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id, number, vendor_name, total, status")
        .in("status", ["draft", "sent", "partially_billed"]);
      
      if (error) return { error: error.message };
      return { stat_type, count: data?.length || 0, purchase_orders: data || [] };
    }
    default:
      return { error: `Unknown stat type: ${stat_type}` };
  }
}

async function createEstimate(supabase: any, args: any, userId: string): Promise<any> {
  const { customer_id, customer_name, project_id, line_items, notes, tax_rate = 0, valid_days = 30 } = args;

  // First, find or verify the customer
  let customerId = customer_id;
  
  if (!customerId && customer_name) {
    // Search for existing customer
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name")
      .ilike("name", `%${customer_name}%`)
      .limit(1);
    
    if (customers && customers.length > 0) {
      customerId = customers[0].id;
    } else {
      return {
        error: `Customer "${customer_name}" not found. Please create the customer first or provide an existing customer name.`,
        suggestion: "You can create a new customer by navigating to /customers"
      };
    }
  }

  if (!customerId) {
    return { error: "Customer ID or name is required" };
  }

  // Calculate totals
  const subtotal = line_items.reduce((sum: number, item: any) => {
    const itemTotal = item.quantity * item.unit_price * (1 + (item.markup || 0) / 100);
    return sum + itemTotal;
  }, 0);
  
  const taxAmount = subtotal * (tax_rate / 100);
  const total = subtotal + taxAmount;

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + valid_days);

  // Create the estimate
  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .insert({
      customer_id: customerId,
      customer_name: customer_name,
      project_id: project_id || null,
      notes: notes || null,
      subtotal,
      tax_rate,
      tax_amount: taxAmount,
      total,
      valid_until: validUntil.toISOString().split('T')[0],
      status: "draft",
      created_by: userId
    })
    .select()
    .single();

  if (estimateError) {
    console.error("Create estimate error:", estimateError);
    return { error: estimateError.message };
  }

  // Create line items
  const lineItemsToInsert = line_items.map((item: any, index: number) => ({
    estimate_id: estimate.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    markup: item.markup || 0,
    total: item.quantity * item.unit_price * (1 + (item.markup || 0) / 100),
    sort_order: index
  }));

  const { error: lineItemsError } = await supabase
    .from("estimate_line_items")
    .insert(lineItemsToInsert);

  if (lineItemsError) {
    console.error("Create line items error:", lineItemsError);
    // Try to clean up the estimate
    await supabase.from("estimates").delete().eq("id", estimate.id);
    return { error: lineItemsError.message };
  }

  return {
    success: true,
    estimate: {
      id: estimate.id,
      number: estimate.number,
      customer_name: customer_name,
      total,
      status: "draft"
    },
    action: "navigate",
    path: `/estimates/${estimate.id}`
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, stream = true } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get the authorization header to create supabase client
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {}
      }
    });

    // Get user ID from auth
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || "anonymous";

    // System prompt for the AI assistant
    const systemPrompt = `You are an AI assistant for Command X Construction, a construction management application. You help users manage their construction business by:

1. Searching and finding records (customers, invoices, estimates, job orders, projects, purchase orders, vendors, personnel)
2. Creating new estimates and other records
3. Providing statistics and summaries about the business
4. Answering questions about projects, customers, and financials
5. Navigating users to relevant pages

When users ask you to find or search for something, use the search_records tool.
When users ask for statistics or summaries, use the get_statistics tool.
When users ask to create an estimate, use the create_estimate tool.
When users want to view or go to a specific page, use the navigate_to tool.

Always be helpful, concise, and professional. Format monetary values with currency symbols.
When showing results, format them in a clear, readable way.
If you use a tool and get results, summarize them clearly for the user.`;

    // Make the initial request to Lovable AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools,
        stream: false, // First call non-streaming to handle tool calls
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    console.log("AI Response:", JSON.stringify(aiResponse, null, 2));

    const assistantMessage = aiResponse.choices?.[0]?.message;
    
    if (!assistantMessage) {
      return new Response(JSON.stringify({ error: "No response from AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if the AI wants to use tools
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults: any[] = [];
      const actions: any[] = [];

      for (const toolCall of assistantMessage.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await executeTool(supabase, toolCall.function.name, args, userId);
        
        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });

        // Collect any navigation actions
        if (result.action === "navigate") {
          actions.push({ type: "navigate", path: result.path });
        }
      }

      // Make a second call with the tool results
      const followUpResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            assistantMessage,
            ...toolResults
          ],
          stream: false,
        }),
      });

      if (!followUpResponse.ok) {
        const errorText = await followUpResponse.text();
        console.error("Follow-up AI error:", errorText);
        return new Response(JSON.stringify({ error: "AI processing error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const followUpData = await followUpResponse.json();
      const finalMessage = followUpData.choices?.[0]?.message?.content || "I processed your request but couldn't generate a response.";

      return new Response(JSON.stringify({
        content: finalMessage,
        actions
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No tool calls, just return the content
    return new Response(JSON.stringify({
      content: assistantMessage.content || "I'm not sure how to help with that.",
      actions: []
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI Assistant error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
