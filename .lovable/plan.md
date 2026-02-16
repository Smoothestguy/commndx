

## Add "Send Onboarding" Button to Vendor Detail Page

### What This Does
Adds a "Send Onboarding" button directly on the vendor detail page so you can send an onboarding link to any vendor -- no need for them to apply as personnel first. The vendor receives an email with a link to complete their registration (company info, W-9, banking, insurance, agreement).

### Changes

**File: `src/pages/VendorDetail.tsx`**
- Import `SendVendorOnboardingDialog` and the `Send` icon
- Add `isOnboardingDialogOpen` state
- Add a "Send Onboarding" button in the header actions row (next to "Edit Vendor")
- Conditionally show/hide or relabel the button based on `vendor.onboarding_status` (e.g., show "Resend Onboarding" if already invited, hide if completed)
- Render the `SendVendorOnboardingDialog` at the bottom of the component

### Technical Details
No database or backend changes needed. The full onboarding pipeline already exists:
- `SendVendorOnboardingDialog` component collects the email
- `useSendVendorOnboardingInvitation` hook calls the `send-vendor-onboarding-email` backend function
- That function creates a token in `vendor_onboarding_tokens`, updates vendor status to "invited", and sends the email via Resend
- The vendor clicks the link to `/vendor-onboarding/:token` and completes the multi-step form

This is purely a UI wiring task -- one file change.

