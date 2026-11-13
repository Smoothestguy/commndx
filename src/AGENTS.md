# Architecture rules
- Phone Home uses scoped light tokens and shared self-only My Day/guarded manager actions; explicit linked field users may access only mobile Home while other portal restrictions and desktop rendering remain unchanged.
- Phone profile defaults come from self-only active sites or the user's last selected eligible site in session storage, never a named event or an arbitrary manager directory row.
- Event tabs reuse aggregate deployment totals; location detail owns operational views, and legacy tab redirects preserve bookmarked destinations without widening permissions.
- Lazy routes retain the eager shell so sidebar and workspace tabs persist during loading.
- Archived applicant purging requires an exported snapshot and explicit manager confirmation to protect history.
- Punch-time frozen schedules drive counted stay timestamps; actual taps remain immutable, and approved exceptions recount through guarded triggers while audited manual overrides bypass clamping.
- Signature saves and kiosk freshness validate original actual tap identity, not a future clamped shift start.
- Scheduled auto-close uses frozen shift boundaries and guarded accrual, never actual-out evidence; token-scoped open events and worker-reported corrections remain separate from device punches and manager-only GPS reads.
