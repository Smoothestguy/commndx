
# Export Dev Activities Logs

## Overview

Add export functionality to the Dev Activities Dashboard, allowing users to download their development activity logs in CSV or JSON format. This mirrors the existing export pattern used in the Session History table.

## Current State

- **Dev Activities Dashboard** (`src/components/session/DevActivityDashboard.tsx`) displays a timeline of dev activities with filtering and search
- **Export utilities** already exist in `src/utils/exportUtils.ts` with `exportToCSV`, `exportToJSON`, and `downloadFile` helpers
- **Session History table** has an existing CSV export button that can serve as a UI pattern reference

## Implementation

### Changes to DevActivityDashboard.tsx

Add an export dropdown button next to the existing action buttons (Upload Screenshot, Add Manual, Select):

**UI Elements:**
- Add a "Download" dropdown button with CSV and JSON options
- Place it in the action bar alongside existing buttons
- Disable when no activities are available

**Export Data Fields:**
| Field | Description |
|-------|-------------|
| Date | Activity date (formatted) |
| Time | Activity time (if set) |
| Type | Activity type label (e.g., "Git Commit", "Bug Fix") |
| Title | Activity title |
| Description | Full description text |
| Duration | Duration in minutes (or formatted) |
| Project | Project name |
| Technologies | Comma-separated list of technologies |
| Tags | Comma-separated list of tags |

### New Export Functions in exportUtils.ts

Add dev activity-specific export functions:

```typescript
export const exportDevActivitiesToCSV = (activities: DevActivity[], filename: string) => {
  const headers = ['Date', 'Time', 'Type', 'Title', 'Description', 'Duration (min)', 'Project', 'Technologies', 'Tags'];
  
  const rows = activities.map(activity => [
    activity.activity_date,
    activity.activity_time || '',
    getActivityTypeLabel(activity.activity_type),
    activity.title,
    activity.description || '',
    activity.duration_minutes?.toString() || '',
    activity.project_name || '',
    activity.technologies.join('; '),
    activity.tags.join('; ')
  ]);
  // ... CSV generation logic
};

export const exportDevActivitiesToJSON = (activities: DevActivity[], filename: string) => {
  // Format activities with readable type labels
  // ... JSON generation logic
};
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/utils/exportUtils.ts` | Add `exportDevActivitiesToCSV` and `exportDevActivitiesToJSON` functions |
| `src/components/session/DevActivityDashboard.tsx` | Add export dropdown button with CSV/JSON options |

## Technical Details

### Export Button Component

```tsx
// In the actions row, add:
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm" disabled={activities.length === 0}>
      <Download className="h-4 w-4 mr-2" />
      Export
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={handleExportCSV}>
      Export as CSV
    </DropdownMenuItem>
    <DropdownMenuItem onClick={handleExportJSON}>
      Export as JSON
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Export Behavior

- Exports the **filtered** activities (respects search, type filter, and project filter)
- Filename format: `dev-activities-YYYY-MM-DD.csv` or `.json`
- Shows toast notification on successful export
- Shows error toast if no activities to export

### Activity Type Label Mapping

Use the existing `ACTIVITY_TYPES` constant to map type values to human-readable labels:
- `git_commit` → "Git Commit"
- `bug_fix` → "Bug Fix"
- etc.
