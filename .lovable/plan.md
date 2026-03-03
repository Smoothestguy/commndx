

## Add IRS ITIN Assignment Letter Upload Requirement

### Problem
When a vendor selects "Other" immigration status and enters an ITIN, they are not currently required to upload their IRS ITIN Assignment Letter (CP565/CP567). This letter is the official proof that the IRS issued the ITIN and should be a mandatory upload alongside the ITIN number.

### Fix
Add a dedicated `CategoryDocumentUpload` field for the IRS ITIN Assignment Letter in the "Other" immigration status section, between the ITIN input and the existing work authorization document upload.

### File to Change

| File | Change |
|------|--------|
| `src/components/vendors/onboarding/VendorWorkAuthorizationForm.tsx` | Add a `CategoryDocumentUpload` with `documentType="itin_letter"`, label "IRS ITIN Assignment Letter (CP565/CP567) *" after the ITIN input field (around line 233) |

### Result
The "Other" immigration status section will require:
1. ITIN number (already exists)
2. **IRS ITIN Assignment Letter** (new)
3. Work Authorization Document (already exists)
4. Government-Issued Photo ID (already exists)

