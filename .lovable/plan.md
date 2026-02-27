

## Plan: Onboarding Badge + Active Assignment Indicator on Approved Applicants

### Overview
1. Add "Onboarded" badge to Assigned Personnel rows
2. For approved applicants, show which project they're currently assigned to (instead of hiding them)
3. On unassignment, invalidate applications query so the applicant's active project indicator updates automatically

### Changes

**File 1: `src/integrations/supabase/hooks/usePersonnelWithAssets.ts`**
- Add `onboarding_status` to the personnel select query (line 73-82)
- Add `onboardingStatus` to the returned data shape and interface

**File 2: `src/components/project-hub/ProjectPersonnelSection.tsx`**
- Show a green "Onboarded" badge next to personnel name when `onboardingStatus === "completed"` in both desktop table rows (around line 764-772) and mobile cards (around line 620-628)

**File 3: `src/components/project-hub/ProjectApplicantsSection.tsx`**
- In the approved tab, for each approved applicant, cross-reference against `personnel_project_assignments` to check if their linked personnel record has an active assignment on any project
- If actively assigned, show an info badge/indicator like: "Assigned to [Project Name]" — the applicant stays visible (sliding puzzle concept), not hidden
- Fetch active assignments by querying `personnel` table via `applicant_id` to get `personnel_id`, then check `personnel_project_assignments` for active status, joining with `projects` to get the project name
- Add a new query hook inline or a small helper that fetches active project assignments for approved applicants' personnel records

**File 4: `src/components/project-hub/UnassignPersonnelDialog.tsx`**
- After successful unassignment (line 280-283), also invalidate `["applications"]` and `["staffing-applications"]` query keys so the applicant pool refreshes and the "Assigned to X" indicator disappears

### Technical approach for the assignment indicator
- After fetching approved applications, collect all `applicant_id`s
- Query `personnel` where `applicant_id` is in that list → get `personnel_id`s  
- Query `personnel_project_assignments` where `personnel_id` in that list and `status = 'active'`, joining `projects(name)`
- Build a map: `applicant_id → { projectName, projectId }`
- In the approved applicant row/card, if the applicant has an active assignment, show a badge like `"Currently on: [Project Name]"`

