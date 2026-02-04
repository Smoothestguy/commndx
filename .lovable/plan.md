
## What’s most likely happening (why it worked before, and why it’s failing now)

“Failed to fetch” is not an “invalid password” type of error. It means the app did not successfully complete the network request at all (the browser/device never got an HTTP response). That typically comes from one of these:

1) **The authentication endpoint can’t be reached from the user’s environment** (DNS/SSL/network routing issue, captive portal, iOS networking quirks, etc.).
2) **The app is making requests to an undefined/incorrect backend URL at runtime** (env/config mismatch in the published build).
3) **A request is hanging indefinitely** and the UI reports it as a generic fetch failure (no timeout/retry, poor error surfacing).
4) **OAuth completes but session setup fails** (e.g., setSession fails silently / storage issues), causing the app to bounce back to login.

Important context from our repo inspection:
- In the Preview environment, requests to the auth endpoint succeed (we can reproduce a normal 400 Invalid credentials).
- You’re seeing failures on the **published web URL**, and all sign-in methods are affected. That strongly suggests a **runtime environment / published-build config / request handling** issue rather than “bad credentials.”

## Goals

1) Stop showing a vague “Failed to fetch” with no actionable info.
2) Add a **safe, user-friendly “auth health check”** and **structured diagnostics** (without exposing secrets).
3) Add **timeouts + retries** so transient network hiccups don’t look like a total outage.
4) Make OAuth flows more resilient: if tokens return but session setup fails, we show a precise message and a recovery path.

---

## Implementation Plan (code changes)

### A) Add a small “Network/Auth Diagnostics” utility
Create a new utility module (e.g. `src/utils/authNetwork.ts`) that provides:

1. **withTimeout(promise, ms)**  
   - Uses `AbortController` (where applicable) or a wrapper timeout to prevent hangs.
   - Returns a consistent error object.

2. **classifyNetworkError(err)**  
   - Detects `TypeError: Failed to fetch`, abort errors, and other common network failures.
   - Produces a user-safe message like:
     - “Can’t reach the sign-in service. Please check your connection and try again.”
     - Plus a “Details” string for logs (not UI) containing: current origin, whether backend URL is defined, and which endpoint was being called.

3. **pingAuthHealth()**  
   - Calls `GET {backendUrl}/auth/v1/health` (or a lightweight endpoint) with a short timeout (e.g. 3–5 seconds).
   - If this fails, we can immediately show “Network issue” instead of attempting login and failing in a less clear way.

Notes:
- We will not show backend URLs or keys to users, but we will log them to console in a redacted way for debugging.

---

### B) Instrument all login entrypoints (not just AuthContext)
Right now, there are multiple login paths:
- `src/pages/Auth.tsx` uses `useAuth().signIn()`
- `src/pages/portal/PortalLogin.tsx` uses `supabase.auth.signInWithPassword` directly
- `src/pages/vendor-portal/VendorLogin.tsx` uses it directly
- `src/pages/subcontractor-portal/SubcontractorLogin.tsx` also uses it directly (found via search)

We will update each to:
1) Run `await pingAuthHealth()` before attempting sign-in.
2) Wrap the sign-in call in a timeout (e.g. 10–15 seconds).
3) On error:
   - If it’s a network failure, show a dedicated toast:
     - “Network issue: can’t reach sign-in service. Try again in a moment.”
   - Otherwise show the actual auth error (invalid credentials, etc.).
4) Ensure loading spinners always stop in `finally`.

Outcome: whichever login page a user uses, they get consistent behavior and clear errors.

---

### C) Make OAuth flows provide better recovery (Apple/Google “bounces back”)
Update `src/contexts/AuthContext.tsx` OAuth methods to:
1) If `lovable.auth.signInWithOAuth(...)` returns tokens but `supabase.auth.setSession(...)` fails:
   - Show a specific toast: “Sign-in completed but the app couldn’t save the session. Please try again.”
   - Log a detailed console error including the caught exception and a hint if `localStorage` is blocked/unavailable.
2) Add a short “post-OAuth health validation”:
   - after setting session, call `supabase.auth.getSession()` with timeout to confirm session is present.
   - If not present, show a dedicated message.

Outcome: instead of silently returning to login, users see why and what to do.

---

### D) Add a “diagnostic banner” only when auth requests fail (published-safe)
In `src/pages/Auth.tsx` (and optionally portal logins), when we detect a network error:
- Render a small inline panel under the form:
  - “We’re having trouble reaching the sign-in service.”
  - Buttons:
    - “Retry”
    - “Copy diagnostics” (copies a short text block: timestamp, route, app version string, origin, and a yes/no for whether backend URL is present; no secrets)
This helps you (and Apple review / support) diagnose quickly without guessing.

---

### E) Confirm published build is actually running the same code (cache/version check)
Add a lightweight **build version string** displayed only in the console on app start (and optionally in the diagnostics copy text).
- Example: `console.info("[Build] version:", __BUILD_VERSION__)`
- Use Vite define or a simple constant file.
This helps detect if someone is loading a cached older bundle.

---

## Investigation/Validation Steps (done alongside implementation)

1) In our controlled preview environment:
   - Confirm email/password shows “Invalid credentials” for wrong login (proves network works).
   - Confirm OAuth reaches callback and sets a session.
2) After implementing the above:
   - Re-test on the **published URL** and confirm:
     - If backend is reachable, invalid credentials show properly (no “Failed to fetch”).
     - If backend is not reachable, the UI shows the health-check error panel and offers “Copy diagnostics.”

---

## Why these issues might have appeared “suddenly”
Based on what we can see:
- The code currently doesn’t apply timeouts/retries or a pre-flight health check, so any transient network/SSL hiccup becomes a scary generic “Failed to fetch.”
- You have multiple login pages doing their own sign-in logic; one fix in AuthContext doesn’t automatically protect the portal pages.
- OAuth flows can succeed at the provider but still fail to store the session locally; without explicit validation, that looks like “it just sends me back to login.”

This plan doesn’t just patch one spot; it hardens every sign-in route and makes failures diagnosable.

---

## Files we will likely change

- `src/contexts/AuthContext.tsx` (wrap signIn/signUp + OAuth with health check, timeout, better error messaging)
- `src/pages/Auth.tsx` (use new diagnostics, show banner/panel on network failures)
- `src/pages/portal/PortalLogin.tsx` (health check + timeout + consistent errors)
- `src/pages/vendor-portal/VendorLogin.tsx` (health check + timeout + consistent errors)
- `src/pages/subcontractor-portal/SubcontractorLogin.tsx` (health check + timeout + consistent errors)
- `src/utils/authNetwork.ts` (new)
- Optional: a small `src/constants/buildInfo.ts` or Vite define usage for build version logging

---

## Rollout / App Store sensitivity note (non-technical)
After we implement this, you should:
- Test sign-in end-to-end on the published web app.
- Then create a new native build so the App Store/TestFlight build includes the fixes (native builds don’t automatically update when web code changes, depending on how you packaged it).

