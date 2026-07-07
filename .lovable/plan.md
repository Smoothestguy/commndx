## Problem

JESUS PABON reports that after filling in phone + date of birth on step 1 of his onboarding form and clicking **Next**, the entire screen goes black. His personnel record (`95bacd76-…`) has all address fields null, so step 2 is rendering with empty values — nothing obvious in the JSX explains a crash.

The reason we can't see *why* it crashes:
- There is **no ErrorBoundary anywhere in the app** (`rg ErrorBoundary` returns nothing).
- When any React render throws, the whole tree unmounts → dark theme shows the black `bg-background` with no content = "black screen".
- Jesus is on his phone, so we have no console access.

## Fix (2 parts)

### 1. Add a global ErrorBoundary so users never see a black screen again

New file `src/components/ErrorBoundary.tsx` — class component that catches render errors and shows a friendly recovery card (title, short message, "Try again" reload button, and the error message in a collapsible for support). Wrap `<App />` in `src/main.tsx` (and additionally wrap the onboarding route content in `App.tsx` with a second boundary so a crash there doesn't blow up the whole shell).

This alone converts "black screen" into a visible, actionable error and lets Jesus continue after a reload with his session-restored progress.

### 2. Harden `src/pages/PersonnelOnboarding.tsx` against the two most likely step-1→step-2 crash sources

- **`setState-during-render` block (lines 255–272)**: currently `if (validationResult?.personnel && !initialized) { setFormData(...); setInitialized(true); }` runs unconditionally on every render. Move this into a `useEffect` keyed on `validationResult?.personnel?.id` so it can't cause an update loop when step changes.
- **sessionStorage save (lines 232–250)**: wrap the whole payload build (not just the `setItem`) in try/catch, and skip saving if `formData.documents` contains any non-serializable value (e.g. a `File` object). Circular/non-JSON values would throw synchronously in the effect and unmount the tree.
- Add a `console.error` on caught errors so if Jesus tries again from a device we can inspect, we get a stack.

## Files touched

```text
src/components/ErrorBoundary.tsx      (new)
src/main.tsx                          (wrap <App/>)
src/App.tsx                           (wrap /onboarding/:token route)
src/pages/PersonnelOnboarding.tsx     (move init to useEffect, harden save)
```

## Out of scope

- No visual/design changes to the onboarding steps.
- No DB or RLS changes — Jesus's record is fine, `onboarding_status = pending`, token is valid.

## Verification

- Load `/onboarding/<token>` on desktop, fill step 1, click Next → step 2 renders (regression check).
- Force a throw inside step 2 render temporarily → confirm the ErrorBoundary card appears instead of a black screen.
- Ask Jesus to retry; if it still fails, the ErrorBoundary will now show the actual message and we can pinpoint it in one more pass.
