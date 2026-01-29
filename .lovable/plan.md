
# Make "Linked to Vendor" Badge Clickable

## Problem
The "Linked to Vendor" badge on the Personnel Detail page is static and not clickable. Users expect to click it to navigate to the linked vendor's detail page.

## Solution
Wrap the badge in a `Link` component from react-router-dom that navigates to the vendor's detail page using the `vendor_id`.

### Change to `src/pages/PersonnelDetail.tsx`

**Before (lines 376-381):**
```typescript
{personnel.vendor_id && (
  <Badge variant="outline" className="gap-1">
    <Building2 className="h-3 w-3" />
    Linked to Vendor
  </Badge>
)}
```

**After:**
```typescript
{personnel.vendor_id && (
  <Link to={`/vendors/${personnel.vendor_id}`}>
    <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-accent">
      <Building2 className="h-3 w-3" />
      Linked to Vendor
    </Badge>
  </Link>
)}
```

## File Changes Summary

| File | Action |
|------|--------|
| `src/pages/PersonnelDetail.tsx` | Wrap "Linked to Vendor" badge in a `Link` component to navigate to vendor detail page |

## Technical Notes
- The `Link` component is already imported from `react-router-dom` at line 1
- Added `cursor-pointer` and `hover:bg-accent` classes to provide visual feedback that the badge is clickable
- The `vendor_id` is already available on the personnel object
