

## Plan: Show Full W-9 Form Preview for Vendors

### Problem
When clicking "View W-9 Form" on the vendor page, you see a simple list of fields (name, company, address, masked tax ID). On the Personnel page, you see an actual replica of the IRS W-9 form with proper layout — header, checkboxes, TIN boxes, certification section, and signature.

### Fix
Replace the vendor's custom W-9 dialog content with the existing `W9FormPreview` component (from `src/components/personnel/W9FormPreview.tsx`), constructing a `W9Form`-compatible object from vendor fields.

### File to Edit

| File | Change |
|------|--------|
| `src/components/vendors/VendorAgreementSignatureView.tsx` | Import `W9FormPreview`, build a `W9Form` object from vendor props, replace the simple field list dialog with `<W9FormPreview />` |

### Details
- Map vendor fields to W9Form: `name_on_return` = vendorName, `business_name` = companyName, `address` = vendorAddress, `tin_type` = "ein", `ein` = taxId, `signature_data` = w9Signature, `signature_date` = w9SignedAt, `federal_tax_classification` = federalTaxClassification or "individual"
- Fields the vendor doesn't capture (llc_tax_classification, exempt_payee_code, city/state/zip separately, etc.) will be empty/default — the form will render with those boxes blank, which is correct
- Remove the custom download handler since `W9FormPreview` has its own download button built in

