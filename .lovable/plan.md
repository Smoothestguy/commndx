

## Fix: Personnel Onboarding Form Data Getting Erased

### Root Cause

The onboarding form stores all data in React `useState` — purely in-memory. When people fill out the form on their phones (which is most common), their data gets wiped whenever:

1. **They switch apps** (e.g., to take a photo of their ID, check email for info, open their banking app for routing numbers) — mobile browsers often kill the background tab to save memory, and when they come back the page reloads from scratch.
2. **The phone screen locks/unlocks** — same effect on many devices.
3. **They accidentally swipe back** or the browser refreshes.

Since the form has 8 steps with sensitive data entry, document uploads, and signatures, it's very likely people are switching apps mid-form and coming back to a blank form.

### The Fix

**Persist form data to `sessionStorage`** keyed by the onboarding token. Every time the user updates a field or changes steps, save the current form state. When the component mounts, restore from `sessionStorage` if data exists.

**Files to change:**
- `src/pages/PersonnelOnboarding.tsx`

**What changes:**
1. Add a `useEffect` that saves `formData` and `currentStep` to `sessionStorage` whenever they change (debounced to avoid excessive writes).
2. On component mount, check `sessionStorage` for saved data for this token and restore it — including the step they were on.
3. Exclude signatures from `sessionStorage` (they're large base64 strings) — users will need to re-sign if the page reloads, but all text fields, selections, and step progress will be preserved.
4. Clear `sessionStorage` on successful submission.
5. Show a subtle toast when restoring saved progress so users know their data wasn't lost.

### Technical Details

```text
Storage key: `onboarding-progress-${token}`
Stored data: { formData (minus signatures), currentStep, agreedToTerms, timestamp }
Restore logic: On mount, if saved data exists and is < 24 hours old, restore it
Clear: On successful submit or if token is invalid/expired
```

The `initialized` flag logic (line 176-193) will also be updated to not overwrite restored `sessionStorage` data — currently it only pre-fills from the personnel record, but if the user already typed new values those should take priority.

