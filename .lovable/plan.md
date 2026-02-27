

## Plan: SMS Notification Toggle + Onboarding Duplicate Check

### 1. Add SMS Notification Toggle to Personnel Assignment Dialog

**File: `src/components/time-tracking/PersonnelAssignmentDialog.tsx`**
- Add `sendNotification` state, defaulting to `false`
- Add a Switch toggle in the schedule section with label "Send SMS Notification" (default OFF)
- Pass `sendNotification` to the `handleAssign` call

**File: `src/integrations/supabase/hooks/usePersonnelProjectAssignments.ts`**
- Add `sendNotification?: boolean` to the mutation input type (lines 242-248)
- Wrap the SMS sending loop (lines 343-361) in `if (sendNotification) { ... }`

### 2. Add Onboarding Duplicate Check to Applicant Approval Flow

When approving an applicant, before creating a personnel/vendor record, check if a profile already exists with completed onboarding and show a warning dialog.

**File: `src/integrations/supabase/hooks/useStaffingApplications.ts`**
- Expand the existing personnel duplicate check (line 634-638) to also select `first_name, last_name, onboarding_status, status`
- If an existing personnel record is found with `onboarding_status === "completed"`, throw a descriptive error like `"A personnel profile for [Name] ([email]) already exists and has completed onboarding. The existing profile will be linked instead of creating a duplicate."`
- Same pattern for vendor duplicate check (line 683-687) — select `name, onboarding_status, status` and warn if already onboarded

Actually, we should NOT throw an error (that would block the approval). Instead, the existing behavior of linking is correct. The user wants a **visible notification** rather than silent linking.

**Revised approach:** 
- In `useApproveApplicationWithType`, return metadata about whether an existing profile was found: `{ linkedExisting: true, existingPersonnelName: "..." }`
- In the three approval handlers (`StaffingApplications.tsx`, `ProjectApplicantsSection.tsx`, `ApplicationDetailDialog.tsx`), check the result and show an info toast like: "Profile already exists for [Name] — linked to existing record instead of creating a duplicate."

### Files to Change

| File | Change |
|------|--------|
| `src/components/time-tracking/PersonnelAssignmentDialog.tsx` | Add Switch toggle for SMS notifications (default OFF) |
| `src/integrations/supabase/hooks/usePersonnelProjectAssignments.ts` | Add `sendNotification` param, conditionally send SMS |
| `src/integrations/supabase/hooks/useStaffingApplications.ts` | Return `linkedExisting` flag when existing profile found |
| `src/pages/StaffingApplications.tsx` | Show info toast when linked to existing profile |
| `src/components/project-hub/ProjectApplicantsSection.tsx` | Show info toast when linked to existing profile |
| `src/components/staffing/ApplicationDetailDialog.tsx` | Show info toast when linked to existing profile |

