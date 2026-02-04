
## What’s actually broken (and what update likely caused it)

Right now the app can’t sign in on the **published web site** and shows a generic **“Failed to fetch”** for every sign-in method. Given the code we now have, the most likely regression is:

- We added a **mandatory pre-flight “health check”** (`pingAuthHealth()`) that runs *before* attempting email/password sign-in (and also before sign-up and in the portal logins).
- That health check currently does a **`HEAD` request** to `…/auth/v1/`.
- In some hosting/CDN/backends, **`HEAD` responses don’t include the same CORS headers** as `GET/POST`, or they can be blocked/handled differently.
- When a CORS header is missing, the browser reports it as **`TypeError: Failed to fetch`** (even if the server is reachable), which matches your symptom exactly.
- Because we **return early** when the health check fails, the app never even gets to the real sign-in call, so *everything looks dead*.

In other words: the “hardening” change accidentally introduced a new failure point that blocks sign-in.

## Goal

Restore “sign in works like before” on the published site by:
1) Removing the health check as a blocking dependency (so auth attempts always happen)
2) Switching any remaining health check to an endpoint/method that is reliable under CORS
3) Adding clear logging so we can confirm whether the failure is on the health check or the actual sign-in request

---

## Implementation plan (code changes)

### 1) Change `pingAuthHealth()` to avoid `HEAD` and be CORS-safe
**File:** `src/utils/authNetwork.ts`

- Replace the `HEAD ${SUPABASE_URL}/auth/v1/` request with a `GET` request to a more CORS-consistent endpoint:
  - Prefer: `GET ${SUPABASE_URL}/auth/v1/health`
  - If that endpoint is not available, fallback to `GET ${SUPABASE_URL}/auth/v1/settings` (or another documented public auth endpoint)
- Add:
  - `cache: "no-store"` (avoid cached bad results)
  - A short timeout (keep your AbortController)
- Treat “any HTTP response” (even 4xx) as “reachable” (health check is about reachability, not authorization).

**Why:** This removes the likely CORS/HEAD mismatch that is currently causing “Failed to fetch”.

---

### 2) Make the health check non-blocking (never prevent sign-in)
**Files:**
- `src/contexts/AuthContext.tsx`
- `src/pages/portal/PortalLogin.tsx`
- `src/pages/vendor-portal/VendorLogin.tsx`
- `src/pages/subcontractor-portal/SubcontractorLogin.tsx`

Change the current pattern:

```ts
const health = await pingAuthHealth(...)
if (!health.healthy) return { error: ... }
```

To:

- Run `pingAuthHealth()` in a **best-effort** way:
  - If it fails, log it and optionally show the banner
  - But still proceed to attempt the actual sign-in call
- Only show the network banner when:
  - The real sign-in attempt fails with a network error, OR
  - The health check fails *and* the sign-in attempt fails, OR
  - The user explicitly presses “Retry” after a failure

**Why:** Even if the health check is imperfect, it can’t be allowed to block all sign-ins again.

---

### 3) Add one clear “where did it fail” marker (diagnostics you can trust)
**Files:**
- `src/contexts/AuthContext.tsx` (signIn + signUp)
- Portal login pages (handleLogin)

Add console markers like:
- `[Auth] healthCheck: start/result`
- `[Auth] signInWithPassword: start/result`
- Include the current `window.location.origin` and whether `VITE_SUPABASE_URL` exists (boolean only, no secrets)

**Why:** If it still fails after this, we’ll know whether the failure is before auth (health) or at auth (token request/CORS/blocked).

---

### 4) Quick verification steps (published web)
After changes are applied and republished:

1) Open the **published** site in an incognito window.
2) Attempt email/password sign-in.
   - Expected outcomes:
     - Wrong password: you should see “Invalid login credentials” (proves network works)
     - Correct password: you should land in the dashboard
3) Attempt Google/Apple:
   - Should redirect back and land in the app (or show unauthorized if your authorization enforcement triggers).

If it still fails, we will use the new console markers + the “Copy diagnostics” output to pinpoint the exact failing request and fix the underlying CORS/origin configuration accordingly.

---

## Why this started happening “now”
This isn’t random. It’s extremely consistent with the change we introduced:
- Adding a **blocking pre-flight network call** (HEAD) before sign-in.
If that call fails due to CORS/method handling on the published domain, the app will fail sign-in 100% of the time—exactly what you’re seeing.

---

## Files we’ll touch
- `src/utils/authNetwork.ts` (fix health check method/endpoint)
- `src/contexts/AuthContext.tsx` (make health check non-blocking + add markers)
- `src/pages/portal/PortalLogin.tsx` (non-blocking + markers)
- `src/pages/vendor-portal/VendorLogin.tsx` (non-blocking + markers)
- `src/pages/subcontractor-portal/SubcontractorLogin.tsx` (non-blocking + markers)

