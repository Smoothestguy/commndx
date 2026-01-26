
# Plan: Require Current Password Before Changing Password

## Overview
Add a "Current Password" field to the password change form in Settings. The system will verify the user's current password before allowing them to set a new one, adding an important security layer.

---

## Current Behavior
The password change form currently has:
- New Password field
- Confirm Password field
- No verification of the current password

This allows anyone with access to an active session to change the password without knowing the original password.

---

## Proposed Solution

### Changes to Settings.tsx

**1. Add new state for current password**
```tsx
const [currentPassword, setCurrentPassword] = useState("");
```

**2. Update handlePasswordChange function**
- First verify the current password using `supabase.auth.signInWithPassword`
- If verification fails, show an error message
- If verification succeeds, proceed with `supabase.auth.updateUser`
- Clear all password fields after success

```tsx
const handlePasswordChange = async (e: React.FormEvent) => {
  e.preventDefault();

  if (newPassword !== confirmPassword) {
    toast({ title: "Passwords don't match", ... });
    return;
  }

  if (newPassword.length < 6) {
    toast({ title: "Password too short", ... });
    return;
  }

  setIsChangingPassword(true);

  // Step 1: Verify current password
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user?.email || "",
    password: currentPassword,
  });

  if (verifyError) {
    setIsChangingPassword(false);
    toast({
      title: "Invalid current password",
      description: "Please enter your correct current password.",
      variant: "destructive",
    });
    return;
  }

  // Step 2: Update to new password
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  setIsChangingPassword(false);

  if (error) {
    toast({ title: "Error changing password", ... });
  } else {
    toast({ title: "Password updated", ... });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }
};
```

**3. Add Current Password input field to the form**
```tsx
<div>
  <Label htmlFor="current-password">Current Password</Label>
  <Input
    id="current-password"
    type="password"
    value={currentPassword}
    onChange={(e) => setCurrentPassword(e.target.value)}
    placeholder="Enter current password"
    className="mt-1.5"
    required
  />
</div>
```

---

## Updated Form Layout

```
┌─────────────────────────────────────┐
│ Security                            │
│ Update your password                │
├─────────────────────────────────────┤
│ Current Password                    │
│ [••••••••••••••••]                  │
│                                     │
│ New Password                        │
│ [••••••••••••••••]                  │
│                                     │
│ Confirm Password                    │
│ [••••••••••••••••]                  │
│                                     │
│ [Update Password]                   │
└─────────────────────────────────────┘
```

---

## Security Benefits

1. **Session hijacking protection**: Even if someone gains access to an active session, they cannot change the password without knowing the current one
2. **Verification before change**: Confirms the user's identity before allowing sensitive account changes
3. **Standard security practice**: Follows industry-standard password change workflows

---

## File to Modify

| File | Changes |
|------|---------|
| `src/pages/Settings.tsx` | Add current password state, input field, and verification logic |

---

## Technical Notes

- Uses `supabase.auth.signInWithPassword()` for verification - this is the recommended Supabase approach
- The verification step doesn't create a new session, it just validates credentials
- Error handling differentiates between "wrong current password" and "password update failed"
