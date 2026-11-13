# Location task-order engine

## What changes
Extend the existing location task orders—not Event Manager orders—while retaining internal numbering, customer references, military effective times, deduction preload, edit history and the demobe prompt.

### 1. Structured initial order and changes
- Labor: selectable role, headcount and hourly billing rate.
- Assets: selectable type, quantity and daily billing rate.
- Housing: Yes/No and allowance per person per day worked.
- Per diem: Yes/No and rate per person per day worked.
- Mobilization: approved Yes/No, terms and optional mobilization dollar cap per TO.
- Show the worked-day allowance defaults and cap meaning next to their fields.
- After the first accepted initial order, new orders default to changes. Show current authorization, signed increase/decrease and resulting totals for each line; carry terms forward unless explicitly changed. Permit terms-only changes without invented quantity adjustments.
- Drafts do not change authorization, generate billing or send messages. Acceptance commits authorization and related automation together; preserve customer submission review and legacy ADJ adjustments.

### 2. MOBE / DEMOBE and authorization control
- An accepted labor increase with mobilization approved creates a TO-owned MOBE sheet for the added count; the initial order is also an increase from zero.
- Every accepted labor reduction creates a DEMOBE sheet for the removed count. Approved mobilization terms determine whether its demobe hours are billable.
- Sheets start with required counts and blank signature/time evidence. PMs select actual eligible people; no invented attendance, signatures or hours.
- Reuse private signature capture, immutable sheet versions, local-time controls and guarded manual entries. Keep normal daily sheets separate and preserve their locked PDFs.
- Once a reduction takes effect, flag the location with role/type-specific over-count and a required demobilization action until actual matches. Prevent new assignments, moves-in and join approvals that worsen the excess; allow removals, corrections and safe checkout. Existing punches, rounding and counted-time rules are not changed, and no worker is silently unassigned.

### 3. Billing by authorizing TO
- Add a manager/admin-only location billing summary and export with internal TO number and customer TO/sidemark reference.
- Separate signed counted labor hours, housing person-days, per-diem person-days, asset days, MOBE hours and DEMOBE hours; show source evidence, rates, cap adjustments and unresolved attribution.
- Apply housing/per diem once per person per location-local worked day, not once per punch; non-billable people remain on sheets but contribute no monetary charges.
- Apply the mobilization cap to MOBE billing for that TO; DEMOBE billing uses its approved carried terms but does not consume the mobilization-only cap.
- Missing legacy rates or attribution remain “Unconfigured” / “Unallocated”—never infer dollars or charge historic orders. No invoices, payments, QuickBooks sync or real billing rows are created during verification.
- Staff/public operational histories retain counts and statuses only. Financial summaries and financial exports are separate from existing dollar-free exports.

### 4. Location texts and agency links
- Enforce exact active location roster membership both before displaying recipients and immediately before token creation/send. Reject unassigned, ended, future-assigned and wrong-location recipients; preserve opt-outs and existing delivery reservations.
- Existing agency links already store project, optional location and agency; retain their bilingual branding and lead saved-link labels with the agency name and scope.
- Capture immutable agency signup provenance through token validation and carry it into personnel grouping and billing attribution.
- Existing-person employer conflicts require manager resolution; never silently relabel a matched FRG/customer/other-agency person or rewrite their history. New signups retain agency ownership on approval and later conversion.

## Billing assumptions
- Labor rates are per hour; asset rates are per location-local asset day.
- Allocate fulfilled authorization to specific people/assets and TO lines. Preserve that allocation through later changes; reductions retire selected allocations instead of reassigning past charges.
- Rate/allowance changes apply prospectively from the TO's effective location-local timestamp. A worked day uses the terms at its first signed worked segment; labor splits at effective-time boundaries without changing payroll hours.
- Duplicate sheet/time evidence cannot create duplicate charges. Reopened evidence produces an audited revision; locked/invoiced history is not silently recalculated.

## Technical design
- Keep public `location_task_orders` / quantity lines free of financial fields because current staff and token consumers read them. Add separate protected terms/rate/allocation/billing-evidence structures with explicit grants and manager/admin RLS.
- Extend the manager-authorized expected-version TO save/accept functions to validate structured terms, serialize location authorization, create sheet requirements and audit changes transactionally. Preserve auto-numbering and sync-only retries for legacy paths.
- Add stable source references and versioned allocations for signed counted time and asset assignments. Use one shared TO billing calculation for summary and export; distinguish billing-only allocation from canonical payroll `time_entries`.
- Token signature endpoints return minimal scope-validated responses, no rates. Public joins retain pending-request confirmation and private punch-link handling. Every privileged function revokes default execution before explicit grants.
- Enforce excess-prevention where assignments/approvals commit, without modifying `_punch_core` or denying checkout. Audit the sibling text paths: explicit site texts, join approval texts and scheduled reminders.
- Store permanent agency provenance separately from mutable employer display fields; resolve conflicts explicitly before approving a join.
- Additive schema changes only; no historical backfill of financial allocations, new sending jobs, cron changes or blanket permission expansion.

## Verification and safety
- Inspect existing 5049 TO-1 through TO-4, active roster, authorization, agency labels and source evidence read-only. Its existing rates and billing remain unchanged.
- Use a disposable project/location and draft TO for create/edit/accept, carry-forward, reduction, MOBE/DEMOBE signature and billing checks. Delete all verification-created records and private test objects in the same run; never delete owner financial history.
- Run focused rules and isolated rollback tests: current/delta/result math, worked-day dedupe, signed-hours-only billing, missing-rate fail-closed, cap, non-billable exclusion, allocation stability, recipient scope, agency conflicts and financial access.
- Verify real manager desktop/mobile save → readback → sheet evidence → summary/export. Verify field/token responses contain no money; intercept deliveries and send zero real worker texts.
- Check preview errors and report any unavailable physical-device verification separately.

## Existing gaps this addresses
The current TO lines hold quantities but no rates/allowance terms. The demobe dialog creates time entries rather than TO-owned sign-in sheets. Site-text sending currently accepts selected personnel without a server-side location roster check. Agency defaults apply to newly created people, while matched people retain their old employer without a conflict decision. These paths will be corrected together rather than adding disconnected screens.