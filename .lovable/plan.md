
# Move Recently Deleted Access to Sidebar

## Overview

Remove the Recently Deleted card from the dashboard and add a "Trash" link in the sidebar's Account section instead, providing quick access from anywhere in the app.

---

## Changes Required

| File | Change |
|------|--------|
| `src/components/dashboard/rows/RowBasedDashboard.tsx` | Remove the `RecentlyDeleted` component from the layout, revert Row 6 to single-column `InvoiceAgingSummary` |
| `src/components/layout/AppSidebar.tsx` | Add "Trash" link in the Account section (visible to admins/managers) |

---

## Technical Details

### 1. Remove from Dashboard

Revert the recent change to `RowBasedDashboard.tsx`:

```tsx
// Before (current)
{/* Row 6: Invoice Aging Summary + Recently Deleted */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <InvoiceAgingSummary />
  <RecentlyDeleted />
</div>

// After
{/* Row 6: Invoice Aging Summary */}
<InvoiceAgingSummary />
```

Also remove the import:
```tsx
import { RecentlyDeleted } from "@/components/dashboard/RecentlyDeleted";
```

### 2. Add to Sidebar

In `AppSidebar.tsx`, add a Trash link to the Account section:

```tsx
// Add Trash2 to the lucide-react imports
import { Trash2 } from "lucide-react";

// Add after Audit Logs, before Document Center (visible to admin/manager only)
{(isAdmin || isManager) && (
  <SidebarMenuItem>
    <SidebarMenuButton
      asChild
      isActive={location.pathname === "/admin/trash"}
      tooltip="Trash"
      className={menuButtonClass}
    >
      <Link to="/admin/trash">
        <Trash2 className={iconClass} />
        <span>Trash</span>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
)}
```

---

## Updated Sidebar Account Section

After implementation, the Account section will include:

| Item | Visibility |
|------|------------|
| User Management | Admin or has permission |
| Permissions | Admin or has permission |
| Vendor Portal Preview | Admin only |
| Personnel Portal Preview | Admin only |
| Audit Logs | Admin or has permission |
| **Trash** | Admin or Manager |
| Document Center | Admin/Manager/Accounting or has permission |
| Activity History | All authenticated |
| Settings | All authenticated |
| Sign Out | All authenticated |

---

## Result

- Dashboard remains clean with Invoice Aging Summary as the final row
- Trash is accessible from the sidebar under Account (for admins/managers)
- Quick navigation to `/admin/trash` from anywhere in the app
