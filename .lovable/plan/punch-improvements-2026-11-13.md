# Punch improvements

## Build
- Automatically close eligible open worker stays at their frozen scheduled end, using location time. Mark “forgot to clock out,” retain a blank actual checkout, and update attendance/payroll through existing guarded accrual.
- Respect approved extensions before closing; manual entries, closed sites, and locked evidence remain protected. No historical backfill.
- Use the existing active, authenticated roster-check callback as the equivalent scheduler; retain its timing and all paused jobs. Notify the worker once with an HHMM schedule time and the existing personal extension-request link. Capture their reported later checkout only through that request, with owner approval controlling counted time.
- On punch-page opening, request GPS immediately and record a token-scoped, server-timestamped “link opened” event, including unavailable GPS. Events exist without a punch and appear in manager attendance details.
- Preserve current punch clamping, checkout rounding, financial visibility, and desktop layout.

## Timing and privacy
- The existing roster check runs every ten minutes: counted checkout is the exact scheduled end, while closure/text may occur up to ten minutes later. No additional recurring jobs.
- Link-open GPS is evidence of opening the page, not proof of work or an actual punch. Never store bearer links in event or message logs.

## Technical details
- Add service-only transactional close and token-scoped event/request functions with explicit grants and manager-only event reads.
- Reuse existing shift-extension review/recount, SMS opt-out checks and reserve-before-send delivery tracking.
- Preserve the unmanaged stale-clock schedule rather than converting its authentication; prevent unauthorized access to its callback and use the secure existing equivalent for new closure work.

## Verify
- Run isolated rolled-back close/recount checks and live dry-run diagnostics without worker texts or owner punch changes.
- Verify GPS success/denial and no-punch event display using disposable records; remove all verification records in the same run.
- Check phone punch page, manager detail, permissions, focused tests, and current preview errors.