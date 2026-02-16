

## Change Order Workflow with E-Signature Approval and Work Authorization Enforcement

This extends the existing Change Order system with an e-signature approval chain, strict no-work-before-approval enforcement, and full document storage/audit trail.

### Important Note on DocuSign

DocuSign requires a paid developer account and API credentials. There is no pre-built connector available. Instead, we will use the **existing email + e-signature infrastructure** already in place (Resend for email, `react-signature-canvas` for signing, token-based approval links) -- the same pattern used for PO addendum approvals (`send-change-order-approval` edge function and `/approve-change-order/:token` page). This approach:
- Requires no additional API keys or third-party accounts
- Uses the proven approval flow already in the codebase
- Delivers the same result: email sent, recipient clicks link, reviews document, signs electronically, countersigned copy stored

If you specifically want DocuSign integration in the future, it can be added as a separate enhancement once you have a DocuSign developer account.

---

### 1. Database Changes

**Add customer contact fields to `projects` table:**

| Column | Type |
|--------|------|
| customer_field_supervisor_name | text |
| customer_field_supervisor_email | text |
| customer_field_supervisor_phone | text |
| customer_pm_name | text |
| customer_pm_email | text |
| customer_pm_phone | text |
| our_field_superintendent_id | uuid FK -> personnel |

**Add workflow columns to `change_orders` table:**

| Column | Type | Notes |
|--------|------|-------|
| work_authorized | boolean, default false | Only true when approved AND customer WO received |
| customer_wo_number | text | Customer's formal Work Order / CO number |
| customer_wo_file_path | text | Uploaded WO document path |
| customer_wo_uploaded_at | timestamptz | |
| field_supervisor_approval_token | uuid | For email signing link |
| field_supervisor_signed_at | timestamptz | |
| field_supervisor_signature | text | Signature data |
| customer_pm_approval_token | uuid | |
| customer_pm_signed_at | timestamptz | |
| customer_pm_signature | text | |
| sent_for_approval_at | timestamptz | When emails started going out |
| photos | text[] | Array of storage paths for uploaded photos |

**Add new enum values to `change_order_status`:**

Add: `pending_field_supervisor`, `pending_customer_pm`, `approved_pending_wo`

Full flow: `draft` -> `pending_field_supervisor` -> `pending_customer_pm` -> `approved_pending_wo` -> `approved` -> `invoiced`

**New table: `change_order_approval_log`**

| Column | Type |
|--------|------|
| id | uuid PK |
| change_order_id | uuid FK |
| action | text (submitted, field_supervisor_signed, customer_pm_signed, wo_received, rejected) |
| actor_name | text |
| actor_email | text |
| notes | text |
| created_at | timestamptz |

RLS: Staff (admin/manager/user) can SELECT; system inserts via edge function (service role).

---

### 2. Project Contact Fields UI

**Modify:** `src/components/projects/ProjectForm.tsx` (or the project edit form)

Add a "Customer Contacts" section with fields for:
- Customer Field Supervisor (name, email, phone)
- Customer Project Manager (name, email, phone)
- Our Field Superintendent (dropdown from personnel table)

These fields are optional but required before a CO can be submitted for approval from that project.

---

### 3. Change Order Creation Updates

**Modify:** `src/components/change-orders/ChangeOrderForm.tsx`

- Add photo upload section (multiple photos using existing storage bucket)
- Photos stored in `form-uploads` bucket under `change-orders/{co_id}/`
- Photos array saved to `change_orders.photos`

No changes to line item structure -- existing quantity/pricing fields remain.

---

### 4. Approval Submission Flow

**New edge function:** `supabase/functions/send-co-approval/index.ts`

When a field rep clicks "Submit for Approval" on a draft CO:

1. Validates the project has customer_field_supervisor_email set
2. Generates approval tokens for both signers
3. Updates CO status to `pending_field_supervisor`
4. Sends email to Customer Field Supervisor via Resend with a link to review and sign
5. Sends notification emails to Customer PM and our Field Superintendent (FYI -- CO has been created)
6. Creates in-app notifications for internal team
7. Logs action in `change_order_approval_log`

