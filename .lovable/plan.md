

## Plan: Add Personnel-Parity Form Views & Downloads to Vendor Detail Banking Tab

### Gap Analysis

**Personnel Banking tab has:**
1. `DirectDepositView` — full banking card with masked numbers, signature preview, and a "View Full Form" button that opens `DirectDepositFormPreview` (with PDF download via `downloadDirectDepositForm`)
2. `AgreementSignatureView` — ICA signature with "View Full Agreement" dialog (`ICAFormPreview` with PDF download), W-9 signature with "View W-9 Form" dialog (`W9FormPreview` with PDF download)
3. `W9FormView` — standalone W-9 card pulling from `personnel_w9_forms` table with verify/reject workflow and PDF download via `downloadFormW9`

**Vendor Banking tab currently has:**
- Plain text banking fields (no form preview, no PDF download)
- Signature images shown inline (no "View Full Form" dialogs, no PDF downloads)
- No W-9 form view at all (vendor has no `personnel_w9_forms` equivalent table — W-9 data lives on the `vendors` row itself)

### What To Build

**1. Replace vendor Banking Details card with `DirectDepositView` component**
- The existing `DirectDepositView` component is generic enough — it takes props for bank info and signature
- Map vendor fields to the same props (`bank_name`, `bank_account_type`, `bank_routing_number`, `bank_account_number`, `w9_signature`/`w9_signed_at` for the DD signature — but vendors use a separate `vendor_agreement_signature` for DD, so we'll pass null for DD signature if vendor doesn't have one and keep it honest)
- Actually, vendors don't have a `direct_deposit_signature` field — they only have `w9_signature` and `vendor_agreement_signature`. So we'll use `DirectDepositView` for the banking display but without signature (pass null), since the vendor's banking authorization is implicit via the vendor agreement

**2. Replace vendor Signatures card with `AgreementSignatureView`-style component**
- Create `VendorAgreementSignatureView.tsx` modeled on `AgreementSignatureView` but adapted for vendor fields:
  - Vendor Agreement signature (instead of ICA) with "View Full Agreement" dialog and PDF download
  - W-9 signature with "View W-9" dialog and PDF download
- For the Vendor Agreement PDF download, create `generateVendorAgreement.ts` using jsPDF (matching the `generateICA.ts` pattern)
- For the W-9, the vendor doesn't have a `personnel_w9_forms` row, so we'll build a lightweight W-9 preview using the vendor's fields (`vendor.name`, `vendor.company`, `vendor.address`, `vendor.tax_id`, `vendor.w9_signature`, `vendor.w9_signed_at`) and reuse the existing `downloadFormW9` by mapping vendor fields to `W9PDFFormData`

**3. Keep Work Authorization card as-is** (already good)

### Files

| File | Action |
|------|--------|
| `src/components/vendors/VendorAgreementSignatureView.tsx` | **Create** — Agreement signatures card with view/download dialogs for Vendor Agreement and W-9 |
| `src/lib/generateVendorAgreement.ts` | **Create** — PDF generation for Vendor Agreement (jsPDF, matching ICA pattern) |
| `src/pages/VendorDetail.tsx` | **Edit** — Replace Banking Details card with `DirectDepositView`, replace Signatures card with `VendorAgreementSignatureView`, import new components |

### Technical Details

- `DirectDepositView` already handles all masking/reveal logic internally — no need for the vendor page's `revealedFields` state for banking fields anymore
- The vendor agreement PDF will contain: company header, vendor name, agreement terms, signature, date — similar structure to ICA
- W-9 download will map vendor fields to `GenerateW9Options`: `{ w9Form: { name_on_return: vendor.name, business_name: vendor.company, address: vendor.address, ... }, ssnLastFour: vendor.tax_id?.slice(-4) }`
- Since vendor has no `personnel_w9_forms` record, the W-9 preview dialog will show a simple field-based view (name, company, address, tax ID masked, signature) rather than the full `W9FormPreview` component which expects a `W9Form` type

