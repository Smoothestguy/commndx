
# Fix: Idle Events Written to Wrong Session After Clock-Out/Clock-In

## Problem Identified

Your idle time shows 1hr 29min instead of ~29 min because of a **race condition** when clocking out and back in:

1. Session `e621d2c8` ended at 21:49:04 (lasted 3.5 minutes)
2. You clocked into new session `c335ab93` at 21:49:06
3. BUT idle events at 22:06:42 and 22:52:04 were logged to the OLD session `e621d2c8`
4. This added 46 minutes of false idle to a session that was already closed

The result: That 3.5-minute session now has 2721 seconds (45+ minutes) of idle time, which inflates your daily total.

## Root Cause

In `useSessionTracking.ts`, when the idle timeout fires (lines 139-165) or when `resetIdleTimer` logs `idle_end` (lines 123-131), it uses the `sessionId` from React state. However:

1. The `sessionId` state update from `clockIn` may not have propagated yet
2. The `idleTimeoutRef` was set up with a closure that captured the OLD `sessionId`
3. Events are logged to whatever `sessionId` the closure captured, not the current one

## Solution

### 1. Immediate Data Fix

Fix the corrupted session in the database:
- Session `e621d2c8-66fb-4590-b751-6927d4e57e7d`: Recalculate idle to 0 (it was only 3.5 minutes with no valid idle events during its window)

### 2. Code Fix: Use Ref for Session ID in Event Logging

Track `sessionId` in a ref so closures always get the current value:

**File: `src/hooks/useSessionTracking.ts`**

```typescript
// Add a ref to track current session ID
const sessionIdRef = useRef<string | null>(null);

// Keep ref in sync with state
useEffect(() => {
  sessionIdRef.current = sessionId;
}, [sessionId]);

// In resetIdleTimer and idle timeout, use sessionIdRef.current instead of sessionId
```

### 3. Code Fix: Clear Idle Timeout on Clock-Out

Ensure any pending idle timeout is cleared when clocking out so it can't fire for a closed session:

```typescript
// In clockOut, already done at line 671-674:
if (idleTimeoutRef.current) {
  clearTimeout(idleTimeoutRef.current);
  idleTimeoutRef.current = null;
}
```

But also need to do this BEFORE creating a new session in `clockIn` if resuming from a previous state.

### 4. Code Fix: Validate Session is Active Before Logging Events

Add a guard to prevent logging events to closed sessions:

```typescript
// Before logging idle_start or idle_end:
if (!isClockedIn || !sessionIdRef.current) return;
```

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useSessionTracking.ts` | Add sessionIdRef, use in closures, validate before logging |

## Technical Details

### The Race Condition Flow

```text
21:49:04 - Clock out from session A (e621d2c8)
         - idleTimeoutRef still has closure with sessionId = "e621d2c8"
21:49:06 - Clock in to session B (c335ab93)
         - setSessionId("c335ab93") called
         - BUT old closure in idleTimeoutRef still references "e621d2c8"
22:06:42 - Idle timeout fires (5 min of inactivity)
         - Logs idle_start to "e621d2c8" (wrong session!)
22:52:04 - User activity detected
         - Logs idle_end to "e621d2c8" (wrong session!)
```

### Fix: Ref-Based Session ID

```typescript
// Line 35: Add ref
const [sessionId, setSessionId] = useState<string | null>(null);
const sessionIdRef = useRef<string | null>(null);

// Line 419 area: Keep in sync
useEffect(() => {
  sessionIdRef.current = sessionId;
}, [sessionId]);

// Line 123-131: Use ref instead of state
if (sessionIdRef.current && user && isPrimaryTabRef.current) {
  supabase.from("session_activity_log").insert([{
    session_id: sessionIdRef.current,  // Use ref
    // ...
  }]);
}

// Line 156-163: Use ref instead of state
if (sessionIdRef.current && user) {
  supabase.from("session_activity_log").insert([{
    session_id: sessionIdRef.current,  // Use ref
    // ...
  }]);
}
```

### Additional Guard: Check Session is Still Active

```typescript
// In idle timeout callback (line 139):
idleTimeoutRef.current = setTimeout(() => {
  // Add guard: only log if still clocked in with valid session
  if (!isClockedIn || !sessionIdRef.current) return;
  if (document.hidden) return;
  // ... rest of code
}, IDLE_TIMEOUT_MS);
```

## Expected Result

After the fix:
- Your corrupted session will be corrected (45 min idle removed)
- Future sessions won't have idle events logged to closed sessions
- Daily total will accurately reflect actual idle time
