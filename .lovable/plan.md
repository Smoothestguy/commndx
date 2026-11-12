# Task-order creation and demobe time

## Requested result
- Group creation into Order info, Lines and Options, with sticky Save/Cancel.
- Decrease/Demobilization shows each authorized label as of the chosen date, current count and a zero-default deduction capped at that count. Skip zero deductions; increases retain free add-line entry with current context.
- After demobilization, or a decrease that zeroes a label, offer skippable demobe time creation. Also expose Demobe time from the saved order menu.
- Select assigned people, defaulting to deducted roles; choose demobe date and hours or military in/out times. Retain TO travel choice, person billing flags, audit and existing locks.
- Mirror current-level deductions and grouped form in Event Manager. Its independent people are not payroll personnel, so do not create project payroll entries there.

## Technical details
- Reuse accepted authorization RPC and existing Event scope calculations without changing historical math or compact history.
- Extend the existing ledger source constraint to accept `demobe`; use the guarded manual-stay path and its canonical ledger, with explicit order attribution and audit.
- Preserve partial-save reporting and avoid automatic retries of already committed person entries.

## Verification
- Check real 5049-FCOCO levels; do not invent 7/3/3 if current production authorization differs.
- Create two temporary assigned people and a test order, create/read back demobe time in the real timesheet, then remove test records only.
- Run focused rule tests and check preview errors; leave schedules and public-link work untouched.
