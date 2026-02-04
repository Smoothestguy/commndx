
## Goal
Make vendor bill attachments reliably sync to QuickBooks for **BILL-2625501** (and all bills), even when the client cannot read QuickBooks mapping rows due to permissions/RLS, and even if the mapping data is temporarily unavailable at upload time.

## What I found (why it didn’t sync)
- The attachment record exists in the database:
  - Attachment: `59d75695-8b4b-4d1c-8685-da9cc9f2be98`
  - Bill: `facf00cb-50a9-4f51-a503-836b75be5c2a`
  - File: `vendor_bill/facf00cb-50a9-4f51-a503-836b75be5c2a/1770225387671.jpeg`
- The bill is mapped and synced:
  - `quickbooks_bill_mappings.quickbooks_bill_id = 17342`
  - `sync_status = 'synced'`
- There were **no client network requests** to `quickbooks-sync-bill-attachment` when you uploaded the file.
- That strongly suggests the client-side “should I sync?” check is preventing the call (most likely because the client can’t read `quickbooks_bill_mappings` consistently due to RLS/permissions), so the sync function never runs.

## Strategy (robust fix)
Stop relying on the browser/client to know whether a bill is synced, and stop requiring the client to pass `qbBillId`.

Instead:
1. The client always *attempts* to sync after an attachment is created.
2. The backend function `quickbooks-sync-bill-attachment` becomes the source of truth:
   - It will look up the bill’s QuickBooks mapping using service-level access.
   - It will decide whether syncing is possible and return a clear response.

This eliminates the entire class of bugs where “mapping exists but the client can’t see it”.

---

## Changes to implement

### A) Frontend: always attempt attachment sync (and don’t depend on mapping)
**File:** `src/integrations/supabase/hooks/useVendorBillAttachments.ts`

**Change:**
- After inserting the `vendor_bill_attachments` row, call:
  - `supabase.functions.invoke("quickbooks-sync-bill-attachment", { body: { attachmentId, billId } })`
- Keep forwarding the session `Authorization` header (so the function can verify the user is allowed), but do not require any mapping read on the client.

**Behavior:**
- If the bill isn’t mapped yet, the function returns a clean “not synced / no mapping” message and we log it.
- If the bill is mapped, the function uploads to QuickBooks immediately.

**UX addition (optional but recommended):**
- If the sync fails, show a toast like:
  - “Attachment uploaded, but QuickBooks sync failed. (Retry)”
- Add a “Retry QuickBooks sync” button next to each attachment (simple UI improvement) that just calls the same function again for that attachment.

---

### B) Backend function: make `qbBillId` optional; fetch mapping server-side
**File:** `supabase/functions/quickbooks-sync-bill-attachment/index.ts`

**Change request body handling:**
- Current: requires `{ attachmentId, billId, qbBillId }`
- Updated: accept `{ attachmentId, billId, qbBillId? }`

**New logic:**
1. Validate the user JWT (already done).
2. Verify user role is admin/manager (already done).
3. Load attachment by `attachmentId` (already done).
4. If `qbBillId` is missing:
   - Query `quickbooks_bill_mappings` by `billId`
   - Ensure it has:
     - `quickbooks_bill_id`
     - `sync_status` in `['synced', 'success']` (matching existing app conventions)
   - If not found or not synced:
     - Return `200` with `{ success: false, error: "Bill not synced to QuickBooks yet" }` (or `409`, but `200` is easier for non-blocking flows)
5. Proceed to upload attachment to QuickBooks with the resolved `qbBillId`.

**Logging improvements:**
- Add explicit logs:
  - “Received request: attachmentId=…, billId=…”
  - “Resolved qbBillId=…”
  - “Upload ok attachableId=…”
  - Include full error text from QuickBooks when upload fails.

**DB logging:**
- `quickbooks_sync_log` currently uses columns like `action`, `status`, `details`, etc. (not `operation`).
- Ensure attachment uploads log consistently:
  - `entity_type: "bill_attachment"`
  - `entity_id: attachmentId`
  - `action: "upload"`
  - `status: "success" | "error"`
  - `error_message` if any
  - `details` with `bill_id`, `qb_bill_id`, `file_name`, `qb_attachable_id`

---

### C) Validate the fix end-to-end
After implementation, we’ll verify:

1) **From the app**
- Open vendor bill `BILL-2625501`
- Upload a new attachment
- Confirm there is a network call to the backend function
- Confirm backend logs show it resolved qbBillId and uploaded successfully
- Confirm attachment appears on the bill in QuickBooks

2) **Retry path**
- If QuickBooks is temporarily unavailable, the UI should show a clear message and allow retry.

---

## Security considerations (kept intact)
- Function continues to require a valid user session token and checks roles (admin/manager).
- Mapping lookup happens server-side with service-level access; client does not need read access to mapping tables.

---

## Expected outcome
- Uploading an attachment to a synced vendor bill will always trigger an attempt to sync to QuickBooks.
- Sync will no longer fail silently due to client-side permission/mapping visibility issues.
- You’ll get better logs and clearer UI feedback when QuickBooks upload fails.

