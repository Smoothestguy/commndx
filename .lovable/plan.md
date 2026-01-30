
# App Store Submission Fix Plan

This plan addresses the four rejection issues from Apple's App Review.

---

## Issue 1: Sign in with Apple Required (Guideline 4.8)

**Problem:** The app uses Google OAuth but doesn't offer Sign in with Apple as an equivalent option.

**Current State:**
- `src/pages/Auth.tsx` only has Google OAuth login
- `src/contexts/AuthContext.tsx` has `signInWithGoogle` method

**Solution:**
1. Configure Apple OAuth via Lovable Cloud's supabase--configure-social-auth tool
2. Add `signInWithApple` method to `AuthContext.tsx`
3. Add "Sign in with Apple" button to `src/pages/Auth.tsx`
4. Update `src/pages/AuthCallback.tsx` to handle Apple OAuth callbacks

**UI Changes:**
- Add Apple button styled similarly to Google button
- Use official Apple logo/icon component

---

## Issue 2: Account Deletion Required (Guideline 5.1.1(v))

**Problem:** Users can create accounts but cannot delete their own accounts from within the app.

**Current State:**
- Admin-only deletion exists via `supabase/functions/delete-user/index.ts`
- No self-service deletion in portal settings (`src/pages/portal/PortalSettings.tsx`)

**Solution:**
1. Create new edge function `delete-own-account` that allows authenticated users to delete their own account
2. Add "Delete My Account" section to:
   - `src/pages/portal/PortalSettings.tsx` (Personnel Portal)
   - `src/pages/Settings.tsx` (Main app settings if exists)
3. Include confirmation dialog with clear warning
4. The deletion process will:
   - Unlink personnel/vendor records (set user_id to null)
   - Delete user_roles, user_permissions, notification_preferences
   - Delete profile
   - Delete auth user

**UI Design:**
- Danger zone section at bottom of settings
- Red "Delete Account" button
- Multi-step confirmation dialog explaining consequences
- Require password/re-authentication for security

---

## Issue 3: Business Distribution Clarification (Guideline 3.2)

**Problem:** Apple believes this is a B2B app meant for specific organizations, not public distribution.

**This is NOT a code change.** You need to respond to Apple with answers to their questions:

1. **Is the app restricted to specific company users?** 
   Yes - the app is designed for field service companies (contractors, construction firms). Only pre-registered personnel and vendors can access full features.

2. **Is it for a limited group of companies?**
   No - any field service company can become a client. The app serves multiple businesses.

3. **Features for general public?**
   The landing page, features page, and pricing are public. Core functionality (time tracking, project management) requires authorized accounts.

4. **How do users obtain accounts?**
   Company administrators invite personnel/vendors via email. Self-registration is restricted to prevent unauthorized access.

5. **Paid content?**
   The business pays for the subscription. End users (personnel) do not pay directly.

**Recommendation:** Consider Apple Business Manager or unlisted distribution if this is truly B2B only. If you want public App Store listing, emphasize that any company can sign up and the app serves a general market of field service businesses.

---

## Issue 4: Background Location Justification (Guideline 2.5.4)

**Problem:** Info.plist declares `location` in UIBackgroundModes but Apple couldn't find the feature.

**Current State:**
The app HAS legitimate persistent location features:
- Geofencing for job sites (`src/hooks/useNativeGeolocation.ts`)
- Auto-clock-out when personnel leave job sites
- Background tracking via `@transistorsoft/capacitor-background-geolocation`

**Two Options:**

### Option A: Justify to Apple (Recommended)
Reply to App Review explaining where to find the feature:
> "The app uses persistent location for automatic time tracking at job sites. To access:
> 1. Log in with a personnel account
> 2. Navigate to Time Clock
> 3. Clock in to a project with geofence enabled
> 4. The app monitors your location in the background
> 5. When you leave the job site geofence (0.25-mile radius), you are automatically clocked out
> 
> This feature prevents payroll fraud and ensures accurate time tracking for field workers."

### Option B: Remove Background Location (If not needed)
If background location is not critical to app functionality:
1. Remove `location` from `UIBackgroundModes` in `ios/App/App/Info.plist`
2. Switch to significant-change location service or region monitoring

**Recommendation:** Option A - the feature is legitimately used for geofencing.

---

## Summary of Code Changes Required

| File | Change |
|------|--------|
| `src/contexts/AuthContext.tsx` | Add `signInWithApple` method |
| `src/pages/Auth.tsx` | Add "Sign in with Apple" button |
| `src/components/icons/AppleIcon.tsx` | Create Apple icon component |
| `supabase/functions/delete-own-account/index.ts` | New function for self-service account deletion |
| `src/pages/portal/PortalSettings.tsx` | Add account deletion UI |
| `src/components/settings/DeleteAccountSection.tsx` | Create reusable deletion component |

---

## Technical Details

### Sign in with Apple Implementation

```typescript
// In AuthContext.tsx
const signInWithApple = useCallback(async () => {
  try {
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo }
    });
    if (error) return { error };
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}, []);
```

### Delete Own Account Edge Function

```typescript
// Key logic for supabase/functions/delete-own-account/index.ts
// 1. Verify user is authenticated
// 2. Get user's own ID from auth token
// 3. Unlink personnel/vendor records
// 4. Delete related data (roles, permissions, preferences)
// 5. Delete profile
// 6. Delete auth user using service role
```

### Account Deletion UI

```typescript
// In PortalSettings.tsx - Add danger zone section
<Card className="border-destructive">
  <CardHeader>
    <CardTitle className="text-destructive">Delete Account</CardTitle>
    <CardDescription>
      Permanently delete your account and all associated data
    </CardDescription>
  </CardHeader>
  <CardContent>
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete My Account</Button>
      </AlertDialogTrigger>
      {/* Confirmation dialog */}
    </AlertDialog>
  </CardContent>
</Card>
```

---

## Response Template for Apple

For Issues 3 and 4, you'll need to respond in App Store Connect:

**Issue 3 Response:**
> "Command X is a workforce management platform designed for any field service business (contractors, construction, landscaping, etc.). While individual users require an invitation from their employer, any company can subscribe and onboard their team. The app serves a broad market of field service businesses, not a single organization."

**Issue 4 Response:**
> "Background location is used for our automatic time tracking feature. When personnel clock in to a project, a geofence is created around the job site. If they leave the geofence while clocked in, they are automatically clocked out. To test: Log in → Time Clock → Clock in to any project with geofencing enabled → Leave the location → Observe automatic clock-out."
