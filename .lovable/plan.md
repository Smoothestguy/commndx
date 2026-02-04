
# Fix: Authentication Failures (Email Sign-In and Apple OAuth)

## Problem Summary

You're experiencing two distinct but related issues:
1. **Email sign-in shows "Failed to fetch"** - the network request doesn't complete
2. **Apple sign-in redirects back to login** - authentication appears to succeed but session isn't established

These issues are happening on both the preview and custom domains, suggesting problems introduced in recent code changes or app configuration.

## Root Cause Analysis

### Issue 1: "Failed to fetch" Error

After reviewing the recent changes, the session initialization in `AuthContext.tsx` has a potential issue with how `Promise.race` handles errors. The current code can throw a generic "Timeout" error that gets caught, but the actual network request may still be in-flight or blocked.

Additionally, on **mobile apps (Capacitor/iOS/Android)**, the "Failed to fetch" error often indicates:
- Network security configuration blocking requests
- SSL/TLS certificate issues  
- The app's `capacitor.config.ts` or `network_security_config.xml` not allowing the Supabase domain

### Issue 2: Apple OAuth Redirect Loop

The Apple sign-in uses Lovable's OAuth bridge, but the `AuthCallback.tsx` is trying to get the session via `supabase.auth.getSession()`. After OAuth completes:
1. Lovable's auth bridge sets tokens in the session
2. `AuthCallback` runs before the session is fully propagated
3. No session found → redirects back to `/auth`

## Solution

### Part 1: Fix Session Initialization Race Condition

Update `AuthContext.tsx` to properly handle the Promise.race and ensure `setLoading(false)` is always called:

```typescript
// Current problematic code:
const { data: { session }, error } = await Promise.race([
  sessionPromise,
  timeoutPromise.then(() => { throw new Error("Timeout"); })
]) as Awaited<typeof sessionPromise>;

// Fixed version - simpler and more reliable:
useEffect(() => {
  let isMounted = true;
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    console.log("[Auth] Auth state change:", event);
    if (isMounted) {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }
  });

  // Simple session check without complex Promise.race
  supabase.auth.getSession().then(({ data: { session }, error }) => {
    if (error) {
      console.error("[Auth] Error getting session:", error);
    }
    if (isMounted) {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }
  }).catch((err) => {
    console.error("[Auth] Session check failed:", err);
    if (isMounted) {
      setLoading(false);
    }
  });

  return () => {
    isMounted = false;
    subscription.unsubscribe();
  };
}, []);
```

### Part 2: Ensure AuthCallback Waits for Session

The `AuthCallback.tsx` needs to wait for the `onAuthStateChange` event rather than immediately calling `getSession()`:

```typescript
// In AuthCallback.tsx - wait for auth event before checking session
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      console.log("[AuthCallback] Auth event:", event);
      
      if (event === 'SIGNED_IN' && session) {
        // Process the authenticated session
        await handleAuthenticatedUser(session);
      } else if (event === 'INITIAL_SESSION') {
        // Check if we have a session from URL hash
        if (session) {
          await handleAuthenticatedUser(session);
        } else {
          // No session in URL - check if callback has tokens
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          
          if (!accessToken) {
            setError("No session found");
            setTimeout(() => navigate("/auth"), 2000);
          }
          // If tokens in URL, wait for SIGNED_IN event
        }
      }
    }
  );

  return () => subscription.unsubscribe();
}, [navigate]);
```

### Part 3: Mobile App Network Configuration (if applicable)

If you're submitting to the App Store (iOS), ensure the following:

**In `capacitor.config.ts`:**
```typescript
{
  server: {
    cleartext: false,
    allowNavigation: [
      "*.supabase.co",
      "*.supabase.com"
    ]
  }
}
```

**In `ios/App/App/Info.plist`:**
```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <false/>
  <key>NSExceptionDomains</key>
  <dict>
    <key>supabase.co</key>
    <dict>
      <key>NSIncludesSubdomains</key>
      <true/>
      <key>NSExceptionAllowsInsecureHTTPLoads</key>
      <false/>
      <key>NSExceptionRequiresForwardSecrecy</key>
      <true/>
    </dict>
  </dict>
</dict>
```

## Files to Modify

| File | Change |
|------|--------|
| `src/contexts/AuthContext.tsx` | Simplify session initialization, remove problematic Promise.race |
| `src/pages/AuthCallback.tsx` | Wait for auth state change event before processing |

## Summary

| Issue | Cause | Fix |
|-------|-------|-----|
| "Failed to fetch" | Complex Promise.race potentially causing issues | Simplify to standard async/await with proper error handling |
| Apple redirect loop | AuthCallback checks session before it's established | Wait for `onAuthStateChange` event |
| Mobile app failures | Network security config | Add Supabase domains to allowed list |

## Testing Checklist

After implementing fixes:
1. Clear browser cache and local storage
2. Test email sign-in on web
3. Test Apple sign-in on web  
4. Test on iOS simulator/TestFlight
5. Verify no console errors during auth flow
