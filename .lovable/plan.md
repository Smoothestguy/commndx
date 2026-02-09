

# Fix: Time Tracking "Invoice Customer" Not Using QuickBooks Numbering

## Root Cause

The `quickbooks-get-next-number` edge function requires **admin or manager role** to return a number. When a user without that role creates an invoice from time tracking, the call returns a 403 error, and `getNextInvoiceNumber()` silently falls back to the local database sequence (plain numbers like "3328" instead of QuickBooks-style "INV-2600001").

The code in `CreateCustomerInvoiceFromTimeDialog.tsx` already calls `getNextInvoiceNumber()`, so the logic is in place -- the issue is the role gate on the backend function blocking it.

## Fix

### 1. Remove role restriction from `quickbooks-get-next-number` for number generation

**File:** `supabase/functions/quickbooks-get-next-number/index.ts`

The role check (lines 43-61) will be relaxed to allow any authenticated user to fetch the next document number. Generating a sequential number is not a sensitive operation -- it doesn't modify QuickBooks data, it only reads existing document numbers to calculate the next one.

Change the authentication to verify the user is logged in but NOT require admin/manager role specifically for this function.

### 2. Improve error visibility in `getNextInvoiceNumber()`

**File:** `src/utils/invoiceNumberGenerator.ts`

Add a visible warning (toast or console) when QuickBooks number generation fails so the fallback is not silent. This helps diagnose future issues.

```typescript
if (!qbError && qbData?.nextNumber) {
  return { number: qbData.nextNumber, source: 'quickbooks' };
}
// Log clearly so we know fallback happened
console.warn('QuickBooks number generation failed, using local:', qbError || qbData?.error);
```

## Summary

| Change | File | What |
|--------|------|------|
| Remove role gate | `supabase/functions/quickbooks-get-next-number/index.ts` | Allow any authenticated user to get next number |
| Better fallback logging | `src/utils/invoiceNumberGenerator.ts` | Warn visibly when QB numbering fails |

After this fix, all invoice creation paths (including "Invoice Customer" from time tracking) will use QuickBooks numbering consistently, regardless of the user's role.

