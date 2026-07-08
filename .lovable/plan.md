# Recruiter UX Audit — Command X

Read-only audit of the recruiter surface. No code changes proposed here; this is the diagnosis the owner asked for. All evidence cites file/line or DB.

---

## 1. Navigation structure (as a recruiter sees it)

Top nav is a 5-item mega menu (`src/components/layout/netsuite/MegaMenu.tsx`, lines 54–133). There is **no sidebar** for recruiter surface — everything is in the top mega menu.

```text
Home                → /                        [Index.tsx = generic RowBasedDashboard, zero recruiting widgets]
Transactions ▾
  Sales:      Estimates, Invoices
  Purchasing: Purchase Orders, Vendor Bills
Lists ▾
  Relationships: Customers, Vendors, Personnel        ← Personnel lives here
  Items:         Products, Projects
Reports ▾                                             ← recruiter's core job is buried under "Reports"
  Operations: Time Tracking, Project Assignments,
              Applications (/staffing/applications),   ← Staffing Applications
              Master Applicants (/staffing/applicants) ← Master Applicants
  Documents:  Vendor Documents, Document Center,
              Messages (/messages)                     ← Messages
Setup ▾
  Administration: User Management, Permissions, Audit Logs
  Settings:       Badge Templates, QuickBooks, Settings
  Previews:       Vendor Portal Preview, Personnel Portal Preview
```

Recruiter-relevant items and where they hide:
| Item | Location | Discoverable? |
|---|---|---|
| Staffing Applications | Reports → Operations | Poor (labeled "Reports") |
| Master Applicants | Reports → Operations | Poor |
| Job Posting Entries | **Not in nav at all** — only reachable by drilling into a posting from Staffing Applications (`/staffing/applications/posting/:postingId`, App.tsx L576) | None |
| Form Templates (staffing) | **Not in nav** — route exists (`/staffing/form-templates`, App.tsx L580) but no menu link. Only reachable via a button inside StaffingApplications. | None |
| Staffing Map | **Not in nav** — route `/staffing/map` (App.tsx L592) is orphaned | None |
| Personnel | Lists → Relationships | OK |
| Messages | Reports → Documents (odd grouping) | Poor |
| Notifications | Bell icon in `TopNavBar.tsx` L126 (AdminNotificationBell) | OK |
| Document Center | Reports → Documents | OK |
| User Management | Setup → Administration (admin only) | OK |

**Top-level items a recruiter must scan:** 5 menus, ~19 leaf items, and the recruiter's daily-use surface is scattered across 3 of the 5 menus (Lists, Reports/Operations, Reports/Documents). **Clicks from login to "today's new applications"**: Home → Reports (open) → Operations → Applications = 3 clicks, then filter by date manually (no "today" filter exists — see §5).

**There is no recruiting home/dashboard.** `src/pages/Index.tsx` renders `RowBasedDashboard`; the row set (`src/components/dashboard/rows/`) is invoice/revenue/activity — no application, applicant, message, or onboarding row.

---

## 2. Recruiter pages inventory

| Page | Shows | Primary actions | Filters | Notes |
|---|---|---|---|---|
| **StaffingApplications.tsx** (1035 lines) | Grouped list of Task Orders → Job Postings with counts + a global applications table | Create Task Order, Create/Edit Posting, copy public URL, invite nearby applicants, approve/reject application, open detail dialog | Search, project, status, posting | The hub page. Big but does 5 jobs at once (posting management + application review + invite nearby + QuickApply stats). |
| **JobPostingEntries.tsx** (280 lines) | Spreadsheet of one posting's applications with dynamic form-field columns | View detail, Approve, Reject, Export CSV/Excel/PDF/JSON | Status filter only (Active/All/Submitted/Reviewing/Approved/Rejected) | **Duplicates** the approve/reject already on StaffingApplications. Back button hard-navigates to `/staffing/applications` (L138) losing any filters. |
| **MasterApplicants.tsx** (274 lines) | Every applicant with app count, last posting, contact info | Bulk select → Invite to Job (via `InviteToJobDialog`); row click **does nothing useful** — no drilldown to applicant detail | Search, status | Third place applications appear — applicant-centric slice. No link to conversations, no link to the underlying application. |
| **Messages.tsx** (33 lines) | Renders `MessagesInbox` | Send SMS, reply | Handled inside inbox component | Zero recruiter context — no way to tell if a conversation is with an applicant, personnel, or customer without opening it. |
| **Personnel.tsx** (303 lines) | Personnel list | Standard CRUD + hire flow | Standard | Approved applicants land here after conversion, but there is no "recently converted" view. |

**Duplicated capabilities:**
- Approve/reject an application: available on StaffingApplications (via ApplicationDetailDialog), JobPostingEntries (row actions), and inside ApplicationDetailDialog. Three surfaces, one action.
- Application lists: StaffingApplications (all + per-posting count), JobPostingEntries (single posting), MasterApplicants (applicant-centric). Three overlapping views, no single "pipeline" view.

---

## 3. Cross-linking (LINKED vs DEAD-END)

Grep results in `src/components/messaging/`, `src/pages/StaffingApplications.tsx`, `src/pages/MasterApplicants.tsx`, `src/components/staffing/ApplicationDetailDialog.tsx`:

