

# Enhanced AI Assistant with Interactive Forms

## Overview
Currently, when you ask the AI to create an estimate or invoice, it asks you to type out customer names and line item details. This plan adds interactive dropdown selectors and form inputs directly in the chat, making it much faster and easier to provide the required information.

## What You'll See

Instead of this conversation:
```
You: "Create an estimate for me"
AI: "What is the customer's name and what are the line items?"
You: [type everything manually]
```

You'll get this:
```
You: "Create an estimate for me"
AI: Shows interactive form with:
   - Customer dropdown (searchable)
   - Project dropdown (based on customer)
   - "Add Line Item" section with product picker
   - Quantity and price inputs
   - Submit button
```

---

## User Experience Flow

```text
User: "I want to create an estimate"
                ↓
AI responds with an interactive form embedded in the chat:
┌────────────────────────────────────────┐
│  Let me help you create an estimate.   │
│                                        │
│  Customer: [▼ Select customer...]      │
│  Project:  [▼ Select project...]       │
│                                        │
│  Line Items:                           │
│  ┌──────────────────────────────────┐  │
│  │ [▼ Select product] Qty:[1] $[__] │  │
│  │ [+ Add another item]             │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Notes: [________________________]     │
│                                        │
│  [Create Estimate]                     │
└────────────────────────────────────────┘
```

---

## Technical Changes

### 1. Update Message Type to Support Forms

**File**: `src/contexts/AIAssistantContext.tsx`

Add a new `formRequest` field to the ChatMessage type:

```typescript
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: Array<{ type: string; path?: string; label?: string }>;
  formRequest?: {
    type: "create_estimate" | "create_invoice";
    prefilled?: {
      customer_name?: string;
      customer_id?: string;
      line_items?: Array<{ description: string; quantity: number; unit_price: number }>;
    };
  };
}
```

### 2. Create Interactive Form Components

**New File**: `src/components/ai-assistant/forms/EstimateFormInline.tsx`

A compact form component for creating estimates within the chat:
- Searchable customer combobox (using existing customer data)
- Optional project selector (filters by selected customer)
- Line item builder with product picker
- Quantity and price inputs
- Submit button that calls `sendMessage` with structured data

**New File**: `src/components/ai-assistant/forms/InvoiceFormInline.tsx`

Similar to EstimateFormInline but for invoices:
- Due date field instead of valid until
- Same customer/project/line item selection

### 3. Update ChatMessage Component

**File**: `src/components/ai-assistant/ChatMessage.tsx`

Detect when a message has `formRequest` and render the appropriate inline form:

```tsx
{message.formRequest && (
  message.formRequest.type === "create_estimate" ? (
    <EstimateFormInline 
      prefilled={message.formRequest.prefilled}
      onSubmit={handleFormSubmit}
    />
  ) : (
    <InvoiceFormInline 
      prefilled={message.formRequest.prefilled}
      onSubmit={handleFormSubmit}
    />
  )
)}
```

### 4. Update AI Assistant Edge Function

**File**: `supabase/functions/ai-assistant/index.ts`

When the AI decides to create an estimate/invoice but needs more info, instead of asking with plain text, return a `formRequest` in the response:

```typescript
// When AI needs form input
return {
  content: "Let me help you create an estimate. Please fill in the details below:",
  formRequest: {
    type: "create_estimate",
    prefilled: {
      customer_name: extractedCustomerName, // if mentioned
    }
  }
};
```

### 5. Update Context to Handle Form Submissions

**File**: `src/contexts/AIAssistantContext.tsx`

Add a new function `submitForm` that:
- Takes the filled form data
- Sends it to the AI assistant edge function with a special flag
- The edge function then executes the `create_estimate` or `create_invoice` tool directly

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/contexts/AIAssistantContext.tsx` | Modify | Add `formRequest` to message type, add `submitForm` function |
| `src/components/ai-assistant/ChatMessage.tsx` | Modify | Render inline forms when `formRequest` is present |
| `src/components/ai-assistant/forms/EstimateFormInline.tsx` | Create | Interactive estimate creation form |
| `src/components/ai-assistant/forms/InvoiceFormInline.tsx` | Create | Interactive invoice creation form |
| `src/components/ai-assistant/forms/LineItemBuilder.tsx` | Create | Reusable line item input component |
| `supabase/functions/ai-assistant/index.ts` | Modify | Return `formRequest` instead of text when collecting input |

---

## Form Components Design

### EstimateFormInline
- Uses `useCustomers()` hook for customer dropdown
- Uses `useProjectsByCustomer()` for project dropdown
- Uses `useProducts()` for product picker in line items
- Calculates subtotal/total on the fly
- On submit: sends structured data back to context

### LineItemBuilder
- Product combobox (grouped by type: Product/Service/Labor)
- Auto-fills description and price from selected product
- Manual entry also supported
- Add/remove line items
- Shows running total

---

## Example Interaction After Implementation

**User**: "Create an invoice for ABC Construction"

**AI Response** (with interactive form):
```
I'll create an invoice for ABC Construction. Please add the line items:

[Customer: ABC Construction ▼] [Project: Select... ▼]

Line Items:
┌────────────────────────────────────┐
│ Product: [Select or type...    ▼] │
│ Qty: [1]  Price: [$0.00]          │
│ [+ Add Item]                      │
└────────────────────────────────────┘

[Create Invoice]
```

---

## Prefilling Logic

The AI will attempt to prefill fields when mentioned:
- "Create an invoice for **ABC Company**" → Customer dropdown pre-selects ABC Company
- "Create an estimate with **2 hours of consulting at $150**" → Line item pre-populated
- "Create an invoice for **Project Alpha**" → Project dropdown pre-selected (and customer inferred)

