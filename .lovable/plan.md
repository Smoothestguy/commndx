
# Implementation Plan: Locked Period Protection System

## Overview

This plan implements a comprehensive "Locked Period" system to protect reconciled QuickBooks data from accidental modification. The system will prevent creating or editing transactions dated before a configurable cutoff date (e.g., Dec 31, 2025), ensuring 2024 and 2025 reconciled data remains untouched.

## Architecture Summary

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         LOCKED PERIOD SYSTEM                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   1. DATABASE LAYER                                                     │
│   ┌─────────────────────┐                                              │
│   │ company_settings    │◀── locked_period_date (DATE)                 │
│   │                     │◀── locked_period_enabled (BOOL)              │
│   └─────────────────────┘                                              │
│                                                                         │
│   2. UI VALIDATION (Frontend)                                           │
│   ┌─────────────────────┐    ┌─────────────────────┐                   │
│   │ VendorBillForm.tsx  │    │ EditInvoice.tsx     │                   │
│   │ InvoiceForm.tsx     │    │ EditEstimate.tsx    │                   │
│   │ EstimateForm.tsx    │    │ NewPurchaseOrder    │                   │
│   └─────────────────────┘    └─────────────────────┘                   │
│            │                          │                                 │
│            ▼                          ▼                                 │
│   ┌───────────────────────────────────────────────┐                    │
│   │  useLockedPeriod() hook + validateDate()      │                    │
│   │  - Date picker restrictions                   │                    │
│   │  - Pre-submit validation                      │                    │
│   └───────────────────────────────────────────────┘                    │
│                                                                         │
│   3. EDGE FUNCTION VALIDATION (Server-side)                            │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ quickbooks-create-bill, quickbooks-create-invoice,             │  │
│   │ quickbooks-create-estimate, quickbooks-update-bill, etc.       │  │
│   │                                                                 │  │
│   │ → validateLockedPeriod(txnDate) before ANY sync to QuickBooks  │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│   4. AUDIT LOGGING                                                      │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ locked_period_violations table                                  │  │
│   │ - Logs all blocked attempts with user, entity, date            │  │
│   │ - Optional notification to admin                                │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│   5. YEAR-AWARE NUMBER GENERATION                                       │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ quickbooks-get-next-number                                      │  │
│   │ - Filter by current year prefix (e.g., INV-26, BILL-26)        │  │
│   │ - Increase MAXRESULTS for safety                                │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Database Schema Changes

**Add locked period columns to `company_settings` table:**

```sql
ALTER TABLE company_settings 
ADD COLUMN locked_period_date DATE DEFAULT NULL,
ADD COLUMN locked_period_enabled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN company_settings.locked_period_date IS 
  'Cutoff date - transactions before this date cannot be created or modified';
COMMENT ON COLUMN company_settings.locked_period_enabled IS 
  'Whether locked period enforcement is active';
```

**Create audit table for violations:**

