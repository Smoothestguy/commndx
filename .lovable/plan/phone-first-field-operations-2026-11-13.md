# Phone-first field operations

## What changes
- Manager/admin phone navigation becomes Home, Locations, Approvals (live count), Time, and More. Desktop navigation and screens remain unchanged.
- Phone Home keeps operational needs, attention locations, today's totals, and three primary actions: send punch links, log time, and field requests. Sales stays accessible through More, never on phone Home.
- Phone location pages lead with day attendance and existing audited time/signature actions, followed by grouped staffing, authorization and demobilization. Assets, sheets, documents and other detail are collapsed and loaded when opened.
- Add a manager-only Approvals inbox combining pending joins, shift reviews, field requests, submitted customer task orders and missing-signature actions. Reuse existing decision handlers, notification safeguards and lock rules; signature nudges are actions, not approvals.
- Personnel, time and Event Manager tables use phone cards rather than horizontally scrolling spreadsheets. Preserve desktop tables.
- Field users retain self-only My Day with punch/site/hours/signatures; no manager inbox or financial widgets.

## Technical approach
- Keep lazy routes and existing authorization; no schema changes, cron changes or financial recalculation.
- Share the pending projection between inbox and navigation badge. Clearly surface loading/errors rather than misleading zero counts.
- Existing joins/customer orders/signatures retain their required detail review; expose their established controls directly in the inbox where practical.
- Use existing location-local military time controls and audited attendance editing.

## Verification
- Test role navigation/count rules and run affected existing tests.
- Verify 390px Home, inbox, location, attendance edit and public punch; also inspect desktop preservation.
- Use real manager and field sessions. If no identified field account can be signed in safely, report that blocker rather than spoofing a role.
- Do not approve owner requests, send texts or alter owner punches for verification; clean any disposable fixtures in the same run.