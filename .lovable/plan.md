

# Critical Database Security Hardening Plan

## Executive Summary

**DO NOT SUBMIT TO THE APP STORE** until these security issues are fixed.

The security scan has confirmed **77 overly permissive RLS policies** with `USING (true)` across **77 tables** that expose sensitive data to any authenticated user.

---

## Current Security Status

### Already Secured (Good News)

| Table | Status | Notes |
|-------|--------|-------|
| `personnel` | SECURED | Uses role checks + self-access |
| `vendors` | SECURED | Uses role checks + self-access |
| `user_roles` | SECURED | Proper RLS in place |
| `user_permissions` | SECURED | Proper RLS in place |

### Critical Vulnerabilities (77 tables with `USING (true)`)

| Severity | Table | Sensitive Data | Risk |
|----------|-------|----------------|------|
| CRITICAL | `quickbooks_config` | OAuth tokens, refresh tokens | **Full QuickBooks access** - attacker can make transactions |
| CRITICAL | `messages` | Private SMS messages | Privacy breach, social engineering |
| CRITICAL | `emergency_contacts` | Family members' PII | Harassment, social engineering |
| HIGH | `personnel_invitations` | Security tokens | Unauthorized account creation |
| HIGH | `vendor_invitations` | Security tokens | Unauthorized vendor access |
| HIGH | `personnel_registration_invites` | Registration tokens | Account takeover |
| HIGH | `personnel_onboarding_tokens` | Onboarding tokens | Identity fraud |
| HIGH | `applicants` | Job applicant PII (public read!) | Privacy violation |
| HIGH | `applications` | Application data with IPs | Privacy violation |
| MEDIUM | `invoice_payments` | Payment details | Financial exposure |
| MEDIUM | `vendor_bill_payments` | Payment patterns | Business intelligence leak |
| MEDIUM | `personnel_payments` | Compensation data | Salary disclosure |
| MEDIUM | 65+ other tables | Business data | Competitive intelligence leak |

---

## Root Cause

Most tables have policies like:
```sql
CREATE POLICY "Authenticated users can view X"
ON public.X FOR SELECT USING (true);
```

This means **anyone with a Supabase auth account** (vendor, personnel, or even someone who just signed up) can query and read ALL data in these tables.

---

## Implementation Plan

### Phase 1: Fix Critical Tables (Immediate Priority)

#### 1. `quickbooks_config` - OAuth Tokens Exposed

**Current vulnerable policy:**
```sql
"Authenticated users can view quickbooks config" USING (true)
```

**Fix:** Drop the policy. The existing admin-only policy is sufficient.
```sql
DROP POLICY IF EXISTS "Authenticated users can view quickbooks config" ON quickbooks_config;
```

#### 2. `emergency_contacts` - Family Info Exposed

**Current vulnerable policy:**
```sql
"Authenticated users can view emergency contacts" USING (true)
```

**Fix:**
```sql
DROP POLICY IF EXISTS "Authenticated users can view emergency contacts" ON emergency_contacts;

CREATE POLICY "Admins managers view all emergency contacts"
ON emergency_contacts FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Personnel can view own emergency contacts"
ON emergency_contacts FOR SELECT
TO authenticated
USING (personnel_id = get_personnel_id_for_user(auth.uid()));
```

#### 3. `messages` - Private SMS Exposed

**Current vulnerable policy:**
```sql
"Authenticated users can view messages" USING (true)
```

**Fix:**
```sql
DROP POLICY IF EXISTS "Authenticated users can view messages" ON messages;

CREATE POLICY "Staff can view messages"
ON messages FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'user')
);
```

---

### Phase 2: Fix Token/Invitation Tables

#### 4-7. Invitation and Token Tables

Replace public SELECT policies with admin/manager access + self-access:

```sql
-- personnel_invitations
DROP POLICY IF EXISTS "Anyone can view invitations by token" ON personnel_invitations;
CREATE POLICY "Admins managers view personnel invitations"
ON personnel_invitations FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Personnel view own invitation"
ON personnel_invitations FOR SELECT TO authenticated
USING (personnel_id = get_personnel_id_for_user(auth.uid()));

-- vendor_invitations
DROP POLICY IF EXISTS "Anyone can view vendor invitations by token" ON vendor_invitations;
CREATE POLICY "Admins managers view vendor invitations"
ON vendor_invitations FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Vendors view own invitation"
ON vendor_invitations FOR SELECT TO authenticated
USING (vendor_id = get_vendor_id_for_user(auth.uid()));

-- personnel_registration_invites
DROP POLICY IF EXISTS "Anyone can view invites by token" ON personnel_registration_invites;
CREATE POLICY "Admins managers view registration invites"
ON personnel_registration_invites FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- personnel_onboarding_tokens
DROP POLICY IF EXISTS "Anyone can view onboarding tokens" ON personnel_onboarding_tokens;
CREATE POLICY "Admins managers view onboarding tokens"
ON personnel_onboarding_tokens FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Personnel view own onboarding token"
ON personnel_onboarding_tokens FOR SELECT TO authenticated
USING (personnel_id = get_personnel_id_for_user(auth.uid()));
```

---

### Phase 3: Fix Business Data Tables (65+ tables)

Replace all `USING (true)` SELECT policies with staff-only access:

```sql
-- Pattern for each table:
DROP POLICY IF EXISTS "Authenticated users can view [table_name]" ON [table_name];

CREATE POLICY "Staff can view [table_name]"
ON [table_name] FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'user')
);
```

**Tables to fix (65+ tables):**

| Category | Tables |
|----------|--------|
| Financial | `invoice_payments`, `vendor_bill_payments`, `personnel_payments`, `personnel_payment_allocations` |
| Estimates | `estimates`, `estimate_line_items`, `estimate_attachments`, `estimate_versions` |
| Invoices | `invoices`, `invoice_line_items`, `invoice_attachments`, `invoice_payment_attachments` |
| Purchase Orders | `purchase_orders`, `po_line_items`, `po_addendums`, `po_addendum_line_items`, `po_addendum_attachments` |
| Change Orders | `change_orders`, `change_order_line_items`, `change_order_vendor_bills` |
| Vendor Bills | `vendor_bills`, `vendor_bill_line_items`, `vendor_bill_attachments`, `vendor_bill_payment_attachments` |
| Projects | `projects`, `project_documents`, `project_labor_expenses`, `project_rate_brackets` |
| Job Orders | `job_orders`, `job_order_line_items` |
| Time/Tasks | `tasks`, `milestones`, `activities`, `appointments`, `time_week_closeouts` |
| Personnel | `personnel_capabilities`, `personnel_certifications`, `personnel_languages`, `personnel_project_assignments` |
| Vendors | `vendor_documents`, `vendor_onboarding_documents`, `vendor_onboarding_tokens` |
| QuickBooks | `quickbooks_*_mappings`, `quickbooks_sync_logs` |
| Other | `products`, `product_categories`, `product_units`, `expense_categories`, `badge_templates`, `badge_template_fields`, `asset_assignments`, `tm_tickets`, `tm_ticket_line_items`, `roof_*`, `weather_logs`, `weekly_labor_*`, `insurance_claims` |

---

### Phase 4: Special Cases

#### `applicants` and `applications`

These tables need public INSERT for job applications but restricted SELECT:

```sql
-- applicants: Remove public read, keep public insert
DROP POLICY IF EXISTS "Public can check applicant by email" ON applicants;

CREATE POLICY "Staff can view applicants"
ON applicants FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- applications: Same treatment
DROP POLICY IF EXISTS "Public can check own applications by applicant_id" ON applications;

CREATE POLICY "Staff can view applications"
ON applications FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));
```

**Note:** This will break the public application status check. If needed, create an edge function to handle status checking securely.

#### `company_settings`

The `USING (true)` policy may be intentional for displaying company logo/name publicly. We can leave this as-is or create a view that only exposes non-sensitive columns.

#### `contractor_form_configurations`

This is intentionally public for contractor form display. Can leave as-is.

---

## Summary of Changes

| Change Type | Count |
|-------------|-------|
| Policies to DROP | ~77 |
| New restrictive policies to CREATE | ~85 |
| Database views to CREATE | 0 (not needed since base tables are already secured) |
| Application code changes | Minimal (only if applicant status check is used) |

---

## Migration File Structure

The migration will be a single large SQL file (~500 lines) organized as:

1. **Phase 1:** Critical fixes (quickbooks_config, emergency_contacts, messages)
2. **Phase 2:** Token/invitation tables
3. **Phase 3:** Bulk business data table fixes
4. **Phase 4:** Special cases (applicants, applications)

---

## Testing Plan

After implementing:

1. **Test as Personnel (Portal User):**
   - Can view own personnel record
   - Can view own emergency contacts
   - CANNOT view other personnel's data
   - CANNOT view messages, invoices, or business data

2. **Test as Vendor (Portal User):**
   - Can view own vendor record
   - CANNOT view personnel table
   - CANNOT view QuickBooks tokens
   - CANNOT view any business data

3. **Test as Admin/Manager:**
   - Full access to all tables
   - All existing functionality works

4. **Test as Unauthenticated:**
   - Can submit job applications
   - CANNOT read any data

---

## Risk Assessment

| State | Risk Level | Description |
|-------|------------|-------------|
| **Current** | CRITICAL | Anyone who creates an account can read SSNs, bank accounts, QuickBooks OAuth tokens |
| **After Fix** | LOW | Only authorized users with proper roles can access data |

---

## Immediate Actions

1. Do NOT submit to App Store until these fixes are deployed
2. Approve this plan to generate the migration SQL
3. Run the migration
4. Test all user flows (admin, staff, personnel portal, vendor portal)
5. Verify no data leaks by attempting queries as different user types
6. Then proceed with App Store submission

This is critical for security and must be completed before any public release.

