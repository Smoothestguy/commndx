
# Fix: Bill Edit Sync Failing Due to "Labor" Item Name Conflict

## Problem Identified

When you edit a vendor bill price in Command X, the sync to QuickBooks fails with:
```
Error 6000: "You can't use Labor because Labor already exists."
```

**Root Cause:**
The `quickbooks-update-bill` function uses `"Labor"` as the item name, but in your QuickBooks, "Labor" already exists as a **Category** type (which cannot be used in bill transactions). The function tries to create a new Service item with that same name, and QuickBooks rejects it because names must be unique across all item types.

**Why `quickbooks-create-bill` works but `quickbooks-update-bill` doesn't:**
- `quickbooks-create-bill`: Uses `"Contract Labor Expense"` as item name and has robust fallback logic
- `quickbooks-update-bill`: Uses `"Labor"` and lacks proper conflict resolution

---

## Solution

Update the `getOrCreateQBServiceItem` function in `quickbooks-update-bill` to match the logic in `quickbooks-create-bill`:

1. Change item name from `"Labor"` to `"Contract Labor Expense"` for consistency
2. Add fallback logic to search for any purchasable Service item if the name is taken
3. Add timestamp-based unique name creation as final fallback

---

## Technical Changes

### File: `supabase/functions/quickbooks-update-bill/index.ts`

**Lines 254-327: Replace the `getOrCreateQBServiceItem` function**

```typescript
// Get or create a Service Item in QuickBooks for ItemBasedExpenseLineDetail
async function getOrCreateQBServiceItem(
  description: string,
  accessToken: string,
  realmId: string,
  expenseAccountRef: { value: string; name: string }
): Promise<string> {
  // Use the same name as quickbooks-create-bill for consistency
  const itemName = "Contract Labor Expense";
  
  // Check cache first
  if (itemCache.has(itemName)) {
    console.log(`Using cached Service item: ${itemName}`);
    return itemCache.get(itemName)!;
  }
  
  // Search for existing item in QuickBooks
  console.log(`Searching QuickBooks for purchasable Service item: ${itemName}`);
  
  try {
    const searchQuery = encodeURIComponent(`SELECT * FROM Item WHERE Name = '${itemName}' MAXRESULTS 10`);
    const result = await qbRequest('GET', `/query?query=${searchQuery}&minorversion=65`, accessToken, realmId);
    
    if (result.QueryResponse?.Item?.length > 0) {
      // Filter out Category and Bundle items - they cannot be used in transactions
      const validItem = result.QueryResponse.Item.find(
        (item: any) => item.Type !== 'Category' && item.Type !== 'Bundle' && item.ExpenseAccountRef?.value
      );
      
      if (validItem) {
        console.log(`Found existing purchasable Service item: ${validItem.Name} (ID: ${validItem.Id})`);
        itemCache.set(itemName, validItem.Id);
        return validItem.Id;
      }
      
      console.log(`Found item "${itemName}" but it's unusable (Category/Bundle or no ExpenseAccountRef)`);
    }
  } catch (e) {
    console.log(`Error searching for Service item: ${e}, will try to create`);
  }
  
  // Create a new Service item
  console.log(`Creating new purchasable Service item in QuickBooks: ${itemName}`);
  
  const newItem = {
    Name: itemName,
    Type: "Service",
    ExpenseAccountRef: expenseAccountRef,
  };
  
  try {
    const createResult = await qbRequest('POST', '/item?minorversion=65', accessToken, realmId, newItem);
    const itemId = createResult.Item.Id;
    console.log(`Created Service item: ${itemName} (ID: ${itemId})`);
    itemCache.set(itemName, itemId);
    return itemId;
  } catch (createError: any) {
    // Handle duplicate name error with smart fallback
    if (createError.message?.includes('Duplicate Name Exists') || 
        createError.message?.includes('6240') ||
        createError.message?.includes('6000') ||
        createError.message?.includes('already exists')) {
      
      console.log(`Name conflict detected, searching for any valid purchasable Service item...`);
      
      // Search for any Service/NonInventory item with an expense account
      const allItemsQuery = encodeURIComponent(`SELECT * FROM Item WHERE Type IN ('Service', 'NonInventory') MAXRESULTS 50`);
      const allItemsResult = await qbRequest('GET', `/query?query=${allItemsQuery}&minorversion=65`, accessToken, realmId);
      
      if (allItemsResult.QueryResponse?.Item?.length > 0) {
        // Find an item that has ExpenseAccountRef (is purchasable)
        const purchasableItem = allItemsResult.QueryResponse.Item.find(
          (item: any) => item.ExpenseAccountRef?.value && !item.Name.includes(':')
        );
        
        if (purchasableItem) {
          console.log(`Found purchasable item: ${purchasableItem.Name} (ID: ${purchasableItem.Id})`);
          itemCache.set(itemName, purchasableItem.Id);
          return purchasableItem.Id;
        }
      }
      
      // Final fallback: create with timestamp suffix to ensure unique name
      const uniqueName = `Contract Labor ${Date.now()}`;
      console.log(`Creating unique Service item as final fallback: ${uniqueName}`);
      
      const uniqueItem = {
        Name: uniqueName,
        Type: "Service",
        ExpenseAccountRef: expenseAccountRef,
      };
      
      const uniqueResult = await qbRequest('POST', '/item?minorversion=65', accessToken, realmId, uniqueItem);
      const uniqueItemId = uniqueResult.Item.Id;
      console.log(`Created unique Service item: ${uniqueName} (ID: ${uniqueItemId})`);
      itemCache.set(itemName, uniqueItemId);
      return uniqueItemId;
    }
    
    throw createError;
  }
}
```

---

## Logic Flow After Fix

```text
1. Search for "Contract Labor Expense" item
   ├── Found & purchasable (has ExpenseAccountRef) → USE IT
   └── Not found or Category/Bundle type:
       
2. Try to create "Contract Labor Expense"
   ├── Success → USE IT
   └── Name conflict (Error 6000/6240):
       
3. Search for ANY purchasable Service item
   ├── Found → USE IT
   └── Not found:
       
4. Create unique "Contract Labor [timestamp]" → USE IT
```

---

## Why This Works

| Scenario | Before (Fails) | After (Works) |
|----------|----------------|---------------|
| "Labor" is a Category | Tries to create "Labor" Service → Error 6000 | Uses "Contract Labor Expense" instead |
| "Contract Labor Expense" taken | N/A | Finds any purchasable Service item |
| No purchasable items exist | N/A | Creates unique timestamped item |

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/quickbooks-update-bill/index.ts` | Replace `getOrCreateQBServiceItem` function (lines 254-327) |

---

## Expected Outcome

After this fix:
1. Editing a bill price in Command X triggers `quickbooks-update-bill`
2. The function uses "Contract Labor Expense" as the item name
3. If that name conflicts, it finds another purchasable item or creates a unique one
4. Bill updates sync successfully to QuickBooks
