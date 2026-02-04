

# Fix: CommandX to QuickBooks Attachment Deletion

## Root Cause Identified

The edge function `quickbooks-delete-bill-attachment` is failing to find the QuickBooks Attachable ID because it's querying the sync log with the wrong action filter:

| What the code looks for | What's actually stored |
|-------------------------|------------------------|
| `action = "create"` | `action = "upload"` |

**Evidence from logs:**
```
Entity ID: 842881e1-d5e1-44e7-b73c-7e9c6bf196c2
Action: upload (not "create")  
Details: { qb_attachable_id: 74282170, ... }
```

This explains why the function logs: `"No QB Attachable ID found for attachment ... - was never synced"`

---

## Fix Required

### File: `supabase/functions/quickbooks-delete-bill-attachment/index.ts`

**Change line 219** from:
```typescript
.eq("action", "create")
```

**To:**
```typescript
.eq("action", "upload")
```

This single-line fix will allow the function to correctly find the sync log entry and retrieve the `qb_attachable_id` needed for deletion.

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/quickbooks-delete-bill-attachment/index.ts` | Change action filter from `"create"` to `"upload"` |

---

## Verification After Fix

1. Delete an attachment in CommandX
2. Check edge function logs - should now show:
   - `"Found QB Attachable ID: XXXXX"`
   - `"Successfully deleted Attachable XXXXX from QuickBooks"`
3. Verify the attachment is removed from QuickBooks

