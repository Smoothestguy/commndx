## Goal
Require a Social Security card photo upload during personnel onboarding for anyone whose work authorization is:
- US Citizen
- Green Card holder
- Work Permit (EAD) holder

Visa holders and ITIN filers are unchanged.

## Where
`src/pages/PersonnelOnboarding.tsx` — Step 3 (Identification / Work Authorization).

The page already uses `CategoryDocumentUpload` with `documentType="ssn_card"` support (OCR verifies the uploaded card against the entered SSN — see `CategoryDocumentUpload.tsx`), but no section currently asks for it. We'll add it to the three sections above and gate step 3 completion on it.

## Changes

1. **UI — add SSN card upload block** to each of the three sections, placed right under the SSN input:
   ```
   <CategoryDocumentUpload
     documentType="ssn_card"
     label="Social Security Card *"
     helperText="Upload a clear photo of your Social Security card"
     required
     expectedSSN={formData.ssn_full}
     existingDocument={getDocumentByType("ssn_card")}
     onUpload={handleDocumentUpload}
     onRemove={() => handleDocumentRemove("ssn_card")}
     sessionId={sessionId}
   />
   ```
   Added inside: US Citizen block, Work Permit block, Green Card block. Visa block left as-is.

2. **Step 3 validation (`canProceed` case 3)** — require `getDocumentByType("ssn_card")` (and `isDocumentVerified("ssn_card")`, matching how govt ID is treated for US citizens) for:
   - `us_citizen`
   - `immigration_status === "green_card"`
   - `immigration_status === "work_permit"`

3. No DB/schema changes — `ssn_card` is already a valid `DocumentType` in `usePersonnelRegistrations.ts` and storage flows already handle it.

## Out of scope
- Visa holders (still SSN + visa doc only).
- ITIN / "other" status (no SSN card).
- Admin review UI — it already renders any uploaded doc type generically.
