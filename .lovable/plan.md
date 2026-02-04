

# Add Account Deletion to Vendor Portal

## Overview

Add a Settings page to the Vendor Portal with account deletion functionality, matching the pattern used in the Personnel Portal. The existing `delete-own-account` edge function already handles vendor record unlinking.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/vendor-portal/VendorSettings.tsx` | New Settings page with account deletion |

## Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add route for `/vendor/settings` |
| `src/components/vendor-portal/VendorPortalLayout.tsx` | Add Settings nav item |

---

## Implementation Details

### 1. Create VendorSettings.tsx

Create a new settings page that includes:
- Vendor profile information display (read-only)
- The existing `DeleteAccountSection` component (reused from admin/personnel)

Structure follows the Personnel Portal's `PortalSettings.tsx` pattern but simplified for vendors (no notification preferences for now).

```tsx
// Key imports
import { VendorPortalLayout } from "@/components/vendor-portal/VendorPortalLayout";
import { useCurrentVendor } from "@/integrations/supabase/hooks/useVendorPortal";
import { DeleteAccountSection } from "@/components/settings/DeleteAccountSection";
```

### 2. Update App.tsx

Add the vendor settings route after the existing vendor bill detail route:

```tsx
import VendorSettings from "./pages/vendor-portal/VendorSettings";

// Add route
<Route
  path="/vendor/settings"
  element={
    <VendorProtectedRoute>
      <VendorSettings />
    </VendorProtectedRoute>
  }
/>
```

### 3. Update VendorPortalLayout.tsx

Add Settings to the navigation items:

```tsx
const navItems = [
  { href: "/vendor", label: "Dashboard", icon: Home },
  { href: "/vendor/pos", label: "My POs", icon: ClipboardList },
  { href: "/vendor/bills", label: "My Bills", icon: FileText },
  { href: "/vendor/settings", label: "Settings", icon: Settings },  // Add this
];
```

---

## Technical Notes

### Existing Infrastructure

The `delete-own-account` edge function already:
- Unlinks vendor records (sets `user_id` to `null`) - preserving billing history
- Deletes user roles, permissions, and profile
- Deletes the auth user

### Redirect After Deletion

The `DeleteAccountSection` component redirects to `/auth` after deletion. This is appropriate since:
- The vendor is signed out
- The main auth page allows switching to vendor login if needed

---

## User Flow

1. Vendor navigates to Settings from sidebar/mobile menu
2. Sees their profile information (company, email, contact details)
3. Scrolls to "Delete Account" danger zone section
4. Clicks "Delete My Account" button
5. Confirmation dialog appears requiring "delete my account" text
6. Upon confirmation, account is deleted and user is redirected to auth page

---

## What Vendors Will See

```text
┌─────────────────────────────────────────────┐
│ Settings                                     │
│ Manage your account settings                 │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ Profile Information                      │ │
│ │ Your vendor details (contact admin)     │ │
│ ├─────────────────────────────────────────┤ │
│ │ Company: Demo Construction Co           │ │
│ │ Name: Demo Subcontractor                │ │
│ │ Email: vendor@example.com               │ │
│ │ Phone: 555-0200                         │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ ┌─────────────────────────────────────────┐ │
│ │ ⚠️ Delete Account                        │ │
│ │ Permanently delete your account...      │ │
│ ├─────────────────────────────────────────┤ │
│ │ [🗑️ Delete My Account]                  │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## App Store Compliance

This addition ensures full compliance with:
- **Apple Guideline 5.1.1(v)**: Account deletion must be available to all users
- **Google Play Data Safety**: Users must be able to request account deletion

Both the demo vendor account (`apple.review.vendor@fairfieldgp.com`) and real vendor accounts will have access to this feature.

