
# Add Pagination to Staffing Applications Page

## Overview
Add pagination to the staffing applications page so that only 10 applications display at a time, with controls to navigate between pages and change the page size.

## Current State
- The page currently shows **all** filtered applications at once
- The `ApplicationsTable` component receives the full `filteredApplications` array
- No pagination controls exist on this page

## Solution
Reuse the existing `TablePagination` component and add pagination state to slice the applications array.

---

## Changes

### File: `src/pages/StaffingApplications.tsx`

**1. Add pagination state variables:**

```typescript
const [currentPage, setCurrentPage] = useState(1);
const [rowsPerPage, setRowsPerPage] = useState(10);
```

**2. Create paginated applications array:**

After the existing `filteredApplications` memo, add:

```typescript
const paginatedApplications = useMemo(() => {
  if (!filteredApplications) return [];
  const startIndex = (currentPage - 1) * rowsPerPage;
  return filteredApplications.slice(startIndex, startIndex + rowsPerPage);
}, [filteredApplications, currentPage, rowsPerPage]);
```

**3. Reset page when filters change:**

Add a useEffect to reset to page 1 when search/filter criteria change:

```typescript
useEffect(() => {
  setCurrentPage(1);
}, [search, projectFilter, statusFilter, experienceFilter, postingFilter]);
```

**4. Update ApplicationsTable to use paginated data:**

Change from:
```tsx
<ApplicationsTable
  applications={filteredApplications || []}
  ...
```

To:
```tsx
<ApplicationsTable
  applications={paginatedApplications}
  ...
```

**5. Add TablePagination component:**

Import and add below the ApplicationsTable:

```tsx
import { TablePagination } from "@/components/shared/TablePagination";

// After the </ApplicationsTable> and inside the Card component:
<TablePagination
  currentPage={currentPage}
  totalCount={filteredApplications?.length || 0}
  rowsPerPage={rowsPerPage}
  onPageChange={setCurrentPage}
  onRowsPerPageChange={(size) => {
    setRowsPerPage(size);
    setCurrentPage(1);
  }}
/>
```

---

## Visual Result

**Before:**
```
┌────────────────────────────────────────┐
│ Applications Table                      │
│ [All 47 applications shown at once]     │
└────────────────────────────────────────┘
```

**After:**
```
┌────────────────────────────────────────┐
│ Applications Table                      │
│ [10 applications shown]                 │
├────────────────────────────────────────┤
│ Showing 1-10 of 47  │ Rows: [10 ▼]     │
│ [◀ Previous] [1][2][3]...[5] [Next ▶]  │
└────────────────────────────────────────┘
```

---

## Summary

| Change | Description |
|--------|-------------|
| Add state | `currentPage` and `rowsPerPage` with default of 10 |
| Paginate data | Slice `filteredApplications` based on current page |
| Reset on filter | Reset to page 1 when any filter changes |
| Add UI | Add `TablePagination` below the table |
| Import | Add import for `TablePagination` component |
