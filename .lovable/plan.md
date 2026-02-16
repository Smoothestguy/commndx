

## Room-Level Completion and Auto-Billing Workflow

This is a major feature extending the Subcontractor Portal with structured room completion, auto-generated bills, duplicate prevention, and a multi-step approval pipeline.

### Overview

Contractors will see their assigned rooms grouped by project, select completed scope items per room, and submit completions. The system auto-calculates the bill from pre-set rates -- contractors never enter amounts. Each bill routes through Field Superintendent verification, PM approval, and Accounting processing before payment. Items already billed cannot be re-billed, solving the historical duplicate billing problem.

### 1. Database Changes

**New table: `contractor_completion_bills`**

Tracks room-level completion submissions with approval workflow status.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| room_id | uuid FK -> project_rooms | The room being billed |
| contractor_id | uuid FK -> vendors | The subcontractor (vendor) |
| project_id | uuid FK -> projects | |
| total_amount | numeric | Auto-calculated sum |
| status | enum | submitted, field_verified, pm_approved, accounting_approved, paid, rejected |
| rejection_notes | text | Reason if rejected |
| submitted_at | timestamptz | When contractor submitted |
| verified_at | timestamptz | When field superintendent verified |
| verified_by | uuid FK -> profiles | |
| approved_at | timestamptz | When PM approved |
| approved_by | uuid FK -> profiles | |
| accounting_approved_at | timestamptz | |
| accounting_approved_by | uuid FK -> profiles | |
| paid_at | timestamptz | |
| created_at / updated_at | timestamptz | |

**New table: `contractor_completion_bill_items`**

Individual scope items on each completion bill.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| bill_id | uuid FK -> contractor_completion_bills | |
| room_scope_item_id | uuid FK -> room_scope_items | Links to exact scope item |
| job_order_line_item_id | uuid FK -> job_order_line_items | For rate lookup |
| description | text | Scope description |
| quantity | numeric | Completed quantity |
| unit_cost | numeric | From PO line item unit_price |
| total | numeric | quantity x unit_cost |

**New enum: `contractor_bill_status`**
Values: submitted, field_verified, pm_approved, accounting_approved, paid, rejected

**Add column to `room_scope_items`:**
- `billed_quantity` (numeric, default 0) -- tracks how much of allocated_quantity has been billed to prevent duplicates

**RLS Policies:**
- Contractors (vendors) can SELECT their own bills and INSERT completions for rooms assigned to them
- Staff (admin/manager) can SELECT/UPDATE all bills
- Accounting role users can SELECT/UPDATE bills in `pm_approved` status
- All policies use existing `has_role()` and `get_vendor_id_for_user()` helper functions

### 2. Contractor Portal UI Changes

**New page: `/subcontractor/completions`** -- "My Rooms" view

- Queries `project_rooms` where `assigned_vendor_id` matches the current subcontractor's vendor ID
- Groups rooms by project (project name as section headers)
- Each room card shows:
  - Unit number, floor, status
  - List of scope items with: description, allocated qty, already-billed qty, remaining qty
  - Items fully billed show a green checkmark and "Paid on [date]" label (non-selectable)
  - Items with remaining quantity show checkboxes
- Contractor checks items they completed (partial completion supported)
- For each checked item, optionally enter completed quantity (defaults to remaining)
- "Submit Completion" button generates the bill

**New page: `/subcontractor/completions/:id`** -- Bill detail view

- Shows the auto-generated bill with line items and amounts
- Displays current approval status with timeline (submitted -> verified -> approved -> paid)
- Read-only for the contractor

**Dashboard update:**
- Add a "My Rooms" stat card and quick-access link on `SubcontractorDashboard.tsx`
- Add navigation link in `SubcontractorPortalLayout`

### 3. Auto-Bill Generation Logic

When contractor clicks "Submit Completion":

