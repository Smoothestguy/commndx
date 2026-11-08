# Event Manager
- Keep camp operations independent of project/construction/payroll modules; same-camp foreign keys, manager RLS, server creator stamping and unique meal/open-bunk indexes protect concurrent writes.
- Dashboard and exports share paginated counts-only projections and camp-local calendar-day segmentation; preserve service timestamps and history on checkout.