
# Show Invoice Status per Project in Time Tracking

## Overview

Add an invoice status indicator to each project row in the Time Tracking table. If all time entries for that project/week are already invoiced, show an "Invoiced" badge. If some or none are invoiced, show an "Uninvoiced" alert badge to remind you to invoice.

## How It Works

Each time entry already has an `invoice_id` field that gets set when an invoice is created. The logic will check all entries within a project group:

- **All entries have `invoice_id`** -- Show a green "Invoiced" badge
- **Some entries have `invoice_id`** -- Show an orange "Partially Invoiced" badge  
- **No entries have `invoice_id`** -- Show a yellow/amber "Uninvoiced" badge as a reminder

## Changes

### File: `src/components/time-tracking/ProjectTimeEntriesTable.tsx`

1. **Add invoice status calculation to ProjectGroup interface** -- Add an `invoiceStatus` field (`'invoiced' | 'partial' | 'uninvoiced'`) computed during the grouping logic based on whether entries have `invoice_id` set.

2. **Replace the empty Status `<TableCell>` on line 1003** with a badge showing the invoice status:
   - Invoiced: Green badge with checkmark icon
   - Partially Invoiced: Orange badge  
   - Uninvoiced: Amber/yellow badge to alert you

3. **Add the same status to the mobile card view** (around line 623) so it appears on both desktop and mobile.

### Visual Design

```text
Desktop table Status column:
  [check] Invoiced        (green badge)
  [!] Partially Invoiced  (orange badge)  
  [!] Uninvoiced          (amber badge, acts as reminder)
```

### Technical Detail

The calculation in the `projectGroups` useMemo:

```typescript
// After building project entries
const invoicedCount = project.entries.filter(e => e.invoice_id).length;
const totalCount = project.entries.length;
project.invoiceStatus = invoicedCount === totalCount 
  ? 'invoiced' 
  : invoicedCount > 0 
    ? 'partial' 
    : 'uninvoiced';
```

No new database queries needed -- the `invoice_id` field is already fetched with time entries.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/time-tracking/ProjectTimeEntriesTable.tsx` | Add `invoiceStatus` to ProjectGroup, render status badge in both desktop and mobile views |
