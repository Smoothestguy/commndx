

# Fix WH-347 Export Option Not Visible

## Problem Identified

The WH-347 export option is not visible in the Weekly View because:

1. The export option is conditionally rendered and only appears when a **project is selected** (`projectFilter` is set)
2. The current Weekly View on `/time-tracking` uses `WeeklyTimesheet` **without** a project selector
3. WH-347 is intentionally project-specific (certified payroll must be per-project for Davis-Bacon compliance)

## Current Code Flow

| Component | Project Selection | WH-347 Visible |
|-----------|------------------|----------------|
| `TimeTracking.tsx` → `WeeklyTimesheet` | No | No |
| `WeeklyTimesheetWithProject` | Yes (has dropdown) | Yes (when project selected) |

## Solution

Replace `WeeklyTimesheet` with `WeeklyTimesheetWithProject` in the Weekly View tab. This component already has a project dropdown selector built in.

### File to Modify

**`src/pages/TimeTracking.tsx`**

Change this:
```tsx
import { WeeklyTimesheet } from "@/components/time-tracking/WeeklyTimesheet";
```

To:
```tsx
import { WeeklyTimesheetWithProject } from "@/components/time-tracking/WeeklyTimesheetWithProject";
```

And update the Weekly View tab content (around line 290):

```tsx
<TabsContent value="weekly" className="space-y-4 mt-4">
  {/* Week Navigator */}
  <div className="flex justify-center">
    <WeekNavigator
      currentWeek={weeklyViewWeek}
      onWeekChange={setWeeklyViewWeek}
    />
  </div>

  {/* Weekly Timesheet with Project Selector */}
  <WeeklyTimesheetWithProject
    currentWeek={weeklyViewWeek}
    onWeekChange={setWeeklyViewWeek}
  />
</TabsContent>
```

## How to Export WH-347 After This Fix

1. Go to **Time Tracking** page
2. Click the **Weekly View** tab
3. Select a **specific project** from the Project dropdown
4. Click **Export Week** dropdown
5. Select **Export WH-347 Certified Payroll**

## Visual Flow After Fix

```text
/time-tracking
     |
     v
[Weekly View Tab]
     |
     v
[Project Dropdown: All Projects ▼]
  → Select "Project XYZ"
     |
     v
[Export Week ▼]
  • Export to Excel
  • Export to CSV
  • Export to PDF
  • Export to JSON
  ─────────────────
  • Export WH-347 ← NOW VISIBLE
```