```sql
CREATE TABLE locked_period_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL, -- 'invoice', 'vendor_bill', 'estimate', 'purchase_order'
  entity_id UUID,
  attempted_date DATE NOT NULL,
  locked_period_date DATE NOT NULL,
  action TEXT NOT NULL, -- 'create', 'update'
  blocked BOOLEAN DEFAULT TRUE,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE locked_period_violations ENABLE ROW LEVEL SECURITY;

-- Only admins can view violations
CREATE POLICY "Admins can view locked period violations"
  ON locked_period_violations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

---

### Step 2: Create Reusable Hook and Utility

**New file: `src/hooks/useLockedPeriod.ts`**

```typescript
// Provides locked period validation for UI components
export function useLockedPeriod() {
  const { data: settings } = useCompanySettings();
  
  const lockedPeriodDate = settings?.locked_period_date;
  const isEnabled = settings?.locked_period_enabled ?? false;
  
  const isDateLocked = (date: string | Date): boolean => {
    if (!isEnabled || !lockedPeriodDate) return false;
    const checkDate = typeof date === 'string' ? parseLocalDate(date) : date;
    const cutoff = parseLocalDate(lockedPeriodDate);
    return checkDate <= cutoff;
  };
  
  const validateDate = (date: string, entityType: string): 
    { valid: true } | { valid: false; message: string } => {
    if (isDateLocked(date)) {
      return {
        valid: false,
        message: `Cannot create/edit ${entityType} dated ${date}. 
          Accounting period is locked through ${lockedPeriodDate}.`
      };
    }
    return { valid: true };
  };
  
  // For date picker - return minimum allowed date
  const minAllowedDate = isEnabled && lockedPeriodDate 
    ? addDays(parseLocalDate(lockedPeriodDate), 1)
    : undefined;
  
  return { 
    isEnabled, 
    lockedPeriodDate, 
    isDateLocked, 
    validateDate,
    minAllowedDate 
  };
}
```

---

### Step 3: Update Company Settings Form

**Modify: `src/components/settings/CompanySettingsForm.tsx`**

Add a new "Accounting Controls" section with:
- Toggle switch for "Enable Locked Period"
- Date picker for "Lock transactions through" (the cutoff date)
- Warning message explaining the impact

---

### Step 4: Add UI Validation to Transaction Forms

**Update these components to use `useLockedPeriod()`:**

| Component | File Path | Date Field |
|-----------|-----------|------------|
| Vendor Bill Form | `src/components/vendor-bills/VendorBillForm.tsx` | `billDate` |
| Invoice Form | `src/components/invoices/InvoiceForm.tsx` | `invoiceDate` |
| Edit Invoice | `src/pages/EditInvoice.tsx` | `invoice.created_at` |
| Estimate Form | (multiple locations) | `estimateDate` |
| Create Bill from PO | `src/components/purchase-orders/CreateBillFromPODialog.tsx` | `billDate` |
| Create Bill from Time | `src/components/time-tracking/CreateVendorBillFromTimeDialog.tsx` | `billDate` |

**For each form:**
1. Import and use `useLockedPeriod()` hook
2. Add validation on submit - block if date is locked
3. Optionally disable/restrict date picker to prevent selection of locked dates
4. Show clear error toast when blocked

---

### Step 5: Add Server-Side Validation in Edge Functions

**Create shared validation helper: `supabase/functions/_shared/lockedPeriodValidator.ts`**

```typescript
// Validates transaction date against locked period setting
export async function validateLockedPeriod(
  supabase: any,
  txnDate: string,
  entityType: string,
  entityId: string | null,
  userId: string,
  action: 'create' | 'update'
): Promise<{ allowed: boolean; message?: string }> {
  
  // Fetch company settings
  const { data: settings } = await supabase
    .from('company_settings')
    .select('locked_period_date, locked_period_enabled')
    .single();
  
  if (!settings?.locked_period_enabled || !settings?.locked_period_date) {
    return { allowed: true };
  }
  
  const txn = new Date(txnDate);
  const cutoff = new Date(settings.locked_period_date);
  
  if (txn <= cutoff) {
    // Log the violation
    await supabase.from('locked_period_violations').insert({
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      attempted_date: txnDate,
      locked_period_date: settings.locked_period_date,
      action,
      blocked: true,
      details: { source: 'edge_function' }
    });
    
    return {
      allowed: false,
      message: `Transaction date ${txnDate} is in a locked accounting period (through ${settings.locked_period_date}). This change will not be synced to QuickBooks.`
    };
  }
  
  return { allowed: true };
}
```

**Update these edge functions to call validation before syncing:**
- `quickbooks-create-bill/index.ts`
- `quickbooks-update-bill/index.ts`
- `quickbooks-create-invoice/index.ts`
- `quickbooks-update-invoice/index.ts`
- `quickbooks-create-estimate/index.ts`
- `quickbooks-update-estimate/index.ts`
- `quickbooks-create-purchase-order/index.ts`

**Example integration in `quickbooks-create-bill/index.ts`:**
```typescript
// After fetching the bill, before syncing:
const periodCheck = await validateLockedPeriod(
  supabase,
  bill.bill_date,
  'vendor_bill',
  billId,
  authResult.userId,
  'create'
);

