
# Fix: Sign-In Stuck in Loading State

## Problem

After clicking "Sign In" with valid credentials, the button shows a loading spinner indefinitely. The authentication succeeds but the UI never updates.

## Root Cause

In `AuthContext.tsx`, the `signIn` function calls `await logAuthEvent()` which inserts into the `audit_logs` table. This call:

1. **Blocks the entire sign-in flow** with `await`
2. **Has no timeout** - if the insert hangs, the promise never resolves
3. **The RLS policy** requires authenticated users, but the session may not be fully propagated yet

```text
User clicks Sign In
       │
       ▼
signInWithPassword() succeeds ✓
       │
       ▼
await logAuthEvent() ← HANGS HERE
       │              (insert to audit_logs may fail/timeout)
       ▼
navigate("/") ← Never reached
setIsLoading(false) ← Never called
```

## Solution

Make audit logging **non-blocking** ("fire and forget"). The audit log should not prevent the user from signing in.

### Changes to `src/contexts/AuthContext.tsx`

**1. Remove `await` from all `logAuthEvent` calls in authentication functions:**

| Location | Before | After |
|----------|--------|-------|
| `signIn` success (line 254) | `await logAuthEvent(...)` | `logAuthEvent(...).catch(...)` |
| `signIn` error (line 250) | `await logAuthEvent(...)` | `logAuthEvent(...).catch(...)` |
| `signUp` success (line 225) | `await logAuthEvent(...)` | `logAuthEvent(...).catch(...)` |
| `signUp` error (line 221) | `await logAuthEvent(...)` | `logAuthEvent(...).catch(...)` |
| `signUp` catch (line 228-234) | `await logAuthEvent(...)` | `logAuthEvent(...).catch(...)` |
| `signIn` catch (line 258-264) | `await logAuthEvent(...)` | `logAuthEvent(...).catch(...)` |
| `signOut` (line 276) | `await logAuthEvent(...)` | `logAuthEvent(...).catch(...)` |

**2. Example of the fix:**

Before:
```typescript
await logAuthEvent("sign_in", email, data.user?.id, true);
navigate("/");
return { error: null };
```

After:
```typescript
// Fire and forget - don't block sign-in flow
logAuthEvent("sign_in", email, data.user?.id, true).catch(console.error);
navigate("/");
return { error: null };
```

## Technical Details

The `logAuthEvent` function already has its own try-catch, but the `await` means we still wait for the database operation. By removing `await` and adding `.catch()`, we:

1. Let the sign-in complete immediately
2. Log asynchronously in the background
3. Catch any errors without blocking the user

## Files to Modify

| File | Change |
|------|--------|
| `src/contexts/AuthContext.tsx` | Remove `await` from all `logAuthEvent` calls, add `.catch(console.error)` |

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Sign-in flow | Blocked by audit log | Immediate response |
| Audit logging | Must complete for sign-in | Background "fire and forget" |
| Error handling | Silently hangs | Logs errors, doesn't block user |
