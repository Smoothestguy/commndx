
# Fix: Reset All Today's Sessions Idle Time

## Problem Identified

When clicking "Reset idle time to zero", only the **current active session** is reset. However, the UI shows **today's totals** which includes idle time from **all sessions today** (based on local timezone).

Your situation:
- **Current session**: 0 idle seconds (reset worked)
- **Previous session from today**: 4124 seconds (~1h 8m) idle - NOT reset
- **UI shows**: 1:08:44 total idle (sum of both sessions)

## Solution

Modify the reset function to fix idle time for **all of today's sessions**, not just the current active one.

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/fix-session-idle/index.ts` | Add support for `fixAllToday` mode that resets all sessions from today |
| `src/components/session/SessionTimer.tsx` | Update to call the edge function with the new mode |

---

## Technical Changes

### 1. Update `fix-session-idle/index.ts`

Add a new mode `fixAllToday` that:
1. Finds all sessions from today (using the same timezone logic as the frontend)
2. Sets `total_idle_seconds = 0` for each session
3. Returns the count of sessions fixed

New request body option:
```json
{
  "mode": "fixAllToday",
  "startOfToday": "2026-01-30T05:00:00.000Z"  // Frontend sends local midnight in UTC
}
```

### 2. Update `SessionTimer.tsx`

Change `handleFixIdleTime` to:
1. Calculate `startOfToday` the same way `useTodaySessions` does
2. Call edge function with `mode: "fixAllToday"` and the start timestamp
3. This will reset idle for all sessions shown in the "Today's Totals"

---

## Why This Fixes the Issue

| Before | After |
|--------|-------|
| Only resets current active session | Resets ALL sessions included in today's totals |
| Previous session's 4124s idle remains | All sessions set to 0 idle |
| UI still shows 1:08:44 | UI shows 0:00:00 |

---

## Security Considerations

The edge function already:
- Validates the user is authenticated
- Checks if user is admin/manager OR the session owner
- We'll add the same ownership check for all sessions being modified
