

## Time Tracking -- Project Allocation and Overhead Analysis

This extends the existing time tracking module with an "Overhead" option, admin manual entry for field superintendents, per-project labor allocation views, supervision cost impact on margins, a company-wide overhead dashboard, and daily logging reminders.

### Current State

- `time_entries.project_id` already exists as a **NOT NULL** FK to projects. Workers select a project when clocking in or logging time.
- Labor costs already flow into the Project Financial Summary via `timeEntryCosts` (hours x pay_rate).
- The `EnhancedTimeEntryForm` already supports Admin/Manager logging time for selected personnel (daily and weekly modes with personnel multi-select).
- There is **no** concept of "overhead" -- every time entry must be tied to a project.
- There is **no** supervision cost breakout on the financial summary.
- There is **no** company-wide utilization/overhead report.
- There is **no** missing time entry reminder system.

---

### 1. Database Changes

**Add `is_overhead` column to `time_entries`:**
- `is_overhead` boolean, default false
- When true, the entry represents non-project work (admin, travel, payroll processing, etc.)
- `project_id` remains required (for overhead entries, use a designated "Overhead" project or keep the field as-is with the worker's primary project)

**Better approach -- make `project_id` NULLABLE:**
- ALTER `time_entries` to allow `project_id` to be NULL
- Add `is_overhead` boolean default false
- Add `overhead_category` text nullable (values: 'admin', 'travel', 'training', 'payroll', 'other')
- When `project_id` is NULL and `is_overhead` is true, the entry is overhead
- Existing entries remain unchanged (all have project_id set)

**Add `entry_type` column to `time_entries`:**
- `entry_type` text default 'project' (values: 'project', 'overhead')
- Simpler than nullable project_id -- keeps existing constraints intact
- Overhead entries still have a project_id (the project they were nominally on) but are flagged separately

**Decision: Use `is_overhead` boolean + `overhead_category` text, keep `project_id` NOT NULL**
- This is the safest approach -- no existing constraints break
- For overhead entries, admin selects a project OR we create a system "Overhead / Internal" project
- The `is_overhead` flag excludes these hours from project margin calculations but still tracks them

**No new tables needed.**

**Migration summary:**
```sql
ALTER TABLE time_entries ADD COLUMN is_overhead boolean DEFAULT false;
ALTER TABLE time_entries ADD COLUMN overhead_category text;
```

RLS: No new policies needed -- existing policies cover time_entries.

---

### 2. "Overhead" Option in Time Entry Forms

**Modify:** `src/components/time-tracking/EnhancedTimeEntryForm.tsx`

- Add an "Overhead / Non-Project" toggle or a special entry in the project dropdown
- When selected, set `is_overhead = true` and show a category dropdown (Admin, Travel, Training, Payroll, Other)
- Project dropdown becomes optional (or auto-selects a placeholder)

**Modify:** Clock-in flow (`src/components/portal/InlineClockControls.tsx`)
- Currently requires a project. Add an "Overhead" option alongside project selection.

---

### 3. Admin Manual Entry (Already Exists -- Enhance)

The `EnhancedTimeEntryForm` already allows Admin/Manager to select personnel and log time on their behalf (daily and weekly modes with multi-personnel support). This covers George's use case.

**Minor enhancements:**
- Add a prominent "Log Time for Field Personnel" quick action on the Manager dashboard
- Ensure the form's personnel selector is easy to find and use
- Add the overhead option to the admin manual entry form

---

### 4. Project Dashboard -- Labor Allocation Section

**New component:** `src/components/project-hub/ProjectLaborAllocation.tsx`

Displays on the Project Detail page (Financial tab area):
- Total hours logged to this project (excluding overhead)
- Breakdown by personnel: name, total hours, regular/OT split, estimated cost (hours x pay_rate)
- Subtotals for supervision vs. field labor (based on personnel role/title)
- Data sourced from existing `time_entries` query filtered by project_id

**Modify:** `src/pages/ProjectDetail.tsx`
- Add the Labor Allocation component below or alongside the Financial Summary

---

### 5. Supervision Cost Impact on Financial Summary

**Modify:** `src/components/project-hub/ProjectFinancialSummary.tsx`

Add a new section showing:
- "Supervision / Internal Labor" line item (hours from personnel flagged as supervisors, e.g., George)
- "Margin before supervision: X%" vs "Margin after supervision: Y%"
- This uses the existing `totalLaborCost` data but splits it by personnel type

**Modify:** `src/pages/ProjectDetail.tsx` (financialData calculation)
- Split labor cost into `fieldLaborCost` and `supervisionLaborCost`
- Pass both to `ProjectFinancialSummary`

To identify supervision personnel, use the `project_assignments.project_role` column (added in previous prompt) or personnel title/role.

---

### 6. Company-Wide Overhead and Utilization Report

**New page:** `src/pages/OverheadAnalysis.tsx` (route: `/overhead-analysis`)

Dashboard showing:
- **Hours by Project** bar chart (recharts) -- all projects ranked by total hours
- **Total Overhead Hours** -- sum of `is_overhead = true` entries
- **Personnel Utilization** -- project hours / (project hours + overhead hours) as percentage per person
- **Top Overhead Categories** -- breakdown of overhead_category values
- Date range filter (week, month, quarter, custom)

**Modify:** `src/App.tsx` -- add route
**Modify:** Dashboard navigation -- add link to Overhead Analysis

---

### 7. Daily Logging Enforcement -- Missing Time Entry Alerts

**New edge function:** `supabase/functions/check-missing-time-entries/index.ts`

- Designed to run on a schedule (or triggered manually)
- Queries all active field personnel
- For each, checks if they have a time entry for today
- If not, sends an in-app notification via `admin_notifications`
- Also sends an SMS reminder via existing `send-sms` edge function

**New component:** `src/components/dashboard/MissingTimeEntriesAlert.tsx`

- Shows on the Manager/Admin dashboard
- Lists personnel who have not logged time today
- Clickable to open their time entry form

---

### 8. Files to Create/Modify

**New files:**
- `src/components/project-hub/ProjectLaborAllocation.tsx` -- per-project labor breakdown
- `src/pages/OverheadAnalysis.tsx` -- company-wide overhead report
- `src/components/dashboard/MissingTimeEntriesAlert.tsx` -- missing entry widget
- `supabase/functions/check-missing-time-entries/index.ts` -- daily check function

**Modified files:**
- `src/components/time-tracking/EnhancedTimeEntryForm.tsx` -- add overhead toggle + category
- `src/components/portal/InlineClockControls.tsx` -- add overhead option
- `src/components/project-hub/ProjectFinancialSummary.tsx` -- supervision cost impact line
- `src/pages/ProjectDetail.tsx` -- add labor allocation component, split supervision costs
- `src/App.tsx` -- add overhead analysis route
- Database migration -- add `is_overhead` and `overhead_category` columns

**No existing data affected** -- new columns default to false/null. All existing time entries remain as project-allocated entries.

