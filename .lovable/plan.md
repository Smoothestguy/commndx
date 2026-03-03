

## Plan: Add Email/SMS delivery option to Vendor Onboarding Dialog

### Problem
The `SendVendorOnboardingDialog` (used from vendor detail page, vendor list row actions, and the search dialog) only sends via email. The `SendOnboardingInviteDialog` (used from "Add Vendor" flow) already has email/SMS radio buttons. These should match.

### Fix
Update `SendVendorOnboardingDialog` to add a delivery method picker (email or SMS), similar to the existing pattern in `SendOnboardingInviteDialog`. The dialog will also need the vendor's phone number passed in.

### Files to Change

| File | Change |
|------|--------|
| `src/components/vendors/SendVendorOnboardingDialog.tsx` | Add `vendorPhone` prop, delivery method radio group (email/SMS), phone input field when SMS selected, and call the appropriate hook |
| `src/pages/Vendors.tsx` | Pass `vendorPhone` to `SendVendorOnboardingDialog` |
| `src/pages/VendorDetail.tsx` | Pass `vendorPhone` to `SendVendorOnboardingDialog` |
| `src/components/vendors/SendOnboardingSearchDialog.tsx` | Pass `vendorPhone` to `SendVendorOnboardingDialog` |

### Details
- Import `useSendVendorOnboardingSMS` alongside the existing email hook
- Add `RadioGroup` with Email/SMS options styled identically to `SendOnboardingInviteDialog`
- When SMS is selected, show a phone input pre-filled with `vendorPhone`
- When Email is selected, show the existing email input
- On submit, call `sendEmail` or `sendSMS` based on selection
- All callers already have access to vendor phone data, just need to pass it through

