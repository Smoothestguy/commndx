## Findings from the deep check

- Jesus Pabon's active onboarding link is valid, unused, not revoked, and expires later this month.
- His personnel record itself looks clean: status is pending, address fields are blank, and onboarding has not been completed.
- The app no longer goes fully black because the new error boundary is catching the crash, but the underlying onboarding render error still needs to be fixed.
- The most likely failure point is the onboarding form restoring a malformed/stale mobile draft from session storage, then rendering the next step with unsafe assumptions about `currentStep` and `formData` field types. If that draft is corrupt, pressing “Next” can immediately re-render into the error boundary, and “Try Again” can reload the same bad draft again.

## Plan to fix

1. **Reproduce the Jesus flow directly**
   - Open Jesus Pabon's current active onboarding link in a controlled browser run.
   - Fill phone/date of birth, click “Next,” and capture the exact thrown error if it appears.
   - Confirm whether it is caused by restored draft state, step index, field shape, or another component.

2. **Harden `PersonnelOnboarding.tsx` against bad saved progress**
   - Normalize restored form data instead of spreading raw session storage over defaults.
   - Force all text fields to safe strings, booleans to booleans, and arrays like `documents` / `emergency_contacts` to arrays.
   - Clamp restored `currentStep` to the valid range of steps.
   - If saved progress cannot be parsed safely, discard only that local draft and continue with a clean form instead of crashing.

3. **Make step rendering crash-safe**
   - Replace direct `STEPS[currentStep - 1]` access with a safe `activeStep` value.
   - Prevent `canProceed()` from calling `.trim()`, `.find()`, or `.length` on invalid restored values.
   - Add a safe `goToStep`/`handleNext` path so double taps or stale state cannot push the form outside steps 1–8.

4. **Fix the recovery loop**
   - Update the onboarding error boundary behavior so “Try Again” clears the corrupt onboarding draft before reloading.
   - Keep this scoped to onboarding draft keys only, not the rest of the app/session.
   - Adjust the fallback message so it does not promise progress is preserved when the recovery action must reset a bad local draft.

5. **Validate after the fix**
   - Re-run Jesus Pabon's onboarding route on the active token.
   - Verify phone/date of birth entry and “Next” lands on Step 2 Address without the error card.
   - Check console/runtime signals for any remaining onboarding errors.

## Technical notes

- No database migration should be needed based on the current evidence.
- This is a frontend state-hardening fix for the public onboarding route.
- The backend token/data for Jesus appears valid, so issuing another link alone would likely not solve the phone's local crash if a bad draft remains on that device.