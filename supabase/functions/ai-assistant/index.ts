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
      description: "Search for records in the system (customers, invoices, estimates, projects, job_orders, purchase_orders, vendors, personnel, products)",
      parameters: {
        type: "object",
        properties: {
          record_type: {
            type: "string",
            enum: ["customer", "invoice", "estimate", "job_order", "project", "purchase_order", "vendor", "personnel", "vendor_bill", "product"],
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
            enum: ["customer", "invoice", "estimate", "job_order", "project", "purchase_order", "vendor", "personnel", "vendor_bill", "product"],
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
      name: "create_invoice",
      description: "Create a new invoice for a customer. Use this when users want to create, add, or make a new invoice.",
      parameters: {
        type: "object",
        properties: {
          customer_id: {
            type: "string",
            description: "The UUID of the customer. Optional if customer_name is provided."
          },
          customer_name: {
            type: "string",
            description: "The name of the customer"
          },
          project_id: {
            type: "string",
            description: "Optional project ID to associate with the invoice"
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
            description: "Array of line items for the invoice"
          },
          notes: { type: "string", description: "Optional notes for the invoice" },
          tax_rate: { type: "number", description: "Tax rate percentage (default: 0)" },
          due_days: { type: "number", description: "Number of days until due (default: 30)" }
        },
        required: ["customer_name", "line_items"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "navigate_to",
      description: `Navigate to a specific page or record in the application. 

Common page aliases you should understand:
- "trash", "recently deleted", "deleted items" = /admin/trash
- "create invoice", "new invoice" = /invoices/new
- "create estimate", "new estimate" = /estimates/new
- "dashboard", "home" = /
- "audit logs", "logs" = /admin/audit-logs
- "messages", "inbox" = /messages
- "jobs" = /jobs
- "sales" = /sales
- "settings" = /settings

Available pages:
- Dashboard: /
- Estimates: /estimates (list), /estimates/new (create), /estimates/:id (view)
- Invoices: /invoices (list), /invoices/new (create), /invoices/:id (view)
- Purchase Orders: /purchase-orders (list), /purchase-orders/new (create)
- Vendor Bills: /vendor-bills (list), /vendor-bills/new (create)
- Customers: /customers (list), /customers/:id (view)
- Vendors: /vendors (list), /vendors/:id (view)
- Personnel: /personnel (list), /personnel/:id (view)
- Products: /products
- Projects: /projects (list), /projects/:id (view)
- Time Tracking: /time-tracking, /team-timesheet
- Messages: /messages, /conversations
- Jobs: /jobs
- Sales: /sales
- Settings: /settings
- Document Center: /document-center
- Expense Categories: /expense-categories
- Admin: /admin/trash (Trash/Recently Deleted), /admin/audit-logs (Audit Logs)
- Staffing: /staffing/applications, /staffing/form-templates, /staffing/map`,
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path to navigate to (e.g., '/estimates', '/estimates/123', '/invoices/new', '/admin/trash')"
          }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "show_form",
      description: "Show an interactive form to the user for creating estimates or invoices. ALWAYS use this tool when the user wants to create an estimate or invoice but hasn't provided complete details (customer name AND line items with prices). This shows a form with dropdowns for customer selection, product selection, and quantity/price inputs directly in the chat.",
      parameters: {
        type: "object",
        properties: {
          form_type: {
            type: "string",
            enum: ["create_estimate", "create_invoice"],
            description: "The type of form to show"
          },
          prefilled_customer_name: {
            type: "string",
            description: "Optional: Pre-fill the customer dropdown if the user mentioned a customer name"
          },
          prefilled_line_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "number" },
                unit_price: { type: "number" }
              }
            },
            description: "Optional: Pre-fill line items if the user mentioned any"
          }
        },
        required: ["form_type"]
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
    case "create_invoice":
      return await createInvoice(supabase, args, userId);
    case "navigate_to":
      return { action: "navigate", path: args.path };
    case "show_form":
      return { 
        action: "show_form", 
        formRequest: {
          type: args.form_type,
          prefilled: {
            customer_name: args.prefilled_customer_name,
            line_items: args.prefilled_line_items
          }
        }
      };
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
    vendor_bill: "vendor_bills",
    product: "products"
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
      case "product":
        query = query.or(`name.ilike.%${searchLower}%,description.ilike.%${searchLower}%,sku.ilike.%${searchLower}%,category.ilike.%${searchLower}%`);
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
    vendor_bill: "vendor_bills",
    product: "products"
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
  let resolvedCustomerName = customer_name;
  
  if (customerId) {
    // Get the customer name from the database to ensure consistency
    const { data: customer } = await supabase
      .from("customers")
      .select("id, name")
      .eq("id", customerId)
      .single();
    
    if (customer) {
      resolvedCustomerName = customer.name;
    }
  } else if (customer_name) {
    // Search for existing customer by name
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name")
      .ilike("name", `%${customer_name}%`)
      .limit(1);
    
    if (customers && customers.length > 0) {
      customerId = customers[0].id;
      resolvedCustomerName = customers[0].name;
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

  // Get project name if project_id is provided
  let projectName = null;
  if (project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", project_id)
      .single();
    
    if (project) {
      projectName = project.name;
    }
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

  // Create the estimate - number is auto-generated by database trigger
  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .insert({
      customer_id: customerId,
      customer_name: resolvedCustomerName,
      project_id: project_id || null,
      project_name: projectName,
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

async function createInvoice(supabase: any, args: any, userId: string): Promise<any> {
  const { customer_id, customer_name, project_id, line_items, notes, tax_rate = 0, due_days = 30 } = args;

  // First, find or verify the customer
  let customerId = customer_id;
  let resolvedCustomerName = customer_name;
  
  if (!customerId && customer_name) {
    // Search for existing customer
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name")
      .ilike("name", `%${customer_name}%`)
      .limit(1);
    
    if (customers && customers.length > 0) {
      customerId = customers[0].id;
      resolvedCustomerName = customers[0].name;
    } else {
      return {
        error: `Customer "${customer_name}" not found. Please create the customer first or provide an existing customer name.`,
        suggestion: "You can create a new customer by navigating to /customers",
        action: "navigate",
        path: "/customers"
      };
    }
  }

  if (!customerId) {
    return { error: "Customer ID or name is required" };
  }

  // Get project name if project_id is provided
  let projectName = null;
  if (project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", project_id)
      .single();
    
    if (project) {
      projectName = project.name;
    }
  }

  // Calculate totals
  const subtotal = line_items.reduce((sum: number, item: any) => {
    const itemTotal = item.quantity * item.unit_price * (1 + (item.markup || 0) / 100);
    return sum + itemTotal;
  }, 0);
  
  const taxAmount = subtotal * (tax_rate / 100);
  const total = subtotal + taxAmount;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + due_days);

  // Create the invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      customer_id: customerId,
      customer_name: resolvedCustomerName,
      project_id: project_id || null,
      project_name: projectName,
      notes: notes || null,
      subtotal,
      tax_rate,
      tax_amount: taxAmount,
      total,
      remaining_amount: total,
      due_date: dueDate.toISOString().split('T')[0],
      status: "draft",
      created_by: userId
    })
    .select()
    .single();

  if (invoiceError) {
    console.error("Create invoice error:", invoiceError);
    return { error: invoiceError.message };
  }

  // Create line items
  const lineItemsToInsert = line_items.map((item: any, index: number) => ({
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    markup: item.markup || 0,
    total: item.quantity * item.unit_price * (1 + (item.markup || 0) / 100),
    display_order: index
  }));

  const { error: lineItemsError } = await supabase
    .from("invoice_line_items")
    .insert(lineItemsToInsert);

  if (lineItemsError) {
    console.error("Create invoice line items error:", lineItemsError);
    // Try to clean up the invoice
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return { error: lineItemsError.message };
  }

  return {
    success: true,
    invoice: {
      id: invoice.id,
      number: invoice.number,
      customer_name: resolvedCustomerName,
      total,
      due_date: dueDate.toISOString().split('T')[0],
      status: "draft"
    },
    action: "navigate",
    path: `/invoices/${invoice.id}`
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { messages, formSubmission, stream = true } = body;
    
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

    // Handle direct form submissions (from inline forms)
    if (formSubmission) {
      console.log("Handling form submission:", formSubmission);
      
      let result;
      if (formSubmission.type === "create_estimate") {
        result = await createEstimate(supabase, {
          customer_id: formSubmission.customer_id,
          customer_name: formSubmission.customer_name,
          line_items: formSubmission.line_items,
          notes: formSubmission.notes,
        }, userId);
      } else if (formSubmission.type === "create_invoice") {
        result = await createInvoice(supabase, {
          customer_id: formSubmission.customer_id,
          customer_name: formSubmission.customer_name,
          line_items: formSubmission.line_items,
          notes: formSubmission.notes,
        }, userId);
      } else {
        return new Response(JSON.stringify({ error: "Unknown form type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const docType = formSubmission.type === "create_estimate" ? "Estimate" : "Invoice";
      const docNumber = result.estimate?.number || result.invoice?.number;
      const total = result.estimate?.total || result.invoice?.total;

      return new Response(JSON.stringify({
        content: `✅ **${docType} ${docNumber}** created successfully for **${formSubmission.customer_name}**!\n\nTotal: **$${total.toFixed(2)}**`,
        actions: result.path ? [{ type: "navigate", path: result.path }] : []
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // System prompt for the AI assistant
    const systemPrompt = `You are an AI assistant for a construction management application. You help users manage their construction business by:

1. Searching and finding records (customers, invoices, estimates, job orders, projects, purchase orders, vendors, personnel, products)
2. Creating new estimates and invoices
3. Providing statistics and summaries about the business
4. Answering questions about projects, customers, and financials
5. Navigating users to relevant pages

AVAILABLE PAGES YOU CAN NAVIGATE TO:
- Dashboard: /
- Estimates: /estimates (list), /estimates/new (create), /estimates/:id (view)
- Invoices: /invoices (list), /invoices/new (create), /invoices/:id (view)
- Purchase Orders: /purchase-orders (list), /purchase-orders/new (create)
- Vendor Bills: /vendor-bills (list), /vendor-bills/new (create)
- Customers: /customers (list), /customers/:id (view)
- Vendors: /vendors (list), /vendors/:id (view)
- Personnel: /personnel (list), /personnel/:id (view)
- Products: /products
- Projects: /projects (list), /projects/:id (view)
- Time Tracking: /time-tracking, /team-timesheet
- Messages: /messages, /conversations
- Jobs: /jobs
- Sales: /sales
- Settings: /settings
- Document Center: /document-center
- Expense Categories: /expense-categories
- Admin Pages:
  - Trash/Recently Deleted: /admin/trash (use for "trash", "recently deleted", "deleted items")
  - Audit Logs: /admin/audit-logs
- Staffing:
  - Applications: /staffing/applications
  - Form Templates: /staffing/form-templates
  - Map View: /staffing/map

PAGE ALIASES TO UNDERSTAND:
- "trash page", "recently deleted", "deleted items" → navigate to /admin/trash
- "dashboard", "home", "main page" → navigate to /
- "audit logs", "logs", "activity logs" → navigate to /admin/audit-logs
- "messages", "inbox", "conversations" → navigate to /messages

IMPORTANT BEHAVIORS:
- When users ask to "create an invoice" or "create an estimate" without providing BOTH a customer name AND complete line items (with quantities and prices), you MUST use the show_form tool to display an interactive form. This lets them select from dropdowns instead of typing everything.
- If the user mentions a customer name like "create an invoice for ABC Company", use show_form with prefilled_customer_name set to that name.
- Only use create_invoice or create_estimate tools directly if the user provides ALL required details: customer name, item descriptions, quantities, AND prices.
- When users ask to "go to trash" or "show recently deleted", navigate to /admin/trash
- When users mention "deleted items" or want to restore something, navigate to /admin/trash
- When users ask for statistics or summaries, use the get_statistics tool
- When users want to search for something, use the search_records tool

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
      let formRequest: any = null;

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
        
        // Collect form request (if show_form tool was used)
        if (result.action === "show_form" && result.formRequest) {
          formRequest = result.formRequest;
        }
      }
      
      // If we have a form request, return it directly without another AI call
      if (formRequest) {
        const formType = formRequest.type === "create_estimate" ? "estimate" : "invoice";
        const customerPrefix = formRequest.prefilled?.customer_name 
          ? ` for **${formRequest.prefilled.customer_name}**` 
          : "";
        
        return new Response(JSON.stringify({
          content: `Let me help you create an ${formType}${customerPrefix}. Please fill in the details below:`,
          formRequest,
          actions: []
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
