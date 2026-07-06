## Problem
On the Staffing Applications page, the search box only matches applicant name and email. Typing a phone number returns nothing, even though phone is stored on the applicant record. (The Master Applicants page already supports phone search — this brings parity.)

## Change
Presentation-only tweak to `src/pages/StaffingApplications.tsx`:

- Extend the search filter (around line 287-290) to also match `applicant.phone`.
- Normalize both sides by stripping non-digits so users can type `5551234567`, `555-123-4567`, or `(555) 123-4567` and still match stored values regardless of format.
- Keep existing name/email substring matching unchanged (case-insensitive).
- Update the search input placeholder to hint that phone is now searchable (e.g. "Search name, email, or phone…").

No changes to data model, queries, or other pages.

## Out of scope
- The Master Applicants page (already searches phone).
- Backend/RPC changes.
