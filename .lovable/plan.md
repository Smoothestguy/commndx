

## Rename "Purchase Orders" to "Work Orders" -- Label-Only Change

This is a cosmetic/terminology rename across the entire application. No database tables, columns, API endpoints, or code-level variable names will change. Only user-facing text (labels, titles, descriptions, PDFs, tooltips, toast messages) will be updated.

### Scope of Changes

The rename affects approximately **30+ files** across navigation, pages, components, PDFs, and utility files. Every instance of "Purchase Order" becomes "Work Order" and "PO" becomes "WO" in user-facing text only.

---

### 1. Navigation and Layout (9 files)

| File | Change |
|------|--------|
| `src/components/layout/AppSidebar.tsx` | "Purchase Orders" -> "Work Orders" |
| `src/components/layout/Sidebar.tsx` | "Purchase Orders" -> "Work Orders" |
| `src/components/layout/MobileNav.tsx` | "Purchase Orders" -> "Work Orders" |
| `src/components/layout/MoreMenu.tsx` | "Purchase Orders" -> "Work Orders" |
| `src/components/layout/BottomNav.tsx` | "New PO" -> "New WO" |
| `src/components/layout/netsuite/QuickCreateMenu.tsx` | "New Purchase Order" -> "New Work Order" |
| `src/components/layout/netsuite/MegaMenu.tsx` | "Purchase Orders" -> "Work Orders", description text |
| `src/components/layout/netsuite/MobileDrawer.tsx` | "Purchase Orders" -> "Work Orders" |
| `src/components/layout/netsuite/GlobalSearch.tsx` | "Purchase Orders" -> "Work Orders", "Create Purchase Order" -> "Create Work Order" |

### 2. Main Pages (4 files)

| File | Change |
|------|--------|
| `src/pages/PurchaseOrders.tsx` | Page title, SEO, descriptions, search placeholders, button text ("New Purchase Order" -> "New Work Order"), column header "PO #" -> "WO #" |
| `src/pages/NewPurchaseOrder.tsx` | Title "New Purchase Order" -> "New Work Order", description |
| `src/pages/EditPurchaseOrder.tsx` | Title, description references |
| `src/pages/PurchaseOrderDetail.tsx` | All toast messages ("Purchase order sent/approved/rejected"), page title references |

### 3. Purchase Order Components (6 files)

| File | Change |
|------|--------|
| `src/components/purchase-orders/PurchaseOrderEmptyState.tsx` | "No purchase orders yet/found" -> "No work orders yet/found", "Create Your First PO" -> "Create Your First WO" |
| `src/components/purchase-orders/PurchaseOrderCard.tsx` | No user-facing text changes needed (uses dynamic data) |
| `src/components/purchase-orders/PurchaseOrderFilters.tsx` | "All POs" -> "All WOs" |
| `src/components/purchase-orders/ClosePODialog.tsx` | "Close Purchase Order" -> "Close Work Order", "This PO" -> "This WO", "Close PO" -> "Close WO" |
| `src/components/purchase-orders/ReopenPODialog.tsx` | "Reopen Purchase Order" -> "Reopen Work Order", "Reopen PO" -> "Reopen WO" |
| `src/components/admin/POPreviewDialog.tsx` | "Purchase order details" -> "Work order details" |

### 4. Subcontractor Portal (4 files)

| File | Change |
|------|--------|
| `src/pages/subcontractor-portal/SubcontractorLogin.tsx` | "purchase orders" -> "work orders" in description |
| `src/pages/subcontractor-portal/SubcontractorDashboard.tsx` | "Your Purchase Orders" -> "Your Work Orders", SEO text |
| `src/pages/subcontractor-portal/SubcontractorPOList.tsx` | "My Purchase Orders" -> "My Work Orders", "No purchase orders" text |
| `src/pages/subcontractor-portal/SubcontractorPODetail.tsx` | "Purchase order not found" -> "Work order not found", SEO description |
| `src/pages/subcontractor-portal/SubcontractorNewBill.tsx` | "purchase order" references -> "work order" |

### 5. Vendor Portal (1 file)

| File | Change |
|------|--------|
| `src/pages/vendor-portal/VendorNewBill.tsx` | "purchase order" -> "work order" in descriptions, card titles, loading text |

### 6. PDF Generation (1 file)

| File | Change |
|------|--------|
| `src/utils/purchaseOrderPdfExport.ts` | "PURCHASE ORDER" header -> "WORK ORDER", "PO #" -> "WO #", "PO Total" -> "WO Total", filename prefix "PO-" -> "WO-" |

### 7. Utility and Config Files (5 files)

| File | Change |
|------|--------|
| `src/utils/activityDescriptions.ts` | "Purchase Order" -> "Work Order" in entity labels and page labels |
| `src/utils/documentSourceRoutes.ts` | "Purchase Order" -> "Work Order" |
| `src/utils/appWalkthroughPdf.ts` | Section title "12. Purchase Orders" -> "12. Work Orders", all instructional text references |
| `src/hooks/useSwipeNavigation.ts` | "Purchase Orders" -> "Work Orders" |
| `src/components/dashboard/customization/PageSelector.tsx` | "Purchase Orders" -> "Work Orders" |

### 8. Filter and Activity Components (3 files)

| File | Change |
|------|--------|
| `src/components/audit/AuditLogFilters.tsx` | "Purchase Order" -> "Work Order" |
| `src/components/activity/ActivityFilters.tsx` | "Purchase Orders" -> "Work Orders" |
| `src/integrations/supabase/hooks/useTrash.ts` | "Purchase Order" -> "Work Order" |

### 9. Admin and Other (3 files)

| File | Change |
|------|--------|
| `src/pages/admin/Trash.tsx` | "Purchase Orders" tab label -> "Work Orders" |
| `src/components/admin/UserActivityHistory.tsx` | "Purchase Order" -> "Work Order" |
| `src/integrations/supabase/hooks/useUserPermissions.ts` | "Purchase Orders" label and description |
| `src/pages/Features.tsx` | "Purchase Orders" references in feature descriptions |

### 10. Project Hub (1 file)

| File | Change |
|------|--------|
| `src/components/project-hub/ProjectPurchaseOrdersList.tsx` | "Purchase Orders" title, "No purchase orders" empty text, "Add PO" -> "Add WO" |

### 11. Job Order Detail (1 file)

| File | Change |
|------|--------|
| `src/pages/JobOrderDetail.tsx` | "New PO" button label -> "New WO" |

---

### What Will NOT Change

- Database table names (`purchase_orders`, `po_line_items`, etc.)
- Column names and foreign keys
- URL routes (`/purchase-orders`, `/purchase-orders/new`, etc.) -- kept for backward compatibility
- Component file names and import paths
- Hook names and variable names in code
- Edge function names (`send-purchase-order`, `approve-purchase-order`)
- The existing Work Order PDF export (`workOrderPdfExport.ts`) -- this is a separate field-ready document format and remains as-is

### Technical Notes

- The `purchaseOrderPdfExport.ts` generates the formal vendor-facing document. Its header changes from "PURCHASE ORDER" to "WORK ORDER" and the reference number prefix changes from "PO #" to "WO #".
- The separate `workOrderPdfExport.ts` already exists as a field-ready work order format and is unaffected.
- URL routes remain `/purchase-orders/*` to avoid breaking bookmarks, shared links, and browser history. This is purely a display-layer rename.

