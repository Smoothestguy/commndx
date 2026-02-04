
## What’s actually happening (root cause)

- Your webhook function **is receiving “Bill Update” events** (we see those in the `quickbooks-webhook` logs), but there are **no “Attachable … Delete” logs at all**.
- The attachment record still exists locally:
  - `vendor_bill_attachments` still contains attachment `28fe019a-6515-49fd-abdb-898624bac927` for bill `facf00cb-50a9-4f51-a503-836b75be5c2a`.
- This strongly indicates QuickBooks is **not sending an `Attachable` webhook Delete** when you remove an attachment from within the Bill UI. Instead, it likely only emits a **Bill Update**.

So the current “delete attachment on `Attachable/Delete`” logic can be correct and still never run.

## Goal (confirmed)
When an attachment is deleted in QuickBooks, it should be deleted in CommandX (file + DB record), as part of bidirectional sync.

---

## Implementation approach

### A) Add “attachment reconciliation” on `Bill` webhook updates (primary fix)

When `processBillUpdate()` runs for operation `"Update"`:
1. **Query QuickBooks for the current set of attachments linked to this bill** using the QuickBooks query endpoint:
   - `SELECT * FROM Attachable WHERE AttachableRef.EntityRef.Type = 'Bill' AND AttachableRef.EntityRef.value = '${qbBillId}'`
   - (This exact query already exists in `quickbooks-pull-bill-attachments`; we’ll reuse the same pattern inside the webhook.)

2. **Load local attachments** from `vendor_bill_attachments` for `mapping.bill_id`.

3. **Decide which local attachments should be deleted** by comparing to what QuickBooks currently has:
   - Build `qbAttachableIdsSet` (Attachable.Id values from QB) and `qbFileNamesSet` (Attachable.FileName values).
   - For each local attachment:
     - If it’s QB-sourced (ex: `file_path` contains `-qb-`):
       - Try to match by qb id embedded in file_path OR by `file_name` in `qbFileNamesSet`.
       - If not present in QB, mark for deletion.
     - If it’s CommandX-uploaded (`uploaded_by` not null):
       - Fetch the latest `quickbooks_sync_log` row for `entity_type='bill_attachment'` and `entity_id = attachment.id` to get `details.qb_attachable_id`.
       - If we have a `qb_attachable_id` and it is NOT in `qbAttachableIdsSet`, mark for deletion.
       - If there is no successful upload log yet, skip (it may be a local-only unsynced attachment).

4. For every attachment marked for deletion:
   - Remove file from storage bucket `document-attachments` using `file_path`
   - Delete the `vendor_bill_attachments` row
   - Write a `quickbooks_sync_log` entry noting `webhook_reconcile_delete` with details including `qb_bill_id`, `qb_attachable_ids_current`, and deleted local attachment id.

5. Add **clear logging** in the webhook output so we can confirm reconciliation ran:
   - Number of QB attachables found
   - Number of local attachments found
   - Which ones were deleted and why

Why this works:
- Even if QuickBooks never sends an `Attachable/Delete` webhook, a Bill Update will still arrive when you “Save” the Bill after deleting the attachment.
- The webhook can then reconcile the state and delete the missing attachment locally.

### B) Keep the `Attachable/Delete` handler (secondary path / still valuable)

We keep your existing `processAttachableUpdate(... operation === "Delete")` logic as a fast path for cases where QuickBooks *does* send the Attachable delete notification (some accounts / contexts do).

### C) UI “still shows it” even after deletion: ensure the list updates automatically (quality-of-life fix)

Right now the attachments UI is React Query fetching `vendor_bill_attachments`, but:
- When the webhook deletes an attachment, the client won’t know unless:
  - the user refreshes / navigates away and back, or
  - we subscribe to backend changes.

Add a realtime subscription (server push) in `useVendorBillAttachments()`:
- Subscribe to Postgres changes on `vendor_bill_attachments` filtered to the current `bill_id`
- On any INSERT/UPDATE/DELETE, call `queryClient.invalidateQueries(["vendor-bill-attachments", billId])`

This makes the UI reflect webhook-driven deletes almost immediately.

---

## Files that will be changed

1. `supabase/functions/quickbooks-webhook/index.ts`
   - Add `queryQBAttachables()` helper (same technique as in `quickbooks-pull-bill-attachments`)
   - Add `reconcileBillAttachmentsAfterBillUpdate()` helper
   - Call reconciliation at the end of `processBillUpdate()` for operation `"Update"` (after the existing bill update + mapping update)
   - Improve logs around “Attachable Delete” processing so debugging is easier

2. `src/integrations/supabase/hooks/useVendorBillAttachments.ts`
   - Add realtime subscription to invalidate the attachments query on DB changes for the bill

---

## Step-by-step verification plan (how we’ll prove it’s fixed)

1. Identify the bill: `facf00cb-50a9-4f51-a503-836b75be5c2a` mapped to QB bill `17342`.
2. Confirm in QuickBooks there is an attachment; delete it and click Save.
3. Check `quickbooks-webhook` logs for:
   - “Processing bill 17342, operation: Update”
   - New reconciliation logs:
     - “Found X attachables in QuickBooks”
     - “Deleting local attachment … because missing in QuickBooks”
4. Confirm the attachment row disappears from `vendor_bill_attachments` for that bill.
5. Confirm the UI updates without manual refresh (realtime invalidation).

---

## Edge cases handled

- Multiple attachments with same filename:
  - Prefer matching by `qb_attachable_id` when we have it (from sync logs).
  - File-name matching is used only as fallback.
- Local attachment not yet synced (no successful upload log):
  - Do not delete it during reconciliation.
- Storage delete fails:
  - We will log it; DB deletion can proceed to prevent “ghost items” in UI. (Optionally we can skip DB delete if storage delete fails, but that tends to leave broken UI state.)

---

## Notes about your earlier expectation (“delete the whole bill”)
Your `processBillUpdate()` already hard-deletes the entire bill only on `Bill` operation `"Delete"` or `"Void"`. Deleting an attachment should not delete the bill; we will keep that behavior unchanged.

---

## Deliverables

- Attachment deletions in QuickBooks will reliably remove the attachment locally even if QuickBooks only sends a Bill Update webhook.
- CommandX UI updates automatically after webhook-driven deletes.
