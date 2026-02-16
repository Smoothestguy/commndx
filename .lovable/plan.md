

## Map Regular/Overtime Hours to Correct QuickBooks Service Items

### Current Behavior
All labor bill line items (both regular and overtime) are mapped to the same generic QB service item (e.g., "Subcontract Labor Flooring") because the code resolves a single `resolvedQBItemId` and applies it to every line.

### Desired Behavior
- **Regular Hours** lines (description contains "Regular Hours") should map to **"Temp Labor - Reg Time"**
- **Overtime Hours** lines (description contains "Overtime Hours") should map to **"Temp Labor - OT"**

### Technical Changes

**Files to modify:**
- `supabase/functions/quickbooks-create-bill/index.ts`
- `supabase/functions/quickbooks-update-bill/index.ts`

**Changes (same in both files):**

1. **Replace single-item resolution with dual-item resolution** -- Instead of resolving one `resolvedQBItemId` for all lines, resolve two:
   - `regTimeQBItemId` -- searched/cached as "Temp Labor - Reg Time"
   - `otQBItemId` -- searched/cached as "Temp Labor - OT"

2. **QB Item lookup logic** -- For each of the two items:
   - First check `qb_product_service_mappings` for a cached mapping with matching name
   - Then search QuickBooks: `SELECT * FROM Item WHERE Name = 'Temp Labor - Reg Time' AND Type = 'Service'`
   - If not found, create it in QuickBooks as a new Service item
   - Cache the QB Item ID back to mappings for future use

3. **Per-line-item mapping** -- In the line item loop (around line 769), determine which QB item to use based on description:
   ```
   if description contains "Overtime Hours" -> use otQBItemId
   else if description contains "Regular Hours" -> use regTimeQBItemId
   else -> use regTimeQBItemId as default fallback
   ```

4. **Keep existing PO/product-mapping logic intact** -- If a line item already has a specific `qb_product_mapping_id` with a resolved QB item, that still takes priority over the reg/OT auto-detection.

### Example Result in QuickBooks

| # | PRODUCT/SERVICE | DESCRIPTION |
|---|----------------|-------------|
| 1 | Temp Labor - Reg Time | MARIELA GAMEZ - Regular Hours - 40 x $27.00 |
| 2 | Temp Labor - OT | MARIELA GAMEZ - Overtime Hours - 44 x $40.50 |

