

## Fix Margin Percentage Display, Negative Values, and Permission Denied

Three issues to fix, all related to Job Orders.

---

### Issue 1: Margin Percentage Not Displaying on Job Order Detail Page

**Root Cause:** The `JobOrderDetail.tsx` page does not include a "Margin" or "Markup" column in its line items table. The `markup` field is stored in the database and editable in `JobOrderForm.tsx`, but the read-only detail view never renders it. This affects all job orders equally (old and new), though the user may be comparing the project-level financial summary (which does show margin) with individual line item views.

**Fix:**
- Add a "Margin %" column to the line items table in `JobOrderDetail.tsx` (both desktop table and mobile card views)
- Display each line item's `markup` value with a `%` suffix
- Also display the calculated selling price vs cost spread for clarity

---

### Issue 2: Negative Values Allowed in Price/Quantity Fields

**Root Cause:** The `JobOrderForm.tsx` uses standard `<Input type="number">` for quantity and unit_price fields with no `min` attribute. The margin field has a `max="99.99"` but no `min="0"`.

**Fix:**
- Add `min="0"` to quantity, unit_price, and margin input fields in `JobOrderForm.tsx`
- Update the Zod validation schema: add `.min(0)` to `unit_price`
- In the `CreateJobOrderDialog.tsx`, apply the same `min="0"` constraints

---

### Issue 3: "Permission Denied" Error When Admin Edits Job Order

**Root Cause:** The RLS policies on both `job_orders` and `job_order_line_items` tables use `ALL` command policies but are missing the `WITH CHECK` clause. PostgreSQL requires `WITH CHECK` for INSERT and UPDATE operations under an ALL policy. Without it, writes are denied even though reads succeed.

Current policy:
```
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
-- WITH CHECK is NULL
```

**Fix:** Drop and recreate both ALL policies with explicit `WITH CHECK` clauses matching the `USING` clause:
```sql
USING (has_role(..., 'admin') OR has_role(..., 'manager'))
WITH CHECK (has_role(..., 'admin') OR has_role(..., 'manager'))
```

---

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/JobOrderDetail.tsx` | Add Margin % column to line items table (desktop + mobile) |
| `src/components/job-orders/JobOrderForm.tsx` | Add `min="0"` to price/qty/margin inputs; update Zod schema for `unit_price` |
| `src/components/job-orders/CreateJobOrderDialog.tsx` | Add `min="0"` to price/qty/margin inputs |
| Database migration | Fix `WITH CHECK` on `job_orders` and `job_order_line_items` ALL policies |

### Technical Details

**Margin display formula** (for the detail page):
- The `markup` field in `job_order_line_items` represents margin percentage
- Display format: `{item.markup}%` in the table cell
- Total = `qty * unit_price / (1 - markup/100)` -- this is already calculated and stored

**RLS migration SQL:**
```sql
DROP POLICY IF EXISTS "Admins and managers can manage job orders" ON job_orders;
CREATE POLICY "Admins and managers can manage job orders" ON job_orders
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Admins and managers can manage job order line items" ON job_order_line_items;
CREATE POLICY "Admins and managers can manage job order line items" ON job_order_line_items
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
```

No existing data is affected. All changes are additive or policy corrections.

