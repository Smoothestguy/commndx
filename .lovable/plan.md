
# Enhancing AI Assistant Capabilities

## Problem Summary
The AI Assistant is too limited in its abilities:
1. **Navigation**: Doesn't know about all available pages (e.g., `/admin/trash`, `/messages`, `/jobs`, `/sales`, etc.)
2. **Invoice Creation**: Only has a `create_estimate` tool, no `create_invoice` tool
3. **System Prompt**: Doesn't give the AI enough context about what routes exist

## Solution Overview

Expand the AI assistant's capabilities with:
1. A comprehensive navigation route list in the system prompt
2. A new `create_invoice` tool for creating invoices
3. Better understanding of page aliases (e.g., "trash page" = "/admin/trash", "recently deleted" = "/admin/trash")

---

## Technical Changes

### 1. Enhanced System Prompt with Complete Route Map

Add a comprehensive list of all navigable pages to the system prompt:

```text
Available pages you can navigate to:
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
  - Trash/Recently Deleted: /admin/trash
  - Audit Logs: /admin/audit-logs
- Staffing:
  - Applications: /staffing/applications
  - Form Templates: /staffing/form-templates
  - Map View: /staffing/map
```

### 2. New `create_invoice` Tool

Add a tool similar to `create_estimate` that creates invoices:

```typescript
{
  type: "function",
  function: {
    name: "create_invoice",
    description: "Create a new invoice for a customer. Use this when users want to create, add, or make a new invoice.",
    parameters: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "The UUID of the customer" },
        customer_name: { type: "string", description: "The name of the customer" },
        project_id: { type: "string", description: "Optional project ID" },
        line_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number" },
              unit_price: { type: "number" },
              markup: { type: "number" }
            },
            required: ["description", "quantity", "unit_price"]
          }
        },
        notes: { type: "string" },
        tax_rate: { type: "number" },
        due_days: { type: "number", description: "Days until due (default: 30)" }
      },
      required: ["customer_name", "line_items"]
    }
  }
}
```

### 3. Enhanced `navigate_to` Tool Description

Update the tool to be more helpful:

```typescript
{
  name: "navigate_to",
  description: "Navigate to a specific page in the application. Common page aliases: 'trash' or 'recently deleted' = '/admin/trash', 'create invoice' = '/invoices/new', 'create estimate' = '/estimates/new', 'dashboard' or 'home' = '/'",
  parameters: {
    // ... existing
  }
}
```

### 4. Implement `createInvoice` Function

Similar to `createEstimate`, handles:
- Customer lookup by name
- Line item calculation (subtotal, tax, total)
- Due date calculation
- Invoice creation with line items
- Returns navigation action to view the new invoice

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/ai-assistant/index.ts` | Add `create_invoice` tool definition, implement `createInvoice` function, expand system prompt with route map |

---

## User Experience After Fix

| User Says | AI Does |
|-----------|---------|
| "Take me to trash page" | Navigates to `/admin/trash` |
| "I want to create an invoice" | Either navigates to `/invoices/new` or asks for details (customer, items) and creates it directly |
| "Show me recently deleted items" | Navigates to `/admin/trash` |
| "Create an invoice for ABC Company for $500 consulting" | Creates the invoice with the specified details |
| "Go to messages" | Navigates to `/messages` |
| "Take me to the audit logs" | Navigates to `/admin/audit-logs` |

---

## Implementation Summary

1. Expand the system prompt with a comprehensive route directory
2. Add page aliases so natural language like "trash page" works
3. Add `create_invoice` tool so the AI can create invoices (not just estimates)
4. Implement `createInvoice` function with full invoice creation logic
5. Update tool descriptions to include common aliases
