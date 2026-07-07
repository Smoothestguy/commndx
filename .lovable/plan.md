# Fix W-9 PDF Generation Issues

Jeison Vivas's generated W-9 shows two real bugs plus cosmetic issues.

## Bugs to fix

### 1. SSN missing from Part I
The SSN boxes render empty even though the personnel record has an SSN on file. `src/lib/generateW9.ts` (or the W-9 rendering path used at signing/download time) is not writing `ssnFull` (or the 9 individual digits) into the TIN grid.

**Fix:** In the W-9 PDF generator, read the SSN from the `personnel_w9_forms` row (`ssn_full`, falling back to `ssn_last_four` only if full is unavailable) and place each digit into its box in Part I. If only last-four is stored, leave the first 5 boxes blank rather than silently rendering an all-empty TIN.

### 2. Line 2 "Business name" wrongly populated with "Fairfield"
For an Individual/sole proprietor with no DBA, line 2 must be blank. "Fairfield" is the *requester's* company name — it's leaking from company settings into the payee's DBA field.

**Fix:** In `W9TaxForm` / `generateW9.ts`, source line 2 exclusively from the personnel W-9 record's `business_name` field. Never fall back to `company_settings.name` or the requester name. If `business_name` is null/empty, render an empty line 2.

### 3. Signature + Date
- Signature captured only "Jeison" — either the input truncated on mobile or only first name was pulled. Confirm the signature field stores full typed name; if it's a drawn signature this is user-side.
- Date field is empty on the generated PDF even though signing has a timestamp. Wire `signed_at` → the Date cell next to the signature.

### 4. Cosmetic
- Normalize state to uppercase (`FL`) when composing line 6.

## Files likely involved
- `src/lib/generateW9.ts` — PDF rendering (TIN boxes, line 2, date, state)
- `src/components/personnel/onboarding/W9TaxForm.tsx` — capture (business_name should not default to company)
- `personnel_w9_forms` table — verify `ssn_full` is being persisted at signing

## Verification
- Regenerate Jeison's W-9 and confirm: SSN digits appear in all 9 boxes, line 2 is blank, date populated, state is "FL".
- Spot-check one LLC personnel to confirm line 2 still shows their DBA (regression check).
