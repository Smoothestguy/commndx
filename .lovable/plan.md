

## Fix: Make "Other" Immigration Status Require Documents + Photo ID (Vendor Onboarding)

Currently, when a vendor selects "Other" immigration status, the work authorization document is labeled "Optional" and no photo ID is required. This needs to match the expectation that **all** non-US citizen statuses require supporting documents.

### Changes

**File 1: `src/pages/VendorOnboarding.tsx`** — Update `canProceed()` validation for step 3

Change the "other" immigration status validation (lines 113-114) from only requiring ITIN to also requiring:
- A work authorization document (`type: "other"`)
- A photo ID document (`type: "government_id"`)

```
// Before
if (formData.immigration_status === "other") {
  return formData.itin.replace(/\D/g, "").length === 9;
}

// After
if (formData.immigration_status === "other") {
  const hasItin = formData.itin.replace(/\D/g, "").length === 9;
  const hasDoc = formData.documents?.some(d => d.type === "other");
  const hasPhotoId = formData.documents?.some(d => d.type === "government_id");
  return hasItin && !!hasDoc && !!hasPhotoId;
}
```

**File 2: `src/components/vendors/onboarding/VendorWorkAuthorizationForm.tsx`** — Update the "other" section (lines 218-234)

- Change document upload label from "Work Authorization Document (Optional)" to "Work Authorization Document *" and set `required` prop
- Add a new `CategoryDocumentUpload` for photo ID (government-issued ID) with `documentType="government_id"`

The updated "other" section will include:
1. ITIN input (already there)
2. Work Authorization Document — **required**
3. Government-Issued Photo ID — **required** (new)

### No database changes needed
The `documents` array already supports any document type, and the `complete_vendor_onboarding` function already persists all documents in the array to `vendor_documents`.

