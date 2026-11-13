# Mobile bulk actions and long-press

## What changes
- Selecting phone cards opens a compact bottom action bar above the floating navigation, with count, clear, export, status actions, applicable assignment actions and single-record Edit.
- A 500ms hold selects the card and opens its available actions, with brief highlight feedback. Moving the finger or scrolling cancels the hold.
- Desktop row right-click opens the same available actions as the row menu; links retain their native browser menu.
- Apply the shared behavior to Locations, Personnel, projects, assets and applicants wherever these lists use the shared table. Keep existing status workflows and manager/admin restrictions; deactivate never deletes records.

## Technical details
- Extend the shared table with explicit entity action callbacks, reusing existing mutations and row-menu actions rather than inferring permissions or writing generic database updates.
- Use existing status equivalents: Locations on hold, personnel inactive, projects on hold, and each asset/applicant's supported inactive status. Preserve lifecycle safeguards and dollar-free exports for field views.
- Bring the phone Personnel list onto the shared card mode so its selection and context actions use the same implementation.
- Add focused tests for the hold threshold, movement cancellation, role gating and single-selection editing.

## Verification
- Check Locations and Personnel at 390px, multi-select/clear/hold/scroll cancellation, and desktop right-click.
- Use disposable records for deactivate/activate, read the saved statuses back and remove all verification records in this run. Owner records remain read-only; no texts or punches.
- Run focused tests and check preview errors.