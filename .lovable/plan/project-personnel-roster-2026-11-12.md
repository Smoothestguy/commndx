# Project personnel roster

## What changes
- Extend existing project personnel assignments with roster activity and added-by/time metadata; retain ended assignment rows rather than replace history.
- Show the roster count and searchable **Add to project** control in Crew & Logistics / Deployment. Directory choices are grouped FRG / Agency / Customer and show bench stars. Removal deactivates project membership without deleting work, signatures, location history or financial records.
- Scope project/location person choices to roster members: location assignment, attendance additions, crews, asset responsibility, signature/punch sends and demobe time. Each offers manager-only **Add to project**; an empty roster says **No personnel on this project yet**.
- Keep existing narrower location and worked-date eligibility checks. Historical attendance and requests for signatures remain available after removal; removal controls new choices, not old evidence.
- Leave the global Personnel directory unchanged. Adding a roster member does not send a text or relocate them.

## Existing people and access
- Backfill people with active location assignments or any project visit/time entry, preserving existing assignment periods and employer identity. Verify both Florida crews and approval-driven roster additions.
- Managers/admins manage membership; staff receive minimal non-financial roster reads. Preserve personnel self-access without exposing pay/rates to staff.
- Agency people must retain the existing project-vendor relationship; adding them offers the existing vendor-add path when needed, rather than silently widening agency choices.

## Technical approach
- Reuse `personnel_project_assignments`, its active-row unique index and ended-row history; synchronize roster activity with assignment status and server-stamp attribution.
- Use shared minimal roster reads and shared add controls, plus existing dated location projections, instead of global-directory fallbacks.
- Harden the existing manager policy with explicit `WITH CHECK`; avoid granting staff access to financial assignment columns.

## Verification
- Signed-in Florida Floods: confirm 5049/5048 backfill, location Assign excludes an outsider, and **Add to project** makes that person selectable immediately.
- Create a temporary fresh project, verify the empty roster, then remove all verification-created project/membership rows in the same run.
- Run focused membership/history/eligibility tests and check preview errors; do not send messages or alter owner work records.