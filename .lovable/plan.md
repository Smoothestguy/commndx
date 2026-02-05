
# Investigation Summary: Desktop Sign-In Failure

## Root Cause Analysis

After thorough investigation, the issue is clear: **Email/password sign-in fails on BOTH desktop AND the published site (commndx.lovable.app)**, not just on the custom domain. This rules out CORS/custom domain misconfiguration as the primary cause.

### Key Findings

1. **The `signInWithPassword` request itself is failing with `TypeError: Failed to fetch`** - this happens BEFORE any response is received from the Supabase backend.

2. **Mobile works, desktop doesn't** - This points to one of several desktop-specific issues:
   - Desktop Chrome may have stricter security policies
   - Browser extensions (ad blockers, privacy extensions) could be blocking Supabase API requests
   - Corporate network/firewall restrictions on desktop
   - Cached/stale service worker or DNS resolution issues
   - Chrome's tracking prevention or enhanced privacy features

3. **The Lovable OAuth flow uses `/~oauth/initiate`** which is a relative path that gets resolved against the current origin. For email/password, however, it uses the raw Supabase client which makes direct fetch requests to the Supabase backend.

4. **No CORS issue per se** - Since the published site (`commndx.lovable.app`) also fails, and that's a Lovable-controlled domain with proper CORS headers, the issue is NOT about missing allowed origins.

---

## Diagnosis Steps

The failure pattern (mobile works, desktop fails, even on published site) strongly suggests:

| Possibility | Likelihood | Evidence |
|-------------|------------|----------|
| Browser extension blocking | **High** | Extensions often target desktop only |
| Network/firewall | Medium | Corporate environments often restrict desktop differently |
| Chrome flags/settings | Medium | Some privacy features differ on desktop |
| Stale cache/service worker | Medium | Desktop may have cached old broken state |
| Supabase regional routing | Low | Would affect mobile too |

---

## Recommended Fix Strategy

### Phase 1: Quick Desktop Debugging (User-side)

Ask the user to perform these quick tests on their desktop Chrome:

1. **Incognito Window Test**
   - Open Chrome incognito (Ctrl+Shift+N / Cmd+Shift+N)
   - Try signing in at `commndx.lovable.app`
   - If this works → an extension is blocking requests

2. **DevTools Network Tab Check**
   - Open DevTools (F12) → Network tab → filter "token"
   - Attempt sign-in
   - Look for the blocked/failed request to identify the exact endpoint

3. **Try a different browser**
   - Test in Firefox or Edge
   - If these work → Chrome-specific issue (extensions, settings)

### Phase 2: Code-Level Improvements (If User-Side Tests Don't Resolve)

If the issue persists after user-side debugging:

1. **Add Retry Logic with Exponential Backoff**
   - Wrap `signInWithPassword` in a retry mechanism
   - Some transient network issues resolve with a second attempt

2. **Add Pre-flight Health Check (Optional)**
   - Already partially implemented in `pingAuthHealth()` 
   - Could be called before sign-in to give early warning

3. **Enhanced Error Messaging**
   - Show more specific guidance based on error type
   - E.g., "If you're using an ad blocker, try disabling it for this site"

---

## Technical Implementation Plan

### File: `src/contexts/AuthContext.tsx`

Add retry logic to `signIn` function:

```text
┌─────────────────────────────────────────────────────────┐
│ signIn(email, password)                                 │
├─────────────────────────────────────────────────────────┤
│ 1. Log attempt with origin info                         │
│ 2. First attempt: signInWithPassword                    │
│ 3. If "Failed to fetch" error:                          │
│    └─ Wait 1s, retry once                               │
│ 4. If still fails:                                      │
│    └─ Return error with diagnostic info                 │
│ 5. On success:                                          │
│    └─ Fire-and-forget audit log, navigate to /          │
└─────────────────────────────────────────────────────────┘
```

### File: `src/pages/Auth.tsx` and `src/pages/portal/PortalLogin.tsx`

Improve error banner to include troubleshooting hints:

```text
┌─────────────────────────────────────────────────────────┐
│ NetworkErrorBanner improvements                         │
├─────────────────────────────────────────────────────────┤
│ • Add "Try in incognito mode" suggestion                │
│ • Add "Disable ad blocker" suggestion                   │
│ • Keep existing retry + copy diagnostics buttons        │
└─────────────────────────────────────────────────────────┘
```

---

## Immediate Next Steps

Before implementing code changes, we need to confirm the root cause:

1. **User action required**: Test in Chrome incognito to rule out extensions
2. **User action required**: Check DevTools Network tab for the actual blocked request
3. **User action required**: Try Firefox/Edge to confirm Chrome-specific issue

Once we know the exact cause (extension, network, browser settings), we can either:
- Guide the user to fix their browser config (if it's client-side)
- Implement code-level mitigations (if it's a widespread issue)

---

## Summary

The fact that both the custom domain AND the published Lovable domain fail on desktop Chrome—but mobile works—strongly indicates a **desktop browser environment issue** (extensions, firewall, or Chrome settings) rather than a code bug or backend misconfiguration.

The recommended first step is for the user to test in incognito mode to confirm this hypothesis.
