

## ERP-Style Compact Collapsible Line Items

### Overview
Restyle the existing collapsible line items from padded card-style rows to a dense, spreadsheet-like table while keeping the expand/collapse functionality. The collapsed state becomes a tight table row; expanding inserts a compact inline edit section below.

### File to Modify
`src/components/job-orders/JobOrderForm.tsx`

### Changes

**1. Replace the Card wrapper with a Table**
- Import `Table, TableHeader, TableBody, TableRow, TableHead, TableCell` from `@/components/ui/table`
- Remove the `Card/CardHeader/CardContent` wrapper around line items
- Add a simple heading + "Add Item" button above the table

**2. Collapsed row becomes a dense table row**
Each line item renders as a compact `TableRow` with these columns:

| # | Description | Qty | Unit Price | Margin % | Total | Actions |
|---|------------|-----|-----------|---------|-------|---------|

- Styling: `text-xs`, minimal padding, cursor-pointer, hover highlight
- Chevron icon in the `#` column (e.g., `> 1` or `v 1`)
- Description truncated with CSS `truncate max-w-[200px]`
- Delete button (trash icon only, compact) in Actions column with `e.stopPropagation()`
- Clicking the row calls `toggleExpand(item.id)`

**3. Expanded row is a full-width detail row below**
- When expanded, render a second `TableRow` with a single `TableCell colSpan={7}`
- Contains the edit form in a compact `grid grid-cols-2 sm:grid-cols-3 gap-2` layout
- Light background (`bg-secondary/30`) to visually separate from data rows
- Compact padding (`p-3`), smaller labels (`text-xs`)
- All existing fields: Product selector, Description, Quantity, Unit Price, Margin, Total (read-only)
- Validation errors shown inline

**4. Keep Collapsible component for animation**
- Wrap the expanded `TableRow` content in `CollapsibleContent` for smooth open/close transitions
- The `Collapsible` wraps both rows (collapsed + expanded) using a `Fragment` approach

**5. Table header styling**
- Dark header background matching existing table patterns (`bg-[hsl(var(--table-header-bg))] text-[hsl(var(--table-header-fg))]`)
- Compact `h-8 text-xs font-semibold` headers

### Technical Details

```text
Before (current):
+------------------------------------------+
| > Item 1 — Wood Floor Labor...   $893.75 |
+------------------------------------------+
| v Item 2 — Tile Installation...  $450.00 |
|  [Product: ___________]                  |
|  [Description: ___________]              |
|  [Qty: ___] [Price: ___] [Margin: ___]   |
|  [Total: $450.00]                        |
+------------------------------------------+

After (ERP-style):
+---+-------------------+-----+--------+--------+--------+----+
| # | Description       | Qty | Price  | Margin | Total  |    |
+---+-------------------+-----+--------+--------+--------+----+
|>1 | Wood Floor Labor  | 5   | 150.00 | 19.17% | 893.75 | x  |
|v2 | Tile Installation | 10  | 40.00  | 12.50% | 450.00 | x  |
|   [Compact inline edit form with product, desc, qty...]      |
|>3 | Drywall Repair    | 2   | 200.00 | 10.00% | 400.00 | x  |
+---+-------------------+-----+--------+--------+--------+----+
```

The result: significantly denser rows, still collapsible, matching the ERP/spreadsheet style from the personnel table.
