

## Fix: Vendor Onboarding Links Showing "Expired" 

### Root Cause
The onboarding links are NOT actually expired -- the tokens are valid until March 2026. The real problem is a **missing database access policy**. 

When Bryan or Chris click their link, they are unauthenticated (anonymous) users. The system can read the onboarding token (that table allows anonymous reads), but it **cannot read the vendor record** because the `vendors` table only allows access to logged-in staff or portal users. Since the vendor data fetch fails silently, the page interprets it as "invalid link."

This is the same issue that was previously fixed for personnel onboarding.

### Fix

**Add an RLS policy on the `vendors` table** that allows anonymous users to read a vendor record ONLY if a valid, unexpired, and unused onboarding token exists for that vendor. This is a tightly scoped policy -- it does not expose vendor data broadly.

```sql
CREATE POLICY "Anon can read vendor during onboarding"
ON public.vendors
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_onboarding_tokens
    WHERE vendor_onboarding_tokens.vendor_id = vendors.id
      AND vendor_onboarding_tokens.used_at IS NULL
      AND vendor_onboarding_tokens.expires_at > now()
  )
);
```

We also need an anon UPDATE policy so the `complete_vendor_onboarding` RPC (which runs as SECURITY DEFINER) can work, but since it already uses SECURITY DEFINER, no additional policy is needed for submission -- only the SELECT is required.

### What Changes
- **1 database migration**: Add anon SELECT policy to `vendors` table
- **No code changes needed** -- the existing `useVendorOnboardingToken` hook and `VendorOnboarding.tsx` page will work correctly once the vendor data is accessible

### After This Fix
Bryan and Chris can re-click their existing links and the onboarding form will load properly. No new links need to be sent.
