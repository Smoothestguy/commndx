
# Fix: QuickBooks Bill Update Failing Silently

## Problem Identified

When you update a vendor bill, it shows "synced" but doesn't actually sync to QuickBooks. Investigation revealed:

1. **The `quickbooks-update-bill` function IS being called**
2. **But it fails with QuickBooks error 2500**: "An item in this transaction is set up as a **category** instead of a product or service"
3. The "Labor" item (ID: 51) used for bill line items is configured as a **category** in QuickBooks, which is invalid for transactions
4. The error is caught silently in the update hook (non-blocking), so you see "Bill updated successfully" but QB sync actually failed

## Root Cause

The edge function logs show:
```
INFO Found existing Service item: Labor (ID: 51)
ERROR Invalid Reference Id: An item in this transaction is set up as a category instead of a product or service
```

In QuickBooks Online, there are two types of Items:
- **Products/Services** (Type: "Service", "Inventory", "NonInventory") - Can be used in transactions
- **Categories** (Type: "Category") - Only for organizing, CANNOT be used in transactions

The "Labor" item (ID: 51) was likely created or modified to be a Category, making it unusable for bills.

---

## Solution

### Fix 1: QuickBooks Configuration (Immediate - Manual Action Required)

In QuickBooks Online:
1. Go to **Settings (gear icon) → Products and Services**
2. Find the "Labor" item
3. Check if it's a Category - if so, you need to either:
   - Change it to a Service type (if QuickBooks allows), OR
   - Create a NEW "Labor" service item and delete/hide the category version

### Fix 2: Update Edge Function to Handle Category Items (Code Fix)

Modify `quickbooks-update-bill/index.ts` to:
1. **Validate item type** when searching for existing items - skip items with Type="Category"
2. **Improve error handling** to provide clear feedback when QB sync fails
3. **Log sync failures** to the `quickbooks_sync_log` table

**Changes to `getOrCreateQBServiceItem` function:**

```typescript
// In the search result check, filter out Category items
if (result.QueryResponse?.Item?.length > 0) {
  // Find a valid service/product item (not a Category)
  const validItem = result.QueryResponse.Item.find(
    (item: any) => item.Type !== 'Category' && item.Type !== 'Bundle'
  );
  
  if (validItem) {
    console.log(`Found existing Service item: ${validItem.Name} (ID: ${validItem.Id})`);
    itemCache.set(itemName, validItem.Id);
    return validItem.Id;
  }
  
  console.log(`Found item "${itemName}" but it's a Category, will create new Service item`);
}
```

### Fix 3: Surface Sync Errors to the User

Update `useUpdateVendorBill` hook to display a warning toast when QB sync fails:

```typescript
} catch (qbError) {
  console.error("QuickBooks update sync error (non-blocking):", qbError);
  // Show warning to user instead of silently failing
  toast.warning("Bill saved, but QuickBooks sync failed. Check sync status.");
}
```

---

## Implementation Steps

1. **Immediate manual fix in QuickBooks:**
   - Check the "Labor" item in QuickBooks and ensure it's a Service type, not a Category
   - If it's a Category, create a new "Labor" Service item

2. **Code changes:**
   - Update `quickbooks-update-bill/index.ts` to filter out Category items
   - Update `quickbooks-create-bill/index.ts` with the same fix
   - Update `useUpdateVendorBill` hook to show toast warning on sync failure
   - Add sync failure logging to the error catch block

3. **Deploy and test:**
   - Deploy updated edge functions
   - Retry the bill update
   - Verify sync succeeds in QuickBooks

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/quickbooks-update-bill/index.ts` | Filter out Category items, improve error logging |
| `supabase/functions/quickbooks-create-bill/index.ts` | Same Category item filtering (consistency) |
| `src/integrations/supabase/hooks/useVendorBills.ts` | Show warning toast on QB sync failure |

---

## Summary

The vendor bill appears "synced" because:
1. The local database update succeeds
2. The QB sync is triggered but fails with error 2500
3. The error is caught silently (non-blocking design)

The fix requires:
1. **Manual**: Fix the "Labor" item in QuickBooks to be a Service, not a Category
2. **Code**: Add item type validation + user-facing error feedback
