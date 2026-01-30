
# Fix: QuickBooks Bill Duplicate Document Number Error

## Problem Identified

When syncing a vendor bill to QuickBooks, you received this error:

```
Duplicate Document Number Error: You must specify a different number. 
This number has already been used. DocNumber=BILL-2625476 is assigned 
to TxnType=Bill with TxnId=17250
```

## Root Cause Analysis

The investigation revealed:

1. Bill `BILL-2625476` was **already successfully synced** to QuickBooks (TxnId=17250) on January 29th
2. However, the local mapping table has `sync_status: 'syncing'` instead of `'synced'`
3. The `quickbooks-create-bill` edge function only skips creation if `sync_status === 'synced'`
4. Since status was `'syncing'`, it tried to create a new bill with the same document number, which QuickBooks rejected

This is a logic bug where the function should also check if the bill already has a QuickBooks ID before attempting to create.

## Solution

### Fix 1: Update the existing mapping record (Immediate)

Update the stuck mapping to correct status:

```sql
UPDATE quickbooks_bill_mappings 
SET sync_status = 'synced', updated_at = now()
WHERE bill_id = 'e292aed2-d08b-4d2b-a9c7-05e351fd8b58';
```

### Fix 2: Improve the edge function logic (Permanent)

Update `quickbooks-create-bill/index.ts` to check for existing QuickBooks ID, not just status:

**Current code (lines 643-653):**
```javascript
if (existingMapping && existingMapping.sync_status === 'synced') {
  // Only skips if status is exactly 'synced'
}
```

**Fixed code:**
```javascript
// Skip if already synced OR if we have a QB bill ID (indicating it exists in QB)
if (existingMapping && (existingMapping.sync_status === 'synced' || existingMapping.quickbooks_bill_id)) {
  console.log(`Bill already synced to QuickBooks: ${existingMapping.quickbooks_bill_id}`);
  
  // Update status to 'synced' if it was stuck
  if (existingMapping.sync_status !== 'synced' && existingMapping.quickbooks_bill_id) {
    await supabase
      .from('quickbooks_bill_mappings')
      .update({ sync_status: 'synced', updated_at: new Date().toISOString() })
      .eq('id', existingMapping.id);
  }
  
  return new Response(JSON.stringify({ 
    success: true, 
    message: 'Bill already synced',
    quickbooksBillId: existingMapping.quickbooks_bill_id,
    quickbooksDocNumber: existingMapping.quickbooks_doc_number,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

### Fix 3: Handle duplicate document errors gracefully

Add error handling to extract the existing bill ID from the error message and create/update the mapping:

```javascript
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  
  // Handle duplicate document number error (code 6140)
  if (errorMessage.includes('6140') || errorMessage.includes('Duplicate Document Number')) {
    // Extract the TxnId from error message
    const txnIdMatch = errorMessage.match(/TxnId=(\d+)/);
    if (txnIdMatch) {
      const existingQbBillId = txnIdMatch[1];
      console.log(`Duplicate detected - linking to existing QB Bill: ${existingQbBillId}`);
      
      // Update mapping with the existing QB ID
      await supabase
        .from('quickbooks_bill_mappings')
        .upsert({
          bill_id: billId,
          quickbooks_bill_id: existingQbBillId,
          quickbooks_doc_number: bill.number,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
          error_message: null,
        }, { onConflict: 'bill_id' });
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Linked to existing QuickBooks bill',
        quickbooksBillId: existingQbBillId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
  
  // Continue with normal error handling...
}
```

## Implementation Steps

1. **Immediate fix**: Run SQL to fix the stuck mapping record
2. **Update edge function**: Modify `quickbooks-create-bill/index.ts` with improved logic
3. **Test**: Retry the sync to verify the fix works

## Technical Details

| File | Change |
|------|--------|
| `supabase/functions/quickbooks-create-bill/index.ts` | Add check for existing QB ID + handle duplicate error gracefully |
| Database | Update stuck mapping record to `sync_status = 'synced'` |

## Files to Modify

- `supabase/functions/quickbooks-create-bill/index.ts` (lines 636-654, 812-854)

## Testing Plan

1. Run the SQL fix to update the stuck mapping
2. Deploy the updated edge function
3. Verify that re-syncing the bill no longer causes errors
4. Test with other bills that may have the same issue
