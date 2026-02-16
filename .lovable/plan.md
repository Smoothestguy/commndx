

## Product Line Matching and Quantity Tracking System

### Current State Analysis

The existing architecture already has several pieces in place:
- **Import Work Order** dialog already supports product matching via `ExtractedItemsTable` with a "Match Product" dropdown
- **PO line items** already track `billed_quantity` with an auto-update trigger when vendor bill line items reference them
- **Vendor bill line items** link to PO line items via `po_line_item_id`
- **Invoice line items** link to JO line items via `jo_line_item_id`

**What's missing:**
1. Vendor bill line items have NO direct link to JO line items -- so vendor billing does not cascade up to the job order level
2. JO line items have `invoiced_quantity` (customer-facing) but no `billed_quantity` (vendor-facing)
3. The JO detail page does not show billed/remaining quantities per line item
4. There is no visual tracking of "how much of this job order has been billed by vendors"

### Plan

#### 1. Database Migration

Add a `billed_quantity` column to `job_order_line_items`:
```sql
ALTER TABLE public.job_order_line_items 
ADD COLUMN billed_quantity numeric DEFAULT 0;
```

Add a `jo_line_item_id` column to `vendor_bill_line_items`:
```sql
ALTER TABLE public.vendor_bill_line_items 
ADD COLUMN jo_line_item_id uuid REFERENCES public.job_order_line_items(id);
```

Create a trigger function `update_jo_billing_on_vendor_bill_change()` that auto-updates `job_order_line_items.billed_quantity` whenever a `vendor_bill_line_items` row is inserted, updated, or deleted -- mirroring the existing `update_po_billing_on_bill_line_item_change` pattern.

Backfill existing data: For vendor bill line items that already have a `po_line_item_id`, derive the `jo_line_item_id` by matching via the PO's `job_order_id` and matching product descriptions.

#### 2. Auto-Link Vendor Bills to JO Line Items

When creating a vendor bill from a PO (via `CreateBillFromPODialog`), the system already knows the `po_line_item_id`. Since the PO is linked to a JO (`purchase_orders.job_order_id`), auto-populate `jo_line_item_id` by matching the PO line item description/product to the corresponding JO line item.

Update the `CreateBillFromPODialog` and vendor bill creation flow to include `jo_line_item_id` when creating bill line items.

#### 3. JO Detail Page - Billed Quantity Tracking

Update the Job Line Items table on the JO detail page to show:
- **Qty** (original)
- **Billed** (from vendor bills) 
- **Remaining** (qty - billed)
- Visual progress bar per line item
- Color coding: green when fully billed, yellow when partially billed, default when unbilled

#### 4. JO Detail Page - Vendor Cost Summary

Add a "Vendor Billing" summary card to the JO detail page showing:
- Total JO Amount
- Total Billed by Vendors (sum of linked vendor bill line items)
- Remaining to Bill
- Progress percentage

#### 5. Product Matching Enhancement

The existing `ExtractedItemsTable` already has product matching UI. Enhance it by:
- Adding a "Match All by Name" button that auto-matches all items using fuzzy matching
- Showing match confidence indicators (exact match vs partial match)
- When a product is matched, auto-fill the `product_id` and `product_name` on the JO line item for future tracking

### Technical Details

#### Database Changes

```sql
-- Add billed_quantity to job_order_line_items
ALTER TABLE public.job_order_line_items 
ADD COLUMN IF NOT EXISTS billed_quantity numeric DEFAULT 0;

-- Add jo_line_item_id to vendor_bill_line_items
ALTER TABLE public.vendor_bill_line_items 
ADD COLUMN IF NOT EXISTS jo_line_item_id uuid REFERENCES public.job_order_line_items(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_vbli_jo_line_item_id 
ON public.vendor_bill_line_items(jo_line_item_id);

-- Trigger to auto-update JO billed_quantity
CREATE OR REPLACE FUNCTION public.update_jo_billing_on_vendor_bill_change()
RETURNS trigger AS $$
DECLARE
  v_jo_line_item_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_jo_line_item_id := OLD.jo_line_item_id;
  ELSE
    v_jo_line_item_id := NEW.jo_line_item_id;
  END IF;

  IF v_jo_line_item_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  UPDATE public.job_order_line_items
  SET billed_quantity = COALESCE((
    SELECT SUM(quantity) FROM public.vendor_bill_line_items
    WHERE jo_line_item_id = v_jo_line_item_id
  ), 0)
  WHERE id = v_jo_line_item_id;

  -- Handle old jo_line_item_id on UPDATE if changed
  IF TG_OP = 'UPDATE' AND OLD.jo_line_item_id IS DISTINCT FROM NEW.jo_line_item_id 
     AND OLD.jo_line_item_id IS NOT NULL THEN
    UPDATE public.job_order_line_items
    SET billed_quantity = COALESCE((
      SELECT SUM(quantity) FROM public.vendor_bill_line_items
      WHERE jo_line_item_id = OLD.jo_line_item_id
    ), 0)
    WHERE id = OLD.jo_line_item_id;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER trigger_update_jo_billing_on_vendor_bill
  AFTER INSERT OR UPDATE OR DELETE ON public.vendor_bill_line_items
  FOR EACH ROW EXECUTE FUNCTION public.update_jo_billing_on_vendor_bill_change();
```

#### Frontend Changes

| File | Change |
|------|--------|
| `src/pages/JobOrderDetail.tsx` | Add Billed/Remaining columns to line items table, add Vendor Billing summary card |
| `src/components/purchase-orders/CreateBillFromPODialog.tsx` | Auto-populate `jo_line_item_id` when creating bill from PO |
| `src/components/vendor-bills/VendorBillForm.tsx` | Support `jo_line_item_id` in line item creation |
| `src/integrations/supabase/hooks/useJobOrders.ts` | Include `billed_quantity` in JO line item type |
| `src/components/job-orders/ExtractedItemsTable.tsx` | Add "Auto-Match All" button for bulk product matching |

### Workflow Summary

```text
Work Order (PDF) --> Import --> Job Order (master quantities)
                                    |
                                    v
                              Purchase Orders (subcontractor assignments)
                                    |
                                    v
                              Vendor Bills (actual billing)
                                    |
                              jo_line_item_id links back to JO
                                    |
                                    v
                              JO billed_quantity auto-updates
                              JO detail shows remaining quantities
```

