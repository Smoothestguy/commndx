

# Add Recently Deleted Card to Dashboard

## Problem
The `RecentlyDeleted` component exists at `src/components/dashboard/RecentlyDeleted.tsx` but was never added to the main dashboard layout in `RowBasedDashboard.tsx`.

## Solution
Add the Recently Deleted card to the dashboard, placing it alongside the Invoice Aging Summary in a two-column layout for better visual balance.

## Changes Required

| File | Change |
|------|--------|
| `src/components/dashboard/rows/RowBasedDashboard.tsx` | Import `RecentlyDeleted` component and add it to the layout |

## New Dashboard Layout

```text
Row 1: Welcome Strip
Row 2: KPI Bar  
Row 3: Quick Actions
Row 4: Recent Invoices | Recent Activity (side by side)
Row 5: Revenue Chart
Row 6: Invoice Aging Summary | Recently Deleted (side by side) <-- NEW
```

## Technical Details

Add this import at the top:
```typescript
import { RecentlyDeleted } from "@/components/dashboard/RecentlyDeleted";
```

Replace the current Row 6 section with a two-column grid:
```typescript
{/* Row 6: Invoice Aging Summary + Recently Deleted */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <InvoiceAgingSummary />
  <RecentlyDeleted />
</div>
```

This matches the pattern already used for Row 4 (Recent Invoices + Recent Activity).

