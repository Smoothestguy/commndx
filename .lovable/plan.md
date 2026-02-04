
## What’s actually going wrong (root causes)

### 1) Command X → QuickBooks sync is likely never reaching the backend function (CORS preflight blocked)
Even though your Published site is on the latest code and the upload “succeeds”, we have:
- **Zero** backend function invocation logs
- **Zero** `quickbooks_sync_log` rows for `entity_type='bill_attachment'`

That combination strongly points to the browser **not being allowed to call** the backend function due to **CORS headers not allowing the full set of headers** that the client sends.

Your `quickbooks-sync-bill-attachment` function currently sets:
- `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`

But the web client commonly sends additional headers (e.g. `x-supabase-client-platform`, runtime/version headers). If those aren’t in `Access-Control-Allow-Headers`, the browser blocks the call at the preflight stage, so:
- No request reaches the function
- No logs show up
- The UI still shows “success” (because the file upload succeeded)

### 2) QuickBooks → Command X attachment sync is implemented, but can silently fail because the webhook’s logging uses wrong columns
In `quickbooks-webhook`, the attachment handler `processAttachableUpdate()` is present (good), but it currently logs using:
- `operation` and `metadata`

Your DB log table uses:
- `action` and `details`

So the webhook can error after processing, or error in the error-handler logging, and QuickBooks may treat the webhook delivery as failed/retry. Also, the storage upload code should be made more robust (uploading a Blob rather than raw Uint8Array to avoid type/SDK incompatibilities in Deno).

### 3) QuickBooks may not be sending “Attachable” webhook events at all
Even if the code is correct, QuickBooks webhooks must be configured to include “Attachable” events. If that checkbox/event type is not enabled in your QuickBooks app/webhook settings, then QuickBooks → Command X will never happen automatically.

Because you said “I uploaded the JPG in QuickBooks and it doesn’t show up in Command X”, we should treat “Attachable events not delivered” as a real possibility and add a fallback.

---

## Changes I will implement (so both directions work reliably)

### A) Fix CORS for `quickbooks-sync-bill-attachment` (Command X → QuickBooks)
**File:** `supabase/functions/quickbooks-sync-bill-attachment/index.ts`

1) Replace the current `corsHeaders` with the “full web-app safe” header list:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers` should include:
  - `authorization, x-client-info, apikey, content-type`
  - plus the standard client platform/runtime headers:
    - `x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version`

2) Ensure **every response** (success + all error responses) includes the CORS headers.

**Expected result:** The Published web app can finally invoke the function, producing function logs + `quickbooks_sync_log` rows.

---

### B) Improve frontend feedback so “success” can’t be misleading
**File:** `src/integrations/supabase/hooks/useVendorBillAttachments.ts`

1) Keep the non-blocking invoke, but:
- If `response.error` or `response.data?.success === false`, show a toast:
  - “Attachment uploaded, but QuickBooks sync failed” (with the reason)
- If it succeeds, show:
  - “Synced to QuickBooks”

2) Add a small retry pathway:
- Expose a `retrySyncAttachment(attachmentId, billId)` helper (same function call).
- This will allow a UI-level “Retry sync” button.

**Expected result:** You’ll immediately know whether the QuickBooks sync happened, not just the storage upload.

---

### C) Add a “Retry QuickBooks Sync” button in the UI (one-click recovery)
**File:** `src/components/shared/FileAttachmentUpload.tsx` (and/or `VendorBillAttachments.tsx`)

1) For vendor bills, render a “Retry sync” action per attachment.
2) Clicking it calls the same backend function with `{ attachmentId, billId }`.
3) Show toasts for success/failure.

**Expected result:** If QuickBooks is temporarily down or mapping was missing at upload time, you can fix it without re-uploading the file.

---

### D) Fix QuickBooks webhook attachment sync logging + harden attachment import (QuickBooks → Command X)
**File:** `supabase/functions/quickbooks-webhook/index.ts`

1) Update the attachment webhook log inserts inside `processAttachableUpdate()`:
- Replace `operation` → `action`
- Replace `metadata` → `details`

2) Make logging “non-fatal”:
- Wrap the log insert in a try/catch so logging failures never break the webhook processing.

3) Harden the storage upload:
- Convert the downloaded bytes to a `Blob` before upload (more compatible with the storage SDK in Deno).
- Add more logs around:
  - download start/end
  - upload start/end
  - DB insert start/end

**Expected result:** When QuickBooks sends an attachment webhook, Command X will import it reliably and you’ll see traceable logs.

---

### E) Add a fallback “Pull attachments from QuickBooks” endpoint (in case webhook isn’t configured for Attachable)
If QuickBooks is not delivering Attachable webhooks (common misconfiguration), we still need attachments to sync “both ways”.

**Approach:**
1) Add a backend function (new) like: `quickbooks-pull-bill-attachments`
2) Inputs: `{ billId }`
3) Server-side:
- Resolve `qbBillId` from mapping
- Query QuickBooks for attachables related to that bill (via the QB query endpoint for Attachable, or other supported lookup)
- For each attachable:
  - download TempDownloadUri
  - store in `document-attachments`
  - insert into `vendor_bill_attachments` if missing

4) Add a UI button on the bill:
- “Import attachments from QuickBooks”

**Expected result:** Even if QuickBooks doesn’t push attachment events, you can still sync on demand and keep systems consistent.

---

## How we’ll verify it end-to-end (must pass before we call it “fixed”)

### Test 1: Command X → QuickBooks
1) On the Published site, upload a JPG to BILL-2625501.
2) Confirm:
- the browser makes a request to the backend sync function (no CORS error)
- function logs show “Received request…” and “Uploading…”
- a `quickbooks_sync_log` row appears with:
  - `entity_type='bill_attachment'`
  - `action='upload'`
  - `status='success'`
3) Confirm attachment appears in QuickBooks bill attachments.

### Test 2: QuickBooks → Command X (webhook path)
1) Add an attachment directly in QuickBooks to that bill.
2) Confirm:
- webhook logs show it processed “Attachable”
- file appears in Command X attachments list

### Test 3: QuickBooks → Command X (fallback pull)
1) Click “Import attachments from QuickBooks”.
2) Confirm any missing QB attachments are brought into Command X.

---

## Notes / Constraints
- We keep your existing role checks (admin/manager) for the sync functions.
- We do not loosen database access for mappings in the client; we keep mapping resolution server-side.
- Main goal is reliability: no silent successes, and a clear retry/import path.

