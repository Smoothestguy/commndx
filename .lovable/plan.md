

## Fix: Add Missing Vendor Onboarding Route

### Problem
The vendor onboarding link (`/vendor-onboarding/{token}`) leads to a 404 page because the route was never added to the router in `App.tsx`. The `VendorOnboarding` page component exists and works, but React Router doesn't know about it.

### Fix

**File: `src/App.tsx`**

1. Add the import for `VendorOnboarding` at the top (around line 30, with other page imports):
   ```
   import VendorOnboarding from "./pages/VendorOnboarding";
   ```

2. Add the route as a public (non-protected) route, right after the Vendor Portal Routes section (around line 613):
   ```
   <Route path="/vendor-onboarding/:token" element={<VendorOnboarding />} />
   <Route path="/vendor-onboarding-complete" element={...} />
   ```

3. Create a simple completion page (`src/pages/VendorOnboardingComplete.tsx`) since the onboarding form navigates to `/vendor-onboarding-complete` on success -- or add an inline element for that route.

### Why This Happened
The `VendorOnboarding.tsx` page was created but the corresponding route definition in `App.tsx` was missed.

### Technical Notes
- The route must be outside any `ProtectedRoute` wrapper since vendors accessing the link are unauthenticated
- The existing RLS policies on `vendor_onboarding_tokens` and `vendors` tables already support anonymous access (similar to personnel onboarding)
- A simple "Registration Complete" page will be added for the `/vendor-onboarding-complete` route

