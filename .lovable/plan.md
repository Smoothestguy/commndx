# Customer Ops account for Taylor Olvey (Patriot Response Group)

## Finding
There is no customer account type today. The `manager` role is used by about 250 database access rules that apply to everything: all customers, all locations, pay and bill rates, invoices, payroll. Giving Taylor `manager` would break the zero-dollar rule, so I have **not** created the account yet. Sending the invite first would give her a working login with nothing safe to show.

## Proposed approach (needs your OK because it changes live access rules)
1. **New role `customer_ops`** added to the existing role list. It is never inferred from profile data.
2. **New link table `customer_user_links`** (user, customer). Only admins can write to it. Taylor is linked to Patriot (da445690-...).
3. **Scoped read functions** (security-definer, admin-checked or link-checked, no anonymous access) return only fields with no dollars:
   - Patriot locations across projects (5049-FCOCO, 5052-FL-WPB-Garner, ...)
   - Roster for those locations: name, position, phone, status. No rates, no bench notes, no employer pay data.
   - Attendance and stays, local day lists, missing-signature list (includes demobilized people)
   - Sign-in sheet and timesheet download through the existing private signed-PDF path, limited to her locations
4. **Scoped write functions**:
   - Assign or unassign a person on a Patriot location, chosen only from that project's roster. Uses the existing dated-assignment rules and is audited.
   - Signature request: calls the existing request flow with `requested_by = Taylor`, limited to her locations' worked stays. Supports dry-run.
5. **No table access granted.** She gets no direct read access to personnel, time_entries, projects, invoices or similar tables. Everything goes through the functions above, so a dollar column cannot leak.
6. **Separate customer workspace** (`/customer-ops`): Locations, Roster, Attendance, Missing signatures, Sheets. Desktop plus phone layout. Staff navigation, Sales and Financials are hidden, and staff pages redirect.
7. **Invite**: after the above is live, send the existing `send-invitation` email from admin@fairfieldrg.com to tolvey@patriotrg.com. She sets her own password; no password appears anywhere.

## Verification
- Mint her session; check at 390px and 1280px: only Patriot locations, attendance opens, missing-signature list loads, signature request runs as dry-run (no text sent).
- Grep every rendered page and API response in her session for rate, bill, pay, amount, total_cost, invoice and per_diem: expect zero hits.
- Negative checks: direct table reads and another customer's location IDs are refused.
- No data changes other than the account, the role and the link row.

## Questions
- Should "assign" also allow adding someone who is not yet on the project roster? (The proposal says no: project roster only.)
- Should she see worker phone numbers?

## Technical
One additive migration: role enum value, link table with RLS (admin ALL with WITH CHECK, self select), and about 8 SECURITY DEFINER functions with REVOKE ALL from PUBLIC/anon and GRANT to authenticated only. I will show you the SQL before applying it.
