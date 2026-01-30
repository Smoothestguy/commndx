
# Add Account Deletion to Admin Settings

## Problem
The account deletion feature was only added to the Personnel Portal settings (`/portal/settings`). Admins and managers who use the main Settings page (`/settings`) cannot delete their accounts, which violates Apple's App Store Guideline 5.1.1(v).

## Solution
Add the `DeleteAccountSection` component (already created) to the admin Settings page.

## File Changes

| File | Action |
|------|--------|
| `src/pages/Settings.tsx` | Import and add `DeleteAccountSection` component |

## Implementation Details

### Change to `src/pages/Settings.tsx`

**Add import:**
```typescript
import { DeleteAccountSection } from "@/components/settings/DeleteAccountSection";
```

**Add component after the Account Actions footer (after the Sign Out button section):**

The `DeleteAccountSection` will be placed as a full-width section at the bottom of the settings page, similar to how it appears in the Portal Settings. This provides a consistent "danger zone" pattern.

### Placement
The section will be added after the existing "Account Actions Footer" that contains the Sign Out button, as a separate danger zone section. This keeps destructive actions grouped at the bottom of the page.

## Notes
- The `DeleteAccountSection` component is already fully functional and reusable
- It includes the same safety measures: confirmation dialog requiring users to type "delete my account"
- Uses the existing `delete-own-account` edge function
- Works for any authenticated user (admin, manager, or regular user)
