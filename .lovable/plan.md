
# Add Apple Sign-In to Portal Login Pages

## Overview

Add "Continue with Apple" OAuth button to both the Vendor Portal and Personnel Portal login pages, following the existing pattern from the admin sign-in page.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/portal/PortalLogin.tsx` | Add Apple sign-in button and handler |
| `src/pages/vendor-portal/VendorLogin.tsx` | Add Apple sign-in button and handler |

---

## Changes for Each File

### 1. Add Import

```tsx
import { AppleIcon } from "@/components/icons/AppleIcon";
```

### 2. Update useAuth Destructuring

```tsx
// Before
const { signInWithGoogle } = useAuth();

// After
const { signInWithGoogle, signInWithApple } = useAuth();
```

### 3. Add Apple Login Handler

```tsx
const handleAppleLogin = async () => {
  setIsOAuthLoading(true);
  try {
    const { error } = await signInWithApple();
    if (error) throw error;
    // AuthCallback will handle the redirect
  } catch (error: any) {
    toast.error(error.message || "Failed to sign in with Apple");
    setIsOAuthLoading(false);
  }
};
```

### 4. Add Apple Button (after Google button)

```tsx
<Button
  type="button"
  variant="outline"
  className="w-full"
  onClick={handleAppleLogin}
  disabled={isOAuthLoading || loading}
>
  {isOAuthLoading ? (
    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
  ) : (
    <AppleIcon className="h-4 w-4 mr-2" />
  )}
  Continue with Apple
</Button>
```

---

## Updated OAuth Section Layout

After implementation, the OAuth section in each portal will show:

```text
┌─────────────────────────────────┐
│   [G] Continue with Google      │
├─────────────────────────────────┤
│   [] Continue with Apple       │
├─────────────────────────────────┤
│     Or continue with email      │
├─────────────────────────────────┤
│   Email/Password Form           │
└─────────────────────────────────┘
```

---

## Authentication Flow

1. User clicks "Continue with Apple"
2. `handleAppleLogin` sets `isOAuthLoading = true` (disables all buttons)
3. `signInWithApple()` from AuthContext is called
4. For web: Lovable OAuth flow redirects to Apple
5. For Electron: Opens OAuth in external browser
6. After successful auth, `AuthCallback` handles the redirect
7. Role-based logic routes user to correct portal based on vendor/personnel record

---

## Security Considerations

- Shared `isOAuthLoading` state prevents multiple simultaneous OAuth attempts
- Both buttons are disabled during any loading state (OAuth or email login)
- Error handling displays user-friendly toast messages
- AuthCallback validates user has appropriate portal access (vendor_id or personnel user_id link)