| From → To | Result | Evidence |
|---|---|---|
| Conversation (Messages) → applicant's application | **DEAD-END** | No `navigate(` or `<Link to=` to `/staffing/...` anywhere in `src/components/messaging/`. |
| Application detail → conversation / SMS history | **DEAD-END** | `ApplicationDetailDialog.tsx` has no reference to `/messages`, `conversations`, or MessageComposer. |
| MasterApplicants row → applicant detail page | **DEAD-END** | `MasterApplicants.tsx` has no `navigate(`; only action is `InviteToJobDialog`. There is no `/staffing/applicants/:id` route at all (grep of `App.tsx`). |
| Applicant → Personnel record after conversion | **DEAD-END** | `applicants` table has no `personnel_id` column exposed in UI; approval flow creates personnel but the applicant row is not linked back in either direction from the UI. |
| Application → onboarding status | **PARTIAL** | Approval triggers onboarding token creation server-side, but neither StaffingApplications nor MasterApplicants shows `personnel_onboarding_tokens.status` inline. Recruiter has to switch to Personnel and hunt. |
| StaffingApplications posting card → JobPostingEntries | **LINKED** (only working cross-link in the flow) | `/staffing/applications/posting/:postingId` deep link exists. |

Net: the four surfaces the same person appears on (application row, applicants table, conversations, personnel record) are **not stitched together in either direction** except application → posting drill-in.

---

## 4. Status model (from DB)

Enums queried live:

- `application_status` (enum on `applications.status`): `submitted`, `reviewing`, `approved`, `rejected`, `needs_info`, `updated` — 6 values.
- `applicants.status` (text, observed distinct): `new`, `approved`, `rejected` — 3 values.
- `personnel.onboarding_status`: `pending`, `completed`, `revoked` — 3 values.
- `personnel.status`: `active`, `inactive`, `do_not_hire` — 3 values.

A single person's real lifecycle spans **4 status columns across 3 tables**:

```text
applicants.status = new
   └─ applications.status: submitted → reviewing → (needs_info|updated)* → approved|rejected
        └─ on approve: applicants.status → approved  +  personnel row created
              └─ personnel.onboarding_status: pending → completed (or revoked)
                    └─ personnel.status: active | inactive | do_not_hire
```

Where each status is visible today:
| Status | Visible on |
|---|---|
| `applications.status` | StaffingApplications, JobPostingEntries, ApplicationDetailDialog |
| `applicants.status` | MasterApplicants only |
| `onboarding_status` | Personnel page only (buried) |
| `personnel.status` | Personnel page |

**There is no unified pipeline/kanban view anywhere.** A recruiter cannot see "5 submitted, 3 reviewing, 2 approved-pending-onboarding, 4 onboarding-stalled" in one place.

---

## 5. Signals a recruiter looks for in the morning

- Dashboard (`src/pages/Index.tsx` + `src/components/dashboard/rows/*`): rows are `WelcomeStrip`, `KPIBar`, `RevenueChartRow`, `RecentInvoicesTable`, `InvoiceAgingSummary`, `RecentActivityTable`, `QuickActionsRow`. **No application/applicant/message/onboarding row exists.**
- Unread message count: `TopNavBar.tsx` L36/L84 (`useTotalUnreadCount`) shows a badge on the Messages icon. ✓
- Admin notifications: `AdminNotificationBell` shows unread count with priority-based pulse coloring. ✓ but is generic (all admin notifications, not scoped to "new applications").
- **"N new applications today"**: not shown anywhere.
- **Stalled onboardings**: not surfaced anywhere; recruiter must open Personnel and eyeball `onboarding_status = pending` rows.
- **Applications needing recruiter response** (`needs_info`, `updated`): no dedicated counter or filter card.

The morning answer is currently: log in → Home shows AR/revenue → click Reports → Operations → Applications → sort by created_at → mentally diff yesterday.

---

## 6. Top 10 recruiter UX problems (with one-line fixes)

1. **Recruiting is filed under "Reports"** — semantically wrong; recruiters read "Reports" as read-only analytics. → Promote a top-level **Recruiting** menu (Applications, Master Applicants, Postings, Form Templates, Map, Messages).
2. **No recruiter dashboard** — Home shows AR/invoices, useless to a recruiter. → Add a "Recruiting" dashboard variant (or new-application/needs-info/stalled-onboarding rows) selected by role.
3. **Form Templates and Staffing Map are orphaned routes** — reachable only via deep-linking or a button inside StaffingApplications. → Surface them in the Recruiting menu.
4. **Conversations ↔ applications are unlinked** — from a message you can't jump to the applicant's application, and vice versa. → Add a "View application" button in ConversationView and a "Message" button in ApplicationDetailDialog that opens/creates the conversation.
5. **MasterApplicants rows dead-end** — clicking an applicant does nothing; no `/staffing/applicants/:id` detail exists. → Add applicant detail drawer showing all their applications, SMS history, and personnel link.
6. **Four fragmented status fields, no pipeline view** — recruiter has to hold the model in their head. → Add a single kanban/funnel: Submitted → Reviewing → Needs Info → Approved → Onboarding → Active, spanning applications + onboarding + personnel.
7. **No "new today / needs response" counter** — no morning glance metric. → Add badge counts to the Recruiting menu items (new applications today, `needs_info`, stalled onboarding >72h).
8. **Approve/reject exists in 3 places with 3 slightly different modals** (StaffingApplications, JobPostingEntries, ApplicationDetailDialog). → Consolidate to one action surface (the detail dialog) and have the row buttons open it.
9. **JobPostingEntries back button destroys filters** — hard `navigate("/staffing/applications")` on L138 loses status/search state. → Use browser back or persisted filters in URL params.
10. **Applicant ↔ Personnel handoff is invisible** — once approved, applicant row and personnel row have no mutual link in the UI; recruiter loses continuity. → After approval, show a "Now in Personnel → [name]" link on both applicant/application, and a "Came from application [posting]" link on Personnel.

---

Ready to move any of these into a build plan on your say-so. If you want, the highest-leverage single change is **#1 + #2 together**: promote Recruiting to top-level and give it a purpose-built home screen — that alone would collapse the "all over the place" feel without touching data models.
