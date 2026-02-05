

# Admin Clock-In Time Adjustment Feature

## Overview
Add an admin-only feature to manually adjust clock-in times for time entries in the User Management section. This allows administrators to correct clock-in times when personnel clock in late or have timing issues.

## Current System Analysis

### Relevant Data Structures
The `time_entries` table already has all necessary fields:
- `clock_in_at` (timestamp) - The clock-in timestamp to be edited
- `clock_out_at` (timestamp) - Clock-out time (for validation)
- `clock_in_lat`, `clock_in_lng`, `clock_in_accuracy` - Location data (to preserve)
- `entry_source` (string) - Can be set to `admin_edit` after modification
- `hours`, `regular_hours`, `overtime_hours` - Need recalculation

### Existing Components
- `useTimeClock.ts` - Clock in/out mutations and queries
- `useAuditLog.ts` - Audit logging with `computeChanges` helper
- `UserManagement.tsx` - Target page for the feature (has tabs for Users, Invitations, Activity)

## Implementation Plan

### 1. Create Clock-In Edit Dialog Component

**File**: `src/components/user-management/EditClockInTimeDialog.tsx`

A modal dialog that:
- Shows the current clock-in time
- Provides a datetime picker for the new clock-in time
- Shows validation warnings (e.g., if new time would be after clock-out or in the future)
- Requires confirmation before saving
- Displays original location data (lat/lng) that will be preserved

**UI Elements**:
- Entry details header (Personnel name, project, date)
- Current clock-in time display
- DateTime picker for new time
- Warning banners for validation issues
- Confirmation checkbox
- Save/Cancel buttons

### 2. Create Hook for Admin Clock-In Edits

**File**: `src/integrations/supabase/hooks/useAdminClockEdit.ts`

A custom hook that:
- Fetches time entries with clock-in data for a date range
- Provides mutation for updating `clock_in_at`
- Automatically recalculates `hours`, `regular_hours`, `overtime_hours`
- Sets `entry_source: 'admin_edit'` after modification
- Logs changes to audit log

**Key Logic**:
```typescript
// Recalculate hours when clock_in_at changes
const clockIn = new Date(newClockInAt);
const clockOut = entry.clock_out_at ? new Date(entry.clock_out_at) : null;
if (clockOut) {
  const totalMs = clockOut.getTime() - clockIn.getTime();
  const lunchMs = (entry.lunch_duration_minutes || 0) * 60 * 1000;
  const workMs = totalMs - lunchMs;
  const hoursWorked = Math.max(0, workMs / (1000 * 60 * 60));
}
```

### 3. Add Time Clock Management Tab to User Management

**File Modification**: `src/pages/UserManagement.tsx`

Add a new tab "Time Clock Admin" (visible only to admins) that:
- Shows recent clock entries (last 7 days by default)
- Displays clock-in/out times with personnel and project info
- Includes "Edit Clock-In" button (pencil icon) for each entry
- Filters by date range and personnel

### 4. Update Audit Logging Types

**File Modification**: `src/hooks/useAuditLog.ts`

Add `clock_in_edit` action type to the existing types for proper categorization of these edits.

## Technical Implementation Details

### Permission Check
```typescript
// Only admins can edit clock-in times
if (!isAdmin) {
  return null; // Don't show the tab/feature
}
```

### Validation Rules
1. New clock-in time cannot be in the future
2. New clock-in time cannot be after clock-out time (if clocked out)
3. New clock-in time must be on the same calendar day as the original entry
4. Show warning if change results in negative or zero hours

### Audit Log Entry Format
```typescript
{
  actionType: "update",
  resourceType: "time_entry",
  resourceId: entry.id,
  changesBefore: { 
    clock_in_at: originalTime,
    hours: originalHours,
    entry_source: originalSource
  },
  changesAfter: { 
    clock_in_at: newTime,
    hours: recalculatedHours,
    entry_source: "admin_edit"
  },
  metadata: {
    edit_type: "clock_in_adjustment",
    personnel_id: entry.personnel_id,
    project_id: entry.project_id
  }
}
```

### Data Flow Diagram
```text
[User Management Page]
        |
        v
[Time Clock Admin Tab] (admin only)
        |
        v
[Clock Entry List]
   - Shows entries with clock_in_at
   - Edit button per entry
        |
        v
[EditClockInTimeDialog]
   - Current time display
   - New time picker
   - Validation warnings
   - Confirmation required
        |
        v
[useAdminClockEdit mutation]
   - Update clock_in_at
   - Recalculate hours
   - Set entry_source: 'admin_edit'
   - Preserve location data
   - Log to audit_logs
        |
        v
[Invalidate queries]
   - time-entries
   - clock-history
   - admin-time-entries
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/user-management/EditClockInTimeDialog.tsx` | Create | Modal for editing clock-in time with validation |
| `src/components/user-management/TimeClockAdminTab.tsx` | Create | New tab component showing clock entries with edit capabilities |
| `src/integrations/supabase/hooks/useAdminClockEdit.ts` | Create | Hook for fetching/updating clock entries as admin |
| `src/pages/UserManagement.tsx` | Modify | Add "Time Clock Admin" tab (admin-only) |
| `src/hooks/useAuditLog.ts` | Modify | Add `clock_in_edit` action type |

## UI Mockup

```text
+------------------------------------------------------------------+
|  User Management                                                  |
+------------------------------------------------------------------+
|  [Users] [Invitations] [Activity] [Time Clock Admin*]            |
+------------------------------------------------------------------+
|  * Admin only                                                     |
|                                                                   |
|  Time Clock Administration                                        |
|  -----------------------------------------------------------------|
|  Date Range: [Last 7 days v]  Personnel: [All v]  [Filter]       |
|  -----------------------------------------------------------------|
|  | Personnel       | Project     | Clock In      | Clock Out    ||
|  |-----------------|-------------|---------------|---------------||
|  | John Doe        | Site A      | 8:15 AM [✏️]  | 5:00 PM      ||
|  | Jane Smith      | Site B      | 9:30 AM [✏️]  | Active       ||
|  | Bob Wilson      | Site A      | 7:45 AM [✏️]  | 4:30 PM      ||
+------------------------------------------------------------------+

[Edit Clock-In Time Dialog]
+--------------------------------------------------+
|  Edit Clock-In Time                              |
+--------------------------------------------------+
|  Personnel: John Doe                             |
|  Project: Site A                                 |
|  Date: Jan 15, 2026                              |
|                                                  |
|  Current Clock-In: 8:15:32 AM                    |
|  Location: Preserved (lat: 34.05, lng: -118.24) |
|                                                  |
|  New Clock-In Time:                              |
|  [Date/Time Picker: 8:00:00 AM              ]    |
|                                                  |
|  ⚠️ This will change total hours from 8.75h     |
|     to 9.0h                                      |
|                                                  |
|  [✓] I confirm this change is accurate          |
|                                                  |
|  [Cancel]                    [Save Changes]      |
+--------------------------------------------------+
```

## Security Considerations

1. **Admin-only access**: Feature is gated behind `isAdmin` check using the existing `useUserRole` hook
2. **Audit trail**: All changes are logged with before/after values, user who made the change, and timestamp
3. **Entry source marking**: Modified entries are marked with `entry_source: 'admin_edit'` for transparency
4. **Preserve location data**: Original clock-in location is preserved to maintain GPS verification history

