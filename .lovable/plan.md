# Projects as events

## Result
- Treat a project as an event folder containing multiple customer locations.
- Add manager-maintained project types, with EM — Emergency Management and legacy codes discovered in existing names.
- Derive customer chips and location counts from locations, falling back to the retained project customer only where needed.
- Open project pages on Event overview: editable parameters, a status-colored location map, customers, assigned vendors, location status totals, and people currently on site.
- Update the Projects grid and filters without removing the existing Locations command-center tab.

## Compatibility and verification
- Backfill location customers from the existing project default; retain all historical records and existing portal tokens, task orders, and financial exports.
- Prefer each location's customer in new sheet and task-order defaults; never rewrite historical PDFs or task orders.
- Verify Florida Floods with EM assigned, Patriot derived from its four existing locations, four clickable map pins, and type/customer filters.
- Add focused derivation/default tests and check desktop and phone layouts. No test punches, messages, or changes to closed locations.

## Technical details
- Add `project_types`, nullable `projects.type_id`, nullable `projects.region`, and `project_locations.customer_id` using additive migrations, explicit grants, and manager/admin write policies.
- Reuse the existing map implementation and shared grids, controls, auditing, and date formatting.
- Keep customer and location summaries in a shared batched projection; no anonymous data access expansion.
- Existing projects have no dedicated hardcoded type column; infer only recognizable legacy prefixes and leave other types unassigned until selected.