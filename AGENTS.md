# Architecture rules

- Staff applicant locations use the shared applicant location formatter and a view-level cached ZIP batch lookup; preserve applicant fields and resolve fallbacks only for display to avoid per-row requests and unnecessary writes.- Equipment per-diem billing is derived on read from `asset_assignments` (location_id, billable, day_rate ?? assets.default_day_rate) via `src/lib/assetBilling.ts`; never store accrued totals, so project, location and financial views stay consistent.
