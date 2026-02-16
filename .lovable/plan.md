

## Add "Send Onboarding" to Vendors List Page

### What This Does
Adds a "Send Onboarding" button to each vendor row in the main Vendors table, right alongside the existing Edit and Delete buttons. This lets you send onboarding links without having to open the vendor detail page first.

### Changes

**File: `src/pages/Vendors.tsx`**

1. **Import** `SendVendorOnboardingDialog` and the `Send` icon
2. **Add state** for `isOnboardingDialogOpen` and `onboardingVendor` (to track which vendor is being onboarded)
3. **Add a Send button** in the actions column (next to Edit and Delete) -- shows a send icon that opens the onboarding dialog for that vendor row
4. **Render** `SendVendorOnboardingDialog` at the bottom of the component, passing the selected vendor's id, name, and email

### Technical Details

- The actions column at lines 368-397 gets a third button with the `Send` icon
- The button will be hidden if the vendor's `onboarding_status` is `"completed"`
- Clicking the button sets `onboardingVendor` state and opens the existing `SendVendorOnboardingDialog`
- No database or backend changes needed -- reuses existing infrastructure