1. For each selected scope item, look up the `unit_price` from the linked `po_line_items` (via `job_order_line_items` -> `po_line_items` where the PO belongs to this vendor)
2. Calculate: `completed_quantity x unit_price = line total`
3. Sum all line totals = bill `total_amount`
4. Insert into `contractor_completion_bills` with status = `submitted`
5. Insert line items into `contractor_completion_bill_items`
6. Update `room_scope_items.billed_quantity += completed_quantity`
7. Send notification to Field Superintendent

### 4. Duplicate Prevention

- Before submission, query `room_scope_items.billed_quantity` for each selected item
- If `billed_quantity >= allocated_quantity`, the item is fully billed -- show "Already billed on [date], paid on [date]" and disable the checkbox
- If `completed_quantity > (allocated_quantity - billed_quantity)`, block submission with error: "Quantity exceeds remaining balance"
- A database trigger validates on INSERT to `contractor_completion_bill_items` that the cumulative `billed_quantity` does not exceed `allocated_quantity`

### 5. Approval Routing (Admin Side)

**New page: `/completion-reviews`** -- Completion Review Queue

Three tab views filtered by role:

- **Field Superintendent tab**: Shows bills with status = `submitted` for projects where the user is assigned as field superintendent (via `project_assignments` with a role field or a new `project_role` column)
  - Actions: "Verify" (moves to `field_verified`) or "Reject" (with notes, moves to `rejected`)

- **Project Manager tab**: Shows bills with status = `field_verified` for their assigned projects
  - Actions: "Approve" (moves to `pm_approved`) or "Reject"

- **Accounting tab**: Shows bills with status = `pm_approved` (visible to all users with `accounting` role)
  - Actions: "Process Payment" (moves to `accounting_approved`, then `paid`) or "Reject"

Each action updates the corresponding timestamp and `*_by` fields.

**Rule enforcement**: Bills only appear in a queue when they have reached that status. "It hasn't hit my portal" is valid at any stage.

### 6. Notifications

At each status transition, insert into `admin_notifications`:

| Transition | Recipient | Title |
|------------|-----------|-------|
| Submitted | Field Superintendent(s) on project | "Completion submitted for Unit [X] - [Project]" |
| Field Verified | Project Manager(s) on project | "Completion verified for Unit [X] - [Project]" |
| PM Approved | All Accounting role users | "Completion approved - ready for payment" |
| Rejected (any stage) | Contractor (if has user account) | "Completion rejected for Unit [X]" |

Each notification includes `link_url` pointing to the review page and `metadata` with project name, unit number, contractor name, and bill amount.

### 7. Files to Create/Modify

**New files:**
- `src/pages/subcontractor-portal/SubcontractorCompletions.tsx` -- room listing with completion form
- `src/pages/subcontractor-portal/SubcontractorCompletionDetail.tsx` -- bill detail view
- `src/integrations/supabase/hooks/useContractorCompletions.ts` -- queries and mutations
- `src/pages/CompletionReviews.tsx` -- admin review queue
- `src/components/completion-reviews/CompletionReviewCard.tsx` -- review card component

**Modified files:**
- `src/App.tsx` -- add new routes
- `src/pages/subcontractor-portal/SubcontractorDashboard.tsx` -- add rooms stat + link
- `src/components/subcontractor-portal/SubcontractorPortalLayout.tsx` -- add nav link

**Database migration:**
- Create enum, tables, RLS policies, validation trigger, and `billed_quantity` column

### 8. Key Design Decisions

- **Pricing source**: Uses `po_line_items.unit_price` from the vendor's Purchase Order (not job order markup price), ensuring the contractor is paid at their contracted rate
- **No modification of existing bills**: This system is separate from the existing `vendor_bills` table. The `contractor_completion_bills` table is purpose-built for room-level completion workflow
- **Backward compatible**: No changes to existing subcontractor portal pages or data. Everything is additive
- **Project role assignment**: Will use `project_assignments` table with a new `role` text column (e.g., 'field_superintendent', 'project_manager') to determine who reviews at each stage

