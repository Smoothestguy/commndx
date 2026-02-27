

## Plan: Add Sync Mappings Overview Table to QuickBooks Settings

Add a new "Sync Mappings Overview" card to `QuickBooksSettings.tsx` that shows a clear table of all mapping types with their counts (total records, mapped/synced, unmapped).

### Current Data (from database)
| Entity | Total | Mapped | Unmapped |
|--------|-------|--------|----------|
| Vendors | 1,010 | 997 | 13 |
| Customers | 68 | 68 | 0 |
| Invoices | 261 | 13 | 248 |
| Estimates | 74 | 72 | 2 |
| Vendor Bills | 215 | 215 | 0 |
| Expense Categories | 104 | 92 | 12 |
| Products (Umbrellas) | 3 | 3 | 0 |

### Implementation

**File: `src/pages/QuickBooksSettings.tsx`**
- Add a new Card section titled "Sync Mappings Overview" between the sync action cards and the Journal Entries viewer
- Create a query hook (inline `useQuery`) that fetches counts from all 7 mapping tables:
  - `vendors` ↔ `quickbooks_vendor_mappings`
  - `customers` ↔ `quickbooks_customer_mappings`
  - `invoices` ↔ `quickbooks_invoice_mappings`
  - `estimates` ↔ `quickbooks_estimate_mappings`
  - `vendor_bills` ↔ `quickbooks_bill_mappings`
  - `expense_categories` ↔ `quickbooks_account_mappings`
  - `qb_product_service_mappings` (self-contained, check `quickbooks_item_id` not null)
- Display as a responsive table with columns: Entity Type, Total Records, Synced to QB, Not Synced, Sync %
- Color-code the sync percentage: green (100%), yellow (50-99%), red (<50%)
- Show a green checkmark icon for fully synced entities

### Files to Change
| File | Change |
|------|--------|
| `src/pages/QuickBooksSettings.tsx` | Add "Sync Mappings Overview" card with table after sync action cards grid |

