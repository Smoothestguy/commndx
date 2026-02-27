

## Plan: Add Drill-Down Detail Dialog to Sync Mappings Overview

Make each row in the Sync Mappings Overview table clickable. Clicking opens a dialog/sheet showing the actual records — split into "Synced" and "Not Synced" tabs — with key identifying info for each record.

### Implementation

**New component: `src/components/quickbooks/SyncMappingDrilldown.tsx`**
- A `Sheet` (side panel) that receives the entity type as a prop
- Two tabs: "Synced" and "Not Synced"
- For each entity type, fetches the relevant records with a LEFT JOIN approach:
  - **Vendors**: `vendors` LEFT JOIN `quickbooks_vendor_mappings` → show name, company, sync_status, last_synced_at, quickbooks_vendor_id
  - **Customers**: `customers` LEFT JOIN `quickbooks_customer_mappings` → show name, company, email, sync_status
  - **Invoices**: `invoices` LEFT JOIN `quickbooks_invoice_mappings` → show number, customer_name, total, status, sync_status
  - **Estimates**: `estimates` LEFT JOIN `quickbooks_estimate_mappings` → show number, customer_name, total, sync_status
  - **Vendor Bills**: `vendor_bills` LEFT JOIN `quickbooks_bill_mappings` → show number, vendor_name, total, status, sync_status
  - **Expense Categories**: `expense_categories` LEFT JOIN `quickbooks_account_mappings` → show name, type, mapped QB account
  - **Products (Umbrellas)**: `qb_product_service_mappings` → show name, quickbooks_item_id, quickbooks_item_type
- Each tab shows a scrollable table with a search filter
- Synced records show QB ID, sync status, and last synced timestamp
- Not Synced records show the local record info so user can identify what's missing

**Edit: `src/pages/QuickBooksSettings.tsx`**
- Add state for selected entity (`useState<string | null>`)
- Make each `TableRow` in SyncMappingsOverview clickable with `cursor-pointer` and `hover:bg-muted/50`
- On click, open the `SyncMappingDrilldown` sheet with the entity type
- Import and render the new component

### Query strategy
- Use Supabase's embedded select syntax for joins (e.g., `vendors` select `*, quickbooks_vendor_mappings(*)`)
- Filter by whether the mapping relation is null (not synced) or present (synced) based on active tab
- Limit to 200 records per tab with search filtering to keep it performant

### Files
| File | Change |
|------|--------|
| `src/components/quickbooks/SyncMappingDrilldown.tsx` | New — drill-down sheet component |
| `src/pages/QuickBooksSettings.tsx` | Add click handlers to rows, state for selected entity, render drilldown |

