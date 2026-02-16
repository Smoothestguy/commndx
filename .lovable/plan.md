

## Add "Send Onboarding" Button to Vendors Page Header with Vendor Search

### What This Does
Adds a "Send Onboarding" button at the top of the Vendors page (next to "Add Vendor"). Clicking it opens a dialog where you can search for a vendor by name, email, or phone number, select them, and send the onboarding invitation -- all from one place.

### Changes

**New File: `src/components/vendors/SendOnboardingSearchDialog.tsx`**
- A dialog with a search input at the top
- Fetches all vendors and filters them in real-time by name, email, or phone (with phone number normalization so searching "904-534" matches stored digits)
- Shows matching vendors as a selectable list with name, email, and phone displayed
- Vendors with `onboarding_status === "completed"` are excluded or shown as "already onboarded"
- Selecting a vendor opens the existing `SendVendorOnboardingDialog` pre-filled with that vendor's info

**File: `src/pages/Vendors.tsx`**
- Import and render the new `SendOnboardingSearchDialog`
- Add a "Send Onboarding" button in the header actions row (between QuickBooks sync and Add Vendor)
- Add state (`isSendOnboardingSearchOpen`) to control the dialog

### Technical Details

- The search dialog reuses the existing `useVendors` hook data already loaded on the page
- Phone search strips non-digit characters before comparing (matching existing search normalization pattern)
- Once a vendor is selected, it opens the existing `SendVendorOnboardingDialog` which handles the actual invitation flow
- No database or backend changes needed