**Approval chain email flow:**
- Step 1: Customer Field Supervisor receives email -> clicks link -> reviews CO -> signs -> status moves to `pending_customer_pm`
- Step 2: Customer PM auto-receives next email -> reviews -> signs -> status moves to `approved_pending_wo`
- Step 3: Internal team notified that both signatures received. CO stays `approved_pending_wo` until customer WO number is entered/uploaded.
- Step 4: When WO document uploaded and number entered -> `work_authorized = true`, status -> `approved`

---

### 5. E-Signature Approval Pages

**New page:** `src/pages/ApproveChangeOrder.tsx` (route: `/approve-co/:token`)

- Public page (no login required), same pattern as existing `/approve-change-order/:token`
- Displays: CO number, project name, description, scope of work, photos, line items with pricing, total
- Signature canvas at bottom
- "Approve & Sign" button
- On sign: edge function validates token, records signature and timestamp, advances status, sends next email in chain

---

### 6. Work Authorization Enforcement

**Modify:** `src/components/project-hub/ProjectChangeOrdersList.tsx`
- COs where `work_authorized = false` show a red "NOT AUTHORIZED" badge
- COs where status is `approved_pending_wo` show an amber "AWAITING WORK ORDER" badge

**Modify:** Change Order detail page
- Show upload section for Customer Work Order document
- Field for Customer WO/CO number
- "Authorize Work" button (only enabled when WO uploaded AND both signatures present)

**Modify:** Subcontractor Portal (`SubcontractorCompletions.tsx`)
- Scope items linked to an unauthorized CO are shown with "Pending Approval -- Do Not Begin" label
- These items cannot be checked/selected for completion submission
- Enforced at UI level and validated in the submission mutation

---

### 7. Document Storage and Audit Trail

- CO submission PDF, signed copies, and customer WO stored in `form-uploads` bucket under `change-orders/{co_id}/`
- File references stored on the `change_orders` record
- `change_order_approval_log` table provides full audit trail
- CO detail page shows approval timeline with who signed what and when

---

### 8. Notifications

Using existing `admin_notifications` table and Resend email:

| Event | In-App Notification | Email |
|-------|---------------------|-------|
| CO created/submitted | Our Field Superintendent | Customer Field Supervisor, Customer PM, Our Field Superintendent |
| Field Supervisor signs | Internal team | Customer PM (with sign link) |
| Customer PM signs | Project Manager, Field Superintendent | Internal team |
| CO fully approved | All assigned staff | - |
| CO rejected at any stage | Creator, PM | Creator |

---

### 9. Files to Create/Modify

**New files:**
- `supabase/functions/send-co-approval/index.ts` -- email + token generation
- `supabase/functions/process-co-signature/index.ts` -- validate token, record signature, advance chain
- `src/pages/ApproveChangeOrderPublic.tsx` -- public e-signature page
- `src/components/change-orders/ChangeOrderApprovalTimeline.tsx` -- approval status timeline
- `src/components/change-orders/ChangeOrderPhotoUpload.tsx` -- multi-photo upload
- `src/components/change-orders/CustomerWorkOrderUpload.tsx` -- WO upload + number entry

**Modified files:**
- `src/App.tsx` -- add routes
- `src/integrations/supabase/hooks/useChangeOrders.ts` -- add new status types, work_authorized field
- `src/components/change-orders/ChangeOrderForm.tsx` -- add photo upload
- `src/components/project-hub/ProjectChangeOrdersList.tsx` -- NOT AUTHORIZED badge
- `src/pages/ChangeOrderDetail.tsx` -- approval timeline, WO upload, submit for approval button
- Project form -- customer contact fields
- Subcontractor completions -- enforce work authorization check
- Database migration for all schema changes

**No existing data affected** -- all changes are additive. Existing COs keep their current status. The new workflow columns default to null/false.

