# Separate events from location operations

## Navigation
- Add a shared-grid Locations page directly below Projects, defaulting to active locations across events. Include project, type, status, staffed/authorized, on-site now, customer, and project/status/customer filters.
- Move Staffing Map below Personnel/Bench in Workforce; desktop and mobile share the same navigation.
- Keep Field Mode available from the app header and Home.

## Event pages
- Keep exactly Event overview, Locations, Recruiting, Financials, and Docs & Activity tabs.
- Move deployment totals into a compact Event overview strip; dollar figures remain manager/admin-only. Keep separate Customers and Vendors & Agencies panels and the locations map.
- Move location authorization and accepted-demobilization summaries above the Locations list; move missing-rate warnings into Financials.
- Keep Project settings in the project menu. Redirect old deployment/crew/time tab URLs to their new destinations, preserving location-specific detail on location pages rather than recreating merged people/status views.

## Naming and preservation
- Use Customers for billed organizations and Vendors & Agencies for suppliers. Preserve explicit FRG/agency/customer employer labels.
- No database changes, deleted records, new access grants, or changes to billing calculations.

## Technical approach
- Reuse shared navigation, EnhancedDataTable, existing paginated operational reads, location authorization, deployment totals, and location-scoped views.
- Verify Florida's tabs, rollups, map, distinct panels, global location filters, old links, and desktop/mobile navigation; run focused logic tests.