# Project vendor roster

## What changes
- Add a project Vendors section under Crew & Logistics, showing assigned vendors and a count. Managers/admins can search the full directory to add vendors or deactivate assignments without deleting history.
- Project/location agency and rental-vendor pickers use only active project assignments. Each includes an Add vendor to project action; empty projects never default to the global directory.
- Preserve existing personnel, assignments and join links. Backfill vendors found in location/project personnel assignments, existing join tokens and project asset placements so established choices remain available.
- Global vendor pages and public registration behavior remain unchanged. Deactivation prevents new selections, not existing link use or historical labels.

## Technical details
- Create `project_vendors` with a unique project/vendor pair, actor/time stamps and active state. Manager/admin write policies and staff-only read policy; no anonymous access or financial columns in the vendor-name projection.
- Shared scoped vendor hook/picker and management dialog serve all project-context choices. Server validation rejects newly selected join-link agencies outside the project roster without invalidating existing links.
- Keep project vendor membership separate from a person's global employer; assigning existing personnel must not silently change their employer.

## Verification
- Check Florida Floods backfilled vendor names, add an existing vendor through Join links, and confirm it appears immediately.
- Verify an empty project picker, inactive membership, staff read/manager write boundaries and focused tests.
- Restore temporary vendor memberships and remove verification-only records in the same run; preserve backfill and owner history.