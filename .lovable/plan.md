

## Vendor Onboarding: Work Authorization + Admin Financial Visibility

### Overview
Two changes are needed:
1. **Vendor Onboarding** - Add a "Work Authorization" step (similar to personnel onboarding) so vendors without a Social Security Number can provide a TIN/ITIN and upload work authorization documents
2. **Vendor Detail Page** - Show banking/financial details (bank name, account type, routing/account numbers masked) and signature statuses so admins can view the submitted financial information

### Changes

#### 1. Add Work Authorization Step to Vendor Onboarding (`src/pages/VendorOnboarding.tsx`)

Insert a new step between "Address" (step 2) and "W-9 Tax Form" (step 3), shifting all subsequent steps. The new flow becomes:

1. Company Info
2. Address
3. **Work Authorization (NEW)**
4. W-9 Tax Form
5. Banking
6. Agreement
7. Review

**Work Authorization step logic** (mirrors personnel onboarding):
- Ask: "Are you a U.S. Citizen?" (Yes/No radio)
- **U.S. Citizen**: Require TIN (SSN/EIN) entry -- this pre-fills the W-9 step
- **Non-U.S. Citizen**: Show immigration status dropdown (Visa, Work Permit, Green Card, Other)
  - Visa/Work Permit/Green Card: Require TIN entry + document upload (visa docs, EAD card, or green card front/back)
  - Other: Require ITIN entry (9 digits starting with 9) + optional work authorization document upload
- Documents uploaded to the existing `vendor-documents` or `form-uploads` storage bucket

**Form data additions** to `VendorOnboardingFormData`:
- `citizenship_status`: "us_citizen" | "non_us_citizen"
- `immigration_status`: "visa" | "work_permit" | "green_card" | "other" | undefined
- `itin`: string (for non-citizen "other" status)
- `documents`: array of uploaded document references

#### 2. New Component: `src/components/vendors/onboarding/VendorWorkAuthorizationForm.tsx`

A dedicated form component for the work authorization step. Reuses existing components:
- `SSNInput` or standard `Input` for TIN/ITIN
- `ITINInput` from personnel registration for ITIN formatting
- `CategoryDocumentUpload` for document uploads
- `RadioGroup` for citizenship/immigration status selection

#### 3. Update `VendorOnboardingFormData` interface (`src/integrations/supabase/hooks/useVendorOnboarding.ts`)

Add fields:
```
citizenship_status: string;
immigration_status: string;
itin: string;
documents: { type: string; name: string; path: string; fileType: string; fileSize: number }[];
```

#### 4. Update `complete_vendor_onboarding` RPC (database migration)

Add parameters for the new fields:
- `p_citizenship_status text`
- `p_immigration_status text`
- `p_itin text`

This requires adding columns to the `vendors` table:
- `citizenship_status text`
- `immigration_status text`
- `itin text`

And updating the RPC function to save these values.

#### 5. Vendor Detail Page - Banking/Financial Info (`src/pages/VendorDetail.tsx`)

The existing "Financial Information" card (lines 216-279) already shows tax_id, 1099, billing_rate, payment_terms. Enhance it to **always show** (not conditionally) and add:
- Bank Name
- Bank Account Type
- Bank Routing Number (masked: show last 4 digits only)
- Bank Account Number (masked: show last 4 digits only)
- W-9 Signature status (signed date or "Not signed")
- Vendor Agreement Signature status (signed date or "Not signed")
- Citizenship/Immigration Status (new fields)

This requires updating the `Vendor` interface in `useVendors.ts` to include the new columns and the banking fields that are already in the DB but not fetched.

#### 6. Update `useVendors.ts` Vendor interface

Add missing fields that already exist in DB:
- `bank_name`, `bank_account_type`, `bank_routing_number`, `bank_account_number`
- `w9_signature`, `w9_signed_at`
- `vendor_agreement_signature`, `vendor_agreement_signed_at`
- `citizenship_status`, `immigration_status`, `itin` (after migration)
- `business_type`, `contact_name`, `contact_title`, `years_in_business`, `website`

### Technical Details

**Database Migration:**
```sql
ALTER TABLE public.vendors 
  ADD COLUMN IF NOT EXISTS citizenship_status text,
  ADD COLUMN IF NOT EXISTS immigration_status text,
  ADD COLUMN IF NOT EXISTS itin text;
```

Then drop and recreate `complete_vendor_onboarding` with the 3 additional parameters.

**Document Storage:** Use the existing `form-uploads` public bucket for work authorization document uploads during onboarding (same pattern as personnel registration).

**Security:** The existing anon SELECT policy on vendors (via valid onboarding token) already covers access. The RPC runs as SECURITY DEFINER so updates are handled server-side.

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/vendors/onboarding/VendorWorkAuthorizationForm.tsx` | Create |
| `src/pages/VendorOnboarding.tsx` | Modify (add step, update step count) |
| `src/integrations/supabase/hooks/useVendorOnboarding.ts` | Modify (add fields to form data + RPC call) |
| `src/integrations/supabase/hooks/useVendors.ts` | Modify (add fields to Vendor interface) |
| `src/pages/VendorDetail.tsx` | Modify (show banking + signature info) |
| Database migration | Add columns + update RPC |

