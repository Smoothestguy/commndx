

## Problem

Yicel (a US citizen vendor) has no documents on her vendor profile because the vendor onboarding form **does not ask US citizens to upload any documents** (like a government ID). In contrast, the personnel onboarding form requires a Government ID upload for **all** personnel regardless of citizenship status.

Currently, the vendor onboarding Work Authorization step only shows document upload fields for non-US citizens (visa, work permit, green card holders). US citizens only enter their TIN/SSN — no ID documents are collected.

## Fix

Add a **Government-Issued Photo ID** upload field to the vendor onboarding Work Authorization form for **US citizens**, matching the personnel onboarding flow.

### Files to Change

| File | Change |
|------|--------|
| `src/components/vendors/onboarding/VendorWorkAuthorizationForm.tsx` | Add a `CategoryDocumentUpload` for `government_id` inside the `us_citizen` section, after the TIN input |

### Details
- Add `CategoryDocumentUpload` with `documentType="government_id"` and label "Government-Issued Photo ID *" below the TIN input for US citizens
- This matches the personnel onboarding pattern where all personnel upload a government ID regardless of citizenship
- Documents uploaded will flow through the existing `handleDocUpload` → `formData.documents` → `complete_vendor_onboarding` → `vendor_documents` table pipeline

### Note
This fix only affects **future** onboardings. To add Yicel's documents now, you can use the "Upload Document" form on her Documents tab to manually upload her ID and any other documents.

