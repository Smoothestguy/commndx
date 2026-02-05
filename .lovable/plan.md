

# Session Time Edit Feature for Session History

## Overview
Add the ability for admins/managers to edit session start and end times directly in the Session History page for any user they're viewing. This includes:
1. Adding a new session manually
2. Editing existing session start time
3. Editing existing session end time

## Current System Analysis

### `user_work_sessions` Table Structure
| Field | Type | Description |
|-------|------|-------------|
| `session_start` | timestamp | Start time (editable) |
| `session_end` | timestamp | End time (editable) |
| `total_active_seconds` | number | Needs recalculation on edit |
| `total_idle_seconds` | number | Preserved on edit |
| `is_active` | boolean | Set based on session_end |
| `clock_in_type` | string | Set to 'admin_edit' on manual changes |

### Existing Components
- `SessionHistoryTable.tsx` - Displays sessions with edit capability needed
- `EditClockInTimeDialog.tsx` - Pattern for time edit dialogs (for time_entries)
- `useAdminClockEdit.ts` - Pattern for admin edit hooks

## Implementation Plan

### 1. Create Session Edit Dialog Component

**File**: `src/components/session/EditSessionTimeDialog.tsx`

A modal dialog that allows editing both start and end times:
- Shows current session start and end times
- DateTime pickers for new start and end times
- Validation:
  - Start cannot be in the future
  - Start cannot be after end
  - End cannot be before start
  - End cannot be in the future (unless marking as active)
- Shows hours impact preview
- Requires confirmation checkbox
- Logs changes to audit trail

### 2. Create Add Session Dialog Component

**File**: `src/components/session/AddSessionDialog.tsx`

A modal dialog for creating a new session:
- User selector (pre-filled with currently viewed user)
- Date picker for session date
- Start time picker
- End time picker (optional - leave blank for active session)
- Validation rules same as edit dialog
- Sets `clock_in_type: 'admin_manual'`

### 3. Create Hook for Session Edits

**File**: `src/hooks/useSessionEdit.ts`

Custom hook providing:
- `updateSessionTimes` mutation - Updates start/end times
- `createSession` mutation - Creates new session
- Automatic recalculation of `total_active_seconds`
- Preserves `total_idle_seconds`
- Audit logging for all changes

**Key Logic**:
```typescript
// Recalculate active seconds when times change
const start = new Date(newSessionStart);
const end = newSessionEnd ? new Date(newSessionEnd) : new Date();
const totalSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
const idleSeconds = session.total_idle_seconds || 0;
const activeSeconds = Math.max(0, totalSeconds - idleSeconds);
```

### 4. Update SessionHistoryTable

**File Modification**: `src/components/session/SessionHistoryTable.tsx`

Add to the table:
- Edit (pencil) icons next to Start and End time columns
- "Add Session" button in the card header
- Pass `isAdmin` prop to control visibility
- Connect to edit/add dialogs

### 5. Update SessionHistory Page

**File Modification**: `src/pages/SessionHistory.tsx`

- Pass `isAdmin` prop to `SessionHistoryTable`
- Import and render the new dialogs

## UI Design

### Desktop Table View (Updated)
```text
+-------------------------------------------------------------------------+
| Session History                                        [+ Add] [Export] |
+-------------------------------------------------------------------------+
| Date       | Start      | End        | Active  | Idle   | Earnings | ...|
|------------|------------|------------|---------|--------|----------|-----|
| Feb 5, 2026| 9:00 AM ✏️ | 5:30 PM ✏️ | 8h 15m  | 15m    | $165.00  | ... |
| Feb 4, 2026| 8:45 AM ✏️ | Active     | 2h 30m  | 5m     | $50.00   | ... |
+-------------------------------------------------------------------------+
```

### Edit Session Time Dialog
```text
+--------------------------------------------------+
|  Edit Session Time                               |
+--------------------------------------------------+
|  User: John Doe                                  |
|  Date: February 5, 2026                          |
|                                                  |
|  Session Start: *                                |
|  [Date/Time Picker: 2026-02-05 09:00       ]     |
|                                                  |
|  Session End:                                    |
|  [Date/Time Picker: 2026-02-05 17:30       ]     |
|  [ ] Leave as Active (no end time)               |
|                                                  |
|  ⚠️ This will change total time from 8h 30m     |
|     to 8h 15m                                    |
|                                                  |
|  [✓] I confirm this change is accurate          |
|                                                  |
|  [Cancel]                    [Save Changes]      |
+--------------------------------------------------+
```

### Add Session Dialog
```text
+--------------------------------------------------+
|  Add Session                                     |
+--------------------------------------------------+
|  User: John Doe (viewing)                        |
|                                                  |
|  Date: *                                         |
|  [Date Picker: February 5, 2026          ]       |
|                                                  |
|  Start Time: *                                   |
|  [Time Picker: 09:00 AM                  ]       |
|                                                  |
|  End Time:                                       |
|  [Time Picker: 05:30 PM                  ]       |
|  [ ] Mark as Active Session (no end time)        |
|                                                  |
|  [Cancel]                      [Add Session]     |
+--------------------------------------------------+
```

## Data Flow

```text
[SessionHistoryTable]
        |
   +----+----+
   |         |
[Edit ✏️]  [+ Add]
   |         |
   v         v
[EditSessionTimeDialog]  [AddSessionDialog]
        |                      |
        v                      v
   [useSessionEdit hook]
        |
        +---> Update session_start/session_end
        +---> Recalculate total_active_seconds
        +---> Set clock_in_type: 'admin_edit' or 'admin_manual'
        +---> Log to audit_logs
        |
        v
   [Invalidate queries]
   - session-history
   - session-stats
   - today-sessions
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/session/EditSessionTimeDialog.tsx` | Create | Modal for editing session start/end times |
| `src/components/session/AddSessionDialog.tsx` | Create | Modal for adding new sessions |
| `src/hooks/useSessionEdit.ts` | Create | Hook for session CRUD operations with audit logging |
| `src/components/session/SessionHistoryTable.tsx` | Modify | Add edit icons, Add button, connect dialogs |
| `src/pages/SessionHistory.tsx` | Modify | Pass isAdmin prop, render dialogs |

## Validation Rules

1. **Start Time**:
   - Required
   - Cannot be in the future
   - Cannot be after end time (if end time set)

2. **End Time**:
   - Optional (if blank, session is marked active)
   - Cannot be before start time
   - Cannot be in the future

3. **Hours Recalculation**:
   - `total_active_seconds = (end - start) - total_idle_seconds`
   - Preserve existing `total_idle_seconds`
   - Active sessions use current time for calculation

## Audit Trail

All changes logged with:
```typescript
{
  actionType: "update" | "create",
  resourceType: "user_work_session",
  resourceId: session.id,
  changesBefore: { session_start, session_end, total_active_seconds },
  changesAfter: { session_start, session_end, total_active_seconds },
  metadata: {
    edit_type: "session_time_adjustment" | "session_manual_add",
    target_user_id: userId
  }
}
```

## Security

- Edit/Add buttons only visible to admins (using `isAdmin` from `useUserRole`)
- All mutations validate user has admin role
- Changes are tracked in audit logs with the admin's user ID

