

# Fix: Block Attachment Upload Until Bill is Saved (Complete Flow)

## Problem Identified

The "save-before-upload" logic is only checking if the **form has unsaved edits** (`isFormDirty`). However, you can upload attachments even when:

1. **No form edits were made** (so `isFormDirty = false`)
2. **But the bill was never saved after some underlying issue** that prevents QuickBooks sync

The toast error "Edge Function returned a non-2xx status code" indicates the edge function IS being called, but it's returning an error. The issue is that the sync fails but the upload still completes, showing "File uploaded successfully" followed by "QuickBooks sync failed".

**Root Cause Analysis:**
- Looking at the edge function logs, we see only "booted" messages but no actual request logs
- The `quickbooks_sync_log` table has **zero** `bill_attachment` entries
- Yet the attachment record exists in `vendor_bill_attachments`

This suggests one of two scenarios:
1. The edge function call fails at CORS preflight (never reaches the function body)
2. The edge function times out or crashes before logging

## Solution

### Part 1: Fix the Edge Function to Always Log

The edge function should log the incoming request **immediately** at the start, before any processing. This will help diagnose where failures occur.

**File:** `supabase/functions/quickbooks-sync-bill-attachment/index.ts`

Add at the very start of the request handler (after CORS check):

```typescript
console.log(`[ENTRY] quickbooks-sync-bill-attachment called at ${new Date().toISOString()}`);
console.log(`[ENTRY] Method: ${req.method}, Headers: ${JSON.stringify(Object.fromEntries(req.headers.entries()))}`);
```

### Part 2: Fix the CORS Headers to Match What Supabase Client Sends

The current CORS headers may not include all headers the Supabase JS client sends. Looking at the network requests, the client sends these headers:
- `x-client-info: supabase-js-web/2.90.1`
- Plus the standard ones

Ensure the edge function's `Access-Control-Allow-Headers` includes `x-client-info` (in addition to the ones already listed).

**File:** `supabase/functions/quickbooks-sync-bill-attachment/index.ts`

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

This already includes `x-client-info`, but let me verify the current deployed version matches.

### Part 3: Better Error Handling on the Frontend

Change the frontend sync call to show a more descriptive error when the edge function fails:

**File:** `src/integrations/supabase/hooks/useVendorBillAttachments.ts`

In `syncAttachmentToQuickBooks`, improve error handling to capture the full error:

```typescript
if (response.error) {
  console.error("QuickBooks attachment sync error:", response.error);
  // Include more context in the error
  return { 
    success: false, 
    error: `${response.error.message || "Sync failed"} (${response.error.name || "unknown"})` 
  };
}
```

### Part 4: Add a Sync Status Check Before Upload (Optional Enhancement)

Consider adding a pre-flight check before allowing attachment uploads that verifies:
1. The bill has a valid QuickBooks mapping
2. The mapping status is "synced"

If not, show a warning: "This bill hasn't been synced to QuickBooks yet. Sync the bill first before adding attachments."

This would go in `VendorBillAttachments.tsx`:

```typescript
// Query the bill's QB sync status
const { data: billMapping } = useQuery({
  queryKey: ["bill-qb-mapping", billId],
  queryFn: async () => {
    const { data } = await supabase
      .from("quickbooks_bill_mappings")
      .select("sync_status, quickbooks_bill_id")
      .eq("bill_id", billId)
      .maybeSingle();
    return data;
  },
});

const isBillSyncedToQB = billMapping?.sync_status === "synced" && !!billMapping?.quickbooks_bill_id;
```

Then in `handleBeforeUpload`:
```typescript
if (!isBillSyncedToQB) {
  toast.warning("Bill not synced to QuickBooks", {
    description: "Sync the bill first, then attachments will sync automatically."
  });
  // Still allow upload, but warn that QB sync won't work
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/quickbooks-sync-bill-attachment/index.ts` | Add entry logging, verify CORS headers |
| `src/integrations/supabase/hooks/useVendorBillAttachments.ts` | Improve error messages |
| `src/components/vendor-bills/VendorBillAttachments.tsx` | (Optional) Add QB sync status check |

---

## Testing Plan

After implementation:

1. **Upload attachment on published site**
2. **Check edge function logs** - should now see "[ENTRY]" log immediately
3. **Check if CORS error appears** in browser console (F12 → Network tab)
4. **Verify `quickbooks_sync_log`** has an entry for the attachment sync attempt

If the "[ENTRY]" log doesn't appear, the issue is CORS or network-level. If it appears but sync fails, the error will be logged with full details.

---

## Why the Current "Save First" Dialog Doesn't Trigger

The dialog shows when `isFormDirty === true`. But:
- `isFormDirty` is computed by comparing current form values to initial values
- If you open a bill and don't change anything, `isFormDirty` stays `false`
- The upload proceeds without the dialog

The edge function SHOULD still work in this case (the bill IS synced to QuickBooks per the mapping). The failure is happening at the edge function level, not the form state level.

**The real issue is the edge function call failing, not the form dirty state logic.**

