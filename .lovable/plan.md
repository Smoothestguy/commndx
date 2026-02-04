
# CommandX → QuickBooks Attachment Deletion Sync

## Summary
When you delete an attachment in CommandX, it should also be deleted from QuickBooks. Currently, deletions only happen locally - the attachment remains in QB.

---

## What Will Be Built

### 1. New Edge Function: `quickbooks-delete-bill-attachment`

A new backend function that:
- Receives the attachment ID and bill ID from CommandX
- Looks up the QuickBooks `Attachable` ID from the sync log (stored when the attachment was uploaded)
- Fetches the current `SyncToken` from QuickBooks (required for delete operations)
- Deletes the attachment in QuickBooks using the API
- Logs success or failure for audit purposes

**API Pattern (same as bill deletion):**
```text
1. GET /attachable/{id} → get SyncToken
2. POST /attachable?operation=delete with { Id, SyncToken }
```

### 2. Update Delete Hook

Modify the existing `useDeleteVendorBillAttachment` hook to:
- After successfully deleting the local attachment, call the new edge function
- Handle gracefully if the attachment was never synced to QB (no-op)
- Show a toast notification for QB sync status

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/quickbooks-delete-bill-attachment/index.ts` | **Create** | New edge function to delete attachments from QuickBooks |
| `src/integrations/supabase/hooks/useVendorBillAttachments.ts` | **Modify** | Update `useDeleteVendorBillAttachment` to call the new function |

---

## Technical Details

### Edge Function Logic

```text
quickbooks-delete-bill-attachment
├── Authenticate user (admin/manager only)
├── Receive: { attachmentId, billId }
├── Query sync log for qb_attachable_id
│   └── If not found → return success (was never synced)
├── Get QB access token (refresh if needed)
├── Fetch Attachable from QB to get SyncToken
│   └── If 404 → already deleted, mark as success
├── DELETE: POST /attachable?operation=delete
├── Log result to quickbooks_sync_log
└── Return success/failure
```

### Delete Hook Flow

```text
User clicks Delete
    ↓
Delete from Supabase Storage (file)
    ↓
Delete from vendor_bill_attachments (DB record)
    ↓
Call quickbooks-delete-bill-attachment (async, non-blocking)
    ↓
Show toast based on result
```

---

## Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| Attachment never synced to QB | Skip QB deletion, return success |
| Attachment already deleted in QB | Return success (idempotent) |
| QB API temporarily unavailable | Log error, still allow local deletion |
| User lacks permission | Return 403, block deletion |

---

## Verification Steps

After implementation:
1. Upload an attachment in CommandX to a synced bill
2. Verify it appears in QuickBooks
3. Delete the attachment in CommandX
4. Verify it's removed from both CommandX AND QuickBooks
5. Check sync log for successful deletion record
