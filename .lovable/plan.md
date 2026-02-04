

# Fix: Authentication Infinite Loading on Custom Domain

## Problem Analysis

The auth page gets stuck in infinite loading because of a race condition in `AuthContext.tsx`:

```text
┌─────────────────────────────────────────────────────────────────┐
│ Current Flow (Broken on Custom Domain)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. loading = true (initial state)                              │
│                                                                 │
│  2. onAuthStateChange listener set up                           │
│     └─> Waits for auth EVENT (might never fire!)                │
│                                                                 │
│  3. getSession() called                                         │
│     └─> If corrupted localStorage token exists:                 │
│         • Supabase tries to refresh token                       │
│         • Network request may hang or fail silently             │
│         • setLoading(false) never called                        │
│                                                                 │
│  Result: Spinner forever until 10s timeout triggers reload      │
│          (which might reload into the same broken state)        │
└─────────────────────────────────────────────────────────────────┘
```

The 10-second timeout workaround doesn't actually fix the issue - it just reloads the page, which can put you right back in the same broken state if localStorage still has corrupted data.

## Solution

Fix the `AuthContext` to handle all edge cases properly:

1. Set `onAuthStateChange` listener **first** (before calling getSession) - this is correct
2. Add **error handling** to `getSession()` to catch failures
3. Add a **reasonable timeout** inside the auth context itself (not just in Auth.tsx)
4. **Clear corrupted session data** when getSession fails to break the loop

## Implementation

### File: `src/contexts/AuthContext.tsx`

**Change 1:** Add proper error handling and timeout to the session initialization

```typescript
// Lines 101-119 - Replace the useEffect
useEffect(() => {
  // Set up auth state listener FIRST
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    console.log("[Auth] Auth state change:", event);
    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);
  });

  // Check for existing session with timeout and error handling
  const checkSession = async () => {
    try {
      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Session check timeout")), 5000);
      });

      const sessionPromise = supabase.auth.getSession();
      
      const { data: { session }, error } = await Promise.race([
        sessionPromise,
        timeoutPromise.then(() => { throw new Error("Timeout"); })
      ]) as Awaited<typeof sessionPromise>;

      if (error) {
        console.error("[Auth] Error getting session:", error);
        // Clear potentially corrupted session
        await supabase.auth.signOut();
      }
      
      setSession(session);
      setUser(session?.user ?? null);
    } catch (err) {
      console.error("[Auth] Session check failed:", err);
      // Clear localStorage on failure to break the loop
      try {
        localStorage.removeItem(`sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID}-auth-token`);
      } catch (e) {
        console.error("[Auth] Failed to clear auth token:", e);
      }
    } finally {
      setLoading(false);
    }
  };

  checkSession();

  return () => subscription.unsubscribe();
}, []);
```

### File: `src/pages/Auth.tsx`

**Change 2:** Remove the 10-second reload timeout (no longer needed with proper error handling)

Remove lines 51-61:
```typescript
// REMOVE THIS - the reload causes a loop and doesn't fix the root cause
useEffect(() => {
  if (authLoading) {
    const timeout = setTimeout(() => {
      console.warn('[Auth] Loading state stuck, reloading...');
      window.location.reload();
    }, 10000);
    return () => clearTimeout(timeout);
  }
}, [authLoading]);
```

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Error handling | None - getSession silently fails | Full try/catch with logging |
| Timeout | 10s reload (creates loop) | 5s internal timeout with cleanup |
| Corrupted state | Persists after reload | Automatically cleared |
| Recovery | Manual clear localStorage | Automatic recovery |

## Technical Details

The Supabase project ID from `.env` is `xfjjvznxkcckuwxmcsdc`, so the localStorage key to clear is:
`sb-xfjjvznxkcckuwxmcsdc-auth-token`

This fix ensures that:
1. Loading state **always** resolves within 5 seconds
2. Corrupted sessions are automatically cleared
3. The page doesn't get stuck in a reload loop
4. Proper error logging helps debug future issues

