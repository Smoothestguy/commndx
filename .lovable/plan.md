

## Two-Path Vendor Creation Flow with SMS/Email Onboarding

### Overview
Modify the "Add Vendor" dialog to present two paths: manual entry (existing) and sending an onboarding link (new). The onboarding link path collects minimal info, creates a vendor record, and sends the link via email or SMS.

### Changes

#### 1. New Component: `src/components/vendors/AddVendorChoiceDialog.tsx`
- A gateway dialog that replaces the current "Add Vendor" button click behavior
- Shows two cards/buttons: "Enter Vendor Manually" and "Send Onboarding Link"
- "Enter Manually" opens the existing Add Vendor form dialog
- "Send Onboarding Link" opens the new SendOnboardingInviteDialog

#### 2. New Component: `src/components/vendors/SendOnboardingInviteDialog.tsx`
- Step 1: Collect basic info (Full Name required, Company optional, Phone required, Email required)
- Step 2: Choose delivery method (Email or SMS radio buttons) with a confirmation summary
- On submit:
  - Creates a vendor record via `useAddVendor` with `onboarding_status: 'invited'`
  - Calls the appropriate edge function to send the link (email or SMS)
- Reuses the existing `useSendVendorOnboardingInvitation` hook for email path

#### 3. New Edge Function: `supabase/functions/send-vendor-onboarding-sms/index.ts`
- Mirrors `send-vendor-onboarding-email` but sends via Twilio instead of Resend
- Creates a token in `vendor_onboarding_tokens`, updates vendor status to "invited"
- Sends an SMS with the onboarding link using existing Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER -- all already configured)
- Requires auth (admin/manager role check)

#### 4. New Hook Addition: `src/integrations/supabase/hooks/useVendorOnboarding.ts`
- Add `useSendVendorOnboardingSMS` mutation hook that calls `send-vendor-onboarding-sms` edge function

#### 5. Modify: `src/pages/Vendors.tsx`
- Replace `openNewDialog` to show `AddVendorChoiceDialog` first (when adding new, not editing)
- Import and render the new components
- The existing edit flow remains unchanged

#### 6. Vendor Onboarding Page Enhancement: `src/pages/VendorOnboarding.tsx`
- The existing onboarding page already handles the full flow (company info, address, W-9, banking, agreement, review)
- No changes needed since the existing multi-step form already covers all required fields including W-9 signature and vendor agreement signature

### Technical Details

**Edge Function: `send-vendor-onboarding-sms`**
- Uses `verify_jwt = false` in config.toml, validates auth via `getClaims()`
- Role check: admin or manager only
- Creates token in `vendor_onboarding_tokens` table (same as email flow)
- Sends SMS via Twilio with message: "Hi {name}! Complete your vendor registration: {link}"
- Phone normalization: strips non-digits, prepends +1 if 10 digits

**Database**: No schema changes needed -- existing `vendor_onboarding_tokens` table and `vendors.onboarding_status` field support this flow.

**Security**: 
- SMS edge function validates admin/manager role before creating tokens
- Service role client used for token creation and vendor status updates
- Phone number validated before sending

**Flow Diagram**:
1. Admin clicks "Add Vendor" -> Choice dialog appears
2. Selects "Send Onboarding Link" -> Invite dialog opens
3. Fills name, company, phone, email -> Selects Email or SMS -> Confirms
4. System creates vendor record (status: invited) + onboarding token -> Sends link
5. Vendor clicks link -> Completes multi-step form -> Status becomes "completed"