if (!periodCheck.allowed) {
  console.warn('Locked period violation:', periodCheck.message);
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: periodCheck.message,
      blocked_by: 'locked_period'
    }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

---

### Step 6: Fix Year-Aware Number Generation

**Update: `supabase/functions/quickbooks-get-next-number/index.ts`**

Current issue: The `extractNextNumber` function extracts trailing numbers without considering the year prefix, which could cause number collisions across years.

**Changes:**
1. Increase `MAXRESULTS` from 100 to 500 for better coverage
2. Also query the local database with a larger limit
3. Filter numbers by current year prefix when calculating next number
4. Add year-aware logic to only consider current year numbers

```typescript
function extractNextNumber(docNumbers: string[], prefix: string): string {
  const currentYear = new Date().getFullYear().toString().slice(-2); // "26"
  const yearPrefix = `${prefix}${currentYear}`; // e.g., "INV-26", "BILL-26"
  
  // Filter to only current year numbers
  const currentYearNumbers = docNumbers
    .filter(num => num && num.startsWith(yearPrefix))
    .map(num => {
      const match = num.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => n > 0);
  
  if (currentYearNumbers.length === 0) {
    // No current year numbers, start fresh
    return `${yearPrefix}00001`;
  }
  
  const maxNum = Math.max(...currentYearNumbers);
  const nextNum = maxNum + 1;
  
  // Maintain 5-digit padding
  return `${yearPrefix}${nextNum.toString().padStart(5, '0')}`;
}
```

---

### Step 7: Admin Notification for Violations (Optional Enhancement)

**Create notification trigger for locked period violations:**

When a violation is logged, optionally send a notification to admin users. This uses the existing `operational_notifications` system.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useLockedPeriod.ts` | React hook for locked period validation |
| `supabase/functions/_shared/lockedPeriodValidator.ts` | Server-side validation helper |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/settings/CompanySettingsForm.tsx` | Add locked period settings UI |
| `src/integrations/supabase/hooks/useCompanySettings.ts` | Add new fields to interface |
| `src/components/vendor-bills/VendorBillForm.tsx` | Add validation |
| `src/components/invoices/InvoiceForm.tsx` | Add validation |
| `src/pages/EditInvoice.tsx` | Add validation |
| `src/components/purchase-orders/CreateBillFromPODialog.tsx` | Add validation |
| `src/components/time-tracking/CreateVendorBillFromTimeDialog.tsx` | Add validation |
| `supabase/functions/quickbooks-create-bill/index.ts` | Add server-side check |
| `supabase/functions/quickbooks-update-bill/index.ts` | Add server-side check |
| `supabase/functions/quickbooks-create-invoice/index.ts` | Add server-side check |
| `supabase/functions/quickbooks-update-invoice/index.ts` | Add server-side check |
| `supabase/functions/quickbooks-create-estimate/index.ts` | Add server-side check |
| `supabase/functions/quickbooks-update-estimate/index.ts` | Add server-side check |
| `supabase/functions/quickbooks-get-next-number/index.ts` | Fix year-aware numbering |

## Database Migrations

1. Add `locked_period_date` and `locked_period_enabled` columns to `company_settings`
2. Create `locked_period_violations` table with RLS policies

## Security Considerations

- Locked period settings can only be modified by admin users
- Server-side validation ensures protection even if UI is bypassed
- Violations are logged for audit trail
- RLS policies restrict violation log access to admins only

## Testing Checklist

After implementation:
- [ ] Set a locked period date in Company Settings
- [ ] Attempt to create a vendor bill with a date before the cutoff
- [ ] Verify the UI blocks the action with a clear error
- [ ] Verify the edge function blocks if somehow bypassed
- [ ] Check that the violation is logged in the database
- [ ] Confirm current-year transactions work normally
- [ ] Test number generation creates unique 2026 numbers without collision
