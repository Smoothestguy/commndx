
# QuickBooks Journal Entry Read Access

## Overview

Add read-only access to QuickBooks Journal Entries in Command X. This feature will allow users to view journal entries from QuickBooks without the ability to create or modify them, which is useful for reconciliation, audit purposes, and understanding adjustments made directly in QuickBooks.

## QuickBooks API Reference

The QuickBooks Online API supports querying journal entries via:
- **Endpoint**: `GET /v3/company/{realmId}/query?query=SELECT * FROM JournalEntry`
- **Entity**: `JournalEntry`
- **Key Fields**:
  - `Id` - QuickBooks ID
  - `DocNumber` - Journal entry number
  - `TxnDate` - Transaction date
  - `PrivateNote` - Internal memo
  - `Line[]` - Array of line items (debits/credits)
  - `Adjustment` - Whether it's an adjusting entry
  - `TotalAmt` - Total amount
  - `MetaData.CreateTime`, `MetaData.LastUpdatedTime`

## Implementation

### Step 1: Database Schema

Create a table to store fetched journal entries (read-only cache for viewing):

```sql
-- Journal entries table (read-only cache from QuickBooks)
CREATE TABLE quickbooks_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quickbooks_id TEXT NOT NULL UNIQUE,
  doc_number TEXT,
  txn_date DATE NOT NULL,
  private_note TEXT,
  total_amount NUMERIC(12,2) DEFAULT 0,
  is_adjustment BOOLEAN DEFAULT FALSE,
  currency_code TEXT DEFAULT 'USD',
  line_items JSONB DEFAULT '[]',
  raw_data JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS - only admins and accounting can view
ALTER TABLE quickbooks_journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and accounting can view journal entries"
  ON quickbooks_journal_entries FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'accounting')
  );

-- Index for date-based queries
CREATE INDEX idx_qb_journal_entries_txn_date ON quickbooks_journal_entries(txn_date DESC);
```

### Step 2: Edge Function

Create `supabase/functions/quickbooks-fetch-journal-entries/index.ts`:

```typescript
// Key functionality:
// 1. Query QuickBooks: SELECT * FROM JournalEntry WHERE TxnDate >= 'YYYY-MM-DD' MAXRESULTS 500
// 2. Support date filtering (default: last 90 days, configurable)
// 3. Upsert entries into quickbooks_journal_entries table
// 4. Parse line items into readable format (account name, amount, type: Debit/Credit)
// 5. Return summary: fetched count, updated count, date range
```

**Line Item Structure (parsed from QuickBooks)**:
```typescript
interface JournalEntryLine {
  lineId: string;
  description: string | null;
  accountId: string;
  accountName: string;
  amount: number;
  postingType: 'Debit' | 'Credit';
  entityType?: string; // Customer, Vendor, Employee
  entityName?: string;
}
```

### Step 3: React Hook

Add to `src/integrations/supabase/hooks/useQuickBooks.ts`:

```typescript
// useFetchJournalEntriesFromQB - mutation to trigger fetch
// useQuickBooksJournalEntries - query to list cached entries with pagination
// Date range filter support (start/end date)
```

### Step 4: UI Component

Create `src/components/quickbooks/JournalEntriesViewer.tsx`:

| Feature | Description |
|---------|-------------|
| Fetch Button | "Fetch Journal Entries" with date range picker |
| Table Display | Date, Number, Memo, Total, Debit/Credit breakdown |
| Expandable Rows | Show line item details (accounts affected) |
| Filters | Date range, adjustment entries only |
| Export | CSV download of fetched entries |

### Step 5: Add to QuickBooks Settings Page

Add a new card in `src/pages/QuickBooksSettings.tsx`:

```
┌────────────────────────────────────────────────────┐
│ 📒 Journal Entries (Read-Only)                     │
│ View journal entries from QuickBooks              │
│                                                    │
│ [Fetch Last 90 Days]  [View All →]                │
│                                                    │
│ Last fetched: Feb 6, 2026 5:30 PM                 │
│ 127 entries cached                                 │
└────────────────────────────────────────────────────┘
```

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/quickbooks-fetch-journal-entries/index.ts` | Edge function to query QB API |
| `src/components/quickbooks/JournalEntriesViewer.tsx` | UI to display and filter entries |
| `src/pages/JournalEntries.tsx` (optional) | Dedicated page for viewing entries |

## Files to Modify

| File | Changes |
|------|---------|
| `src/integrations/supabase/hooks/useQuickBooks.ts` | Add fetch/query hooks |
| `src/pages/QuickBooksSettings.tsx` | Add Journal Entries card |
| `supabase/config.toml` | Add function config with verify_jwt = false |

## Database Migration

Add the `quickbooks_journal_entries` table with appropriate RLS policies limiting access to admin, manager, and accounting roles.

## Security Considerations

- **Read-Only**: No create/update/delete operations - this is purely a viewing feature
- **RLS Protected**: Only admin, manager, and accounting roles can view entries
- **No Sensitive Data Exposure**: Raw data stored but only summary shown to users
- **Rate Limiting**: Fetch operations respect QuickBooks API limits (MAXRESULTS 500)

## Technical Details

### QuickBooks Query Pattern
```sql
SELECT * FROM JournalEntry 
WHERE TxnDate >= '2025-11-01' 
ORDER BY TxnDate DESC 
MAXRESULTS 500
```

### Line Item Parsing
QuickBooks journal entry lines have this structure:
```json
{
  "Line": [
    {
      "Id": "0",
      "Description": "Depreciation expense",
      "Amount": 500.00,
      "DetailType": "JournalEntryLineDetail",
      "JournalEntryLineDetail": {
        "PostingType": "Debit",
        "AccountRef": { "value": "123", "name": "Depreciation Expense" }
      }
    }
  ]
}
```

This will be parsed and stored as structured JSONB for easy display.

## Testing Checklist

After implementation:
- [ ] Fetch journal entries from QuickBooks
- [ ] Verify entries display with correct debits/credits
- [ ] Confirm date filtering works
- [ ] Verify RLS blocks non-admin users
- [ ] Test export to CSV
- [ ] Confirm no write operations are exposed
