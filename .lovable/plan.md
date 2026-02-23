

## Fix Vendor Detail: Reveal Financial Info + Save Onboarding Documents

Two issues to fix:

---

### Issue 1: Can't View Full Financial Data

Currently the Tax ID, Routing Number, Account Number, and ITIN are permanently masked (e.g. "-----1234"). There's no way for an admin to reveal the actual values.

**Fix:** Add a "Show/Hide" toggle (eye icon button) next to each masked financial field. When clicked, it reveals the full value. Clicking again re-masks it.

**Files to change:**
- `src/pages/VendorDetail.tsx` -- Add toggle state and eye icon buttons for Tax ID, Routing Number, Account Number, and ITIN fields

---

### Issue 2: Onboarding Documents Not Saved to Database

When a vendor completes onboarding and uploads documents (visa, green card, work permit, etc.), the files are uploaded to storage but **no records are created in the `vendor_documents` table**. The `complete_vendor_onboarding` RPC function has no document-handling logic.

**Fix (two parts):**

**A. Update the database function** to accept a documents parameter and insert rows into `vendor_documents` for each uploaded file.

- Add a new migration that drops and recreates `complete_vendor_onboarding` with a `p_documents jsonb DEFAULT NULL` parameter
- Inside the function, loop through the JSON array and insert each document into `vendor_documents`

**B. Update the frontend onboarding hook** to pass the documents array to the RPC call.

- `src/integrations/supabase/hooks/useVendorOnboarding.ts` -- Add `p_documents` parameter to the `supabase.rpc()` call, serializing `formData.documents` as JSON

---

### Technical Details

**Reveal toggle implementation:**
- Add a `revealedFields` state object tracking which fields are visible
- Wrap each masked value with a conditional: show full value when revealed, masked when hidden
- Add an `Eye`/`EyeOff` icon button inline with each field

**Database migration SQL (simplified):**
```text
ALTER FUNCTION complete_vendor_onboarding -- add p_documents jsonb param
-- Inside function body, after vendor update:
IF p_documents IS NOT NULL THEN
  INSERT INTO vendor_documents (vendor_id, document_type, document_name, document_url)
  SELECT p_vendor_id, doc->>'type', doc->>'name', doc->>'path'
  FROM jsonb_array_elements(p_documents) AS doc;
END IF;
```

**Hook change:**
- Add `p_documents: JSON.stringify(formData.documents)` to the RPC parameters

