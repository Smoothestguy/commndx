

## Fix: All Labor/Subcontractor Bills Should Use Item Details

### Root Cause Found

The bill BILL-2625550 for "MARIELA GAMEZ" has:
- `purchase_order_id = NULL` (not created from a PO)
- `vendor_type = 'personnel'`
- Category = "Contract Labor"
- `qb_product_mapping_id = NULL` on all line items

The current edge function logic ONLY uses Item Details when `purchase_order_id` is set. Since this bill was created directly (not from a PO), it falls through to Category Details every time.

### The Fix

Change the "billable" detection logic in both `quickbooks-create-bill` and `quickbooks-update-bill` to be smarter. A bill should use **Item Details** if ANY of these conditions are true:

1. It has a `purchase_order_id` (PO-linked) -- existing logic
2. Its line items have a `qb_product_mapping_id` set -- existing logic
3. Its expense category is a labor/subcontractor type (e.g., "Contract Labor", "Contract labor") -- NEW
4. The vendor is of type `personnel` -- NEW (backup check)

Only bills that are truly general expenses (fuel, office supplies, etc.) with non-labor categories and no product mappings should remain as Category Details.

### Technical Changes

**Files to modify:**
- `supabase/functions/quickbooks-create-bill/index.ts`
- `supabase/functions/quickbooks-update-bill/index.ts`

**Logic change in the `isBillable` determination (around line 597):**

Replace:
```
const isBillable = !!bill.purchase_order_id;
```

With expanded detection:
```
// A bill is "billable" (Item Details) if:
// 1. Linked to a PO, OR
// 2. Any line item has a qb_product_mapping_id, OR
// 3. The category is labor-related (Contract Labor, Subcontract, etc.), OR
// 4. The vendor type is 'personnel'

// Check vendor type
const vendorData = await supabase.from('vendors').select('vendor_type').eq('id', bill.vendor_id).single();
const isPersonnelVendor = vendorData?.data?.vendor_type === 'personnel';

// Check if any line item has a labor-type category
const laborCategoryNames = ['contract labor', 'subcontract', 'labor', 'temp labor'];
const hasLaborCategory = lineItems?.some(item => {
  const catName = categoryMap.get(item.category_id)?.toLowerCase() || '';
  return laborCategoryNames.some(l => catName.includes(l));
});

const hasProductMapping = lineItems?.some(item => item.qb_product_mapping_id != null);

const isBillable = !!bill.purchase_order_id || hasProductMapping || hasLaborCategory || isPersonnelVendor;
```

This ensures that labor bills like the one for MARIELA GAMEZ (personnel vendor, "Contract Labor" category) will automatically use Item Details and get the auto-resolved QB Service Item, even without a PO link.

### What Won't Change
- Bills for truly non-labor expenses (fuel, office supplies, general overhead) will continue using Category Details
- The auto-resolve logic for finding/creating QB Service Items stays the same
- The existing PO-linked detection still works as before
