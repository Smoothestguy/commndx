# Move onboarding — SQL approval required

## Review the exact SQL

[Download the proposed SQL](sandbox:/mnt/documents/move-onboarding.sql)

The SQL is also committed as `docs/proposals/move-onboarding.sql`. It has **not been applied**. Approving this plan authorizes applying that exact SQL as one migration and implementing the dialog below.

## Scope

- Add exactly two admin-only functions: `preview_move_onboarding` and `move_onboarding_to_personnel`.
- No tables, columns, existing functions, triggers, policies, schedules or storage files change.
- General personnel Merge remains forbidden. Only the approved onboarding evidence tables and allow-listed profile fields can move.
- Keep the source record, inactive and linked to the target; leave all target work, attendance, assignments, check-in links and payments unchanged.

## Safety and choices

- Enforce every source-empty check and onboarding/login eligibility rule again during execution.
- Preserve target names/contact unless explicitly choosing source; fill empty profile values, require a choice for conflicts, preserve employment values and target P-number.
- Mask SSN/ITIN/account numbers to last four; hide routing numbers, signature contents and private image paths. Audit field names/counts, never sensitive values.
- Unique collisions retain target rows and leave skipped source evidence in place, reporting each skip.
- Contact-verification evidence follows the matching selected email/phone; never attach a source verification stamp to a different retained target contact.

## Live-schema adaptations for approval

1. The existing status-log constraint does **not** accept `inactive`. Set the source personnel status to inactive, but write the requested note using the existing log status **unavailable**; no constraint change.
2. Require the target to have at least one time-entry, attendance or stay row, consistent with “target has the work history.” Deleted records are ineligible.
3. Bank account/routing choices copy their paired existing encrypted representation too, keeping masked account details consistent. Existing bank-read authorization remains unchanged.
4. All listed personnel children have foreign keys except `punch_link_events`. Lock both personnel rows in UUID order; briefly lock only that link-open log to close its concurrent-write gap. Contention fails safely after three seconds. No punch logic or punch record changes.
5. Existing triggers remain enabled and fire normally. Their ordinary updated timestamps may change on moved profile/evidence rows; operational rows are never updated.

## Possible duplicates dialog after approval

- Admin-only actions for eligible pairs in either direction, labeled “Move onboarding to {P#}.”
- Show both identities, phones, last-four checks, moving/skipped counts and fill/keep fields.
- Radio choices for conflicts default to target; warn “Only use if both records are the same person.”
- Show untouched target hours/projects/check-in-link presence without exposing the bearer link; execute once, toast and refresh groups.

## Verification

**PASS now, isolated only:** PostgreSQL compilation; eligible move; all 16 source-history blockers; missing-choice rollback; masking; both-completed and both-login preview rejection; internal non-admin denial; unchanged target time-entry/assignment/token rows; evidence/portal move; five unique collision rules.

**Pending approval:** live disposable fixtures and server-role tests, current-schema encrypted banking checks, concurrent-write checks, desktop/390px dialog, punch/kiosk loads and legacy onboarding submission. Mock all sends and remove verification fixtures in the same run. No production rows or app screens have changed during this review.