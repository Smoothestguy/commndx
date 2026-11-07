# Asset responsibility and ownership

- Add an optional searchable responsible-person picker to location asset assignment and moves, limited to that site's assigned personnel.
- Show responsibility and Owned / Rented ownership on staffing, location asset rows and personnel's current-care list.
- Add ownership (existing assets default to Owned), rental vendor, purchase cost, rental cost/period and notes. Quick-create asks ownership/vendor; full edit includes costs.
- Label customer assignment charges **Bill rate**, and purchase/rental expenses **Our cost**. Do not add expenses to billing totals or external exports.
- Protect financial asset fields server-side for admin/manager only, retaining dollar-free asset access for field personnel and existing public portals.
- Record responsibility changes separately from placement periods, so changing a driver does not double-charge a day. Clear responsibility on site/project unassignment or demobilization while retaining history.

## Verification
- On 5049-FCOCO, assign the Ram to an eligible responsible person and confirm staffing, Assets and personnel detail readback.
- Create and edit a temporary rented asset with vendor/cost/bill rate; check role-safe responses and field presentation, then remove test rows.
- Run focused rules tests and check preview errors. A separate field login may require account-session permission.

## Technical details
- Additive migration with safe defaults, validation, protected custody history, server-side role-aware asset projections and lifecycle triggers; existing placement/billing rows remain authoritative.
- Reuse existing asset hooks, dialogs and design controls; exports only gain ownership metadata where assets already appear.