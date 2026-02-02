

# Google Play Security Compliance: Fix All 27 Security Errors

## Overview

The security scan reveals **27 critical security errors** across the database that must be fixed for Google Play Developer Content Policy compliance. The previous migration (February 2nd) secured only 5 tables. This plan addresses the remaining vulnerable tables.

---

## Current Security Status

| Category | Tables Secured | Tables Remaining |
|----------|----------------|------------------|
| QuickBooks OAuth Tokens | 1 (quickbooks_config) | 0 |
| Personnel PII (SSN, Bank) | 1 (personnel) | 0 |
| Emergency Contacts | 1 (emergency_contacts) | 0 |
| Private Messages | 2 (conversations, conversation_messages) | 1 (messages) |
| **Business Data (Still Exposed)** | 0 | **20+** |

---

## Tables Requiring RLS Hardening

### CRITICAL - Sensitive Data Exposure

| Table | Sensitive Data Exposed | Required Access |
|-------|------------------------|-----------------|
| `messages` | Phone numbers, SMS content | Admins/Managers only |
| `vendors` | Tax IDs, bank info, W-9 data | Admins/Managers + Vendor self-access |
| `applicants` | Personal info, addresses, GPS | Staff only |
| `applications` | Answers, phone, GPS, consent data | Staff only |
| `time_entries` | GPS locations, hourly rates | Admins/Managers + Personnel self-access |
| `personnel_payments` | Payroll amounts, rates, hours | Admins/Managers + Personnel self-access |
| `vendor_bills` | Cost structure, billing info | Admins/Managers + Vendor self-access |
| `reimbursements` | Expense data, receipts | Admins/Managers + Personnel self-access |

### HIGH - Business Data Exposure

| Table | Data Exposed | Required Access |
|-------|--------------|-----------------|
| `customers` | Contact info, addresses | Staff only |
| `invoices` | Pricing, customer PO numbers | Staff only |
| `estimates` | Pricing strategy, margins | Staff only |
| `projects` | Customer locations, GPS, contacts | Staff only |
| `job_orders` | Financial details, costs | Staff only |
| `purchase_orders` | Vendor costs, supply chain | Staff + Vendor self-access |
| `change_orders` | Scope changes, additional costs | Staff only |
| `invoice_payments` | Payment methods, references | Staff only |

### MEDIUM - Token/Invitation Exposure

| Table | Issue | Required Access |
|-------|-------|-----------------|
| `personnel_onboarding_tokens` | All tokens visible | Token-based lookup only |
| `vendor_onboarding_tokens` | All tokens visible | Token-based lookup only |
| `personnel_invitations` | All invites visible | Token-based lookup only |
| `vendor_invitations` | All invites visible | Token-based lookup only |
| `invitations` | All user invites visible | Token-based lookup only |

### LOW - QuickBooks Mapping Tables

| Table | Issue | Required Access |
|-------|-------|-----------------|
| `quickbooks_customer_mappings` | Exposes system structure | Admins only |
| `quickbooks_vendor_mappings` | Exposes system structure | Admins only |
| `quickbooks_invoice_mappings` | Exposes system structure | Admins only |
| `quickbooks_bill_mappings` | Exposes system structure | Admins only |
| `quickbooks_product_mappings` | Exposes system structure | Admins only |
| `quickbooks_account_mappings` | Exposes system structure | Admins only |

---

## Implementation Plan

### Phase 1: Database Migration

Create a comprehensive migration that:

1. **Drops all overly permissive `USING (true)` SELECT policies** for sensitive tables
2. **Creates role-based policies** using the existing `has_role()` function
3. **Adds self-access policies** for portal users (personnel and vendors)

### Phase 2: Policy Categories

#### A. Admin-Only Tables
```text
- messages (SMS logs with phone numbers)
- quickbooks_*_mappings (6 tables)
```

#### B. Admin/Manager + Self-Access Tables
```text
- personnel_payments (payroll data)
- vendor_bills (vendor costs)
- time_entries (GPS locations)
- reimbursements (expense data)
```

#### C. Staff-Only Tables (Admin/Manager/User roles)
```text
- customers, invoices, estimates, projects
- job_orders, purchase_orders, change_orders
- applicants, applications, invoice_payments
```

#### D. Token-Based Access Tables
```text
- personnel_onboarding_tokens
- vendor_onboarding_tokens  
- personnel_invitations
- vendor_invitations
- invitations
```

#### E. Vendor Portal Access
```text
- purchase_orders (vendor can view their own POs)
- vendor_bills (vendor can view their own bills)
- vendors (vendor can view own record)
```

---

## Technical Details

### Migration SQL Structure

```sql
-- Example: Secure the messages table (SMS logs)
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.messages;

CREATE POLICY "Only admins and managers can view messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- Example: Secure personnel_payments with self-access
DROP POLICY IF EXISTS "Authenticated users can view personnel payments" ON public.personnel_payments;

CREATE POLICY "Admins and managers can view all personnel payments"
  ON public.personnel_payments FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Personnel can view own payments"
  ON public.personnel_payments FOR SELECT
  TO authenticated
  USING (
    personnel_id = public.get_personnel_id_for_user(auth.uid())
  );

-- Example: Token-based access for invitations
DROP POLICY IF EXISTS "Anyone can view invitations by token" ON public.personnel_invitations;

CREATE POLICY "Token-based invitation lookup"
  ON public.personnel_invitations FOR SELECT
  TO public
  USING (
    -- Staff can view all
    (auth.role() = 'authenticated' AND (
      public.has_role(auth.uid(), 'admin') OR 
      public.has_role(auth.uid(), 'manager')
    )) OR
    -- Public can only see if they have the exact token (handled at app level)
    false
  );
```

### Helper Functions Needed

Check if these functions exist, create if missing:
- `get_vendor_id_for_user(user_id uuid)` - returns vendor_id for portal users

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/[timestamp]_comprehensive_rls_hardening.sql` | New migration with all RLS policy updates |

---

## Security Findings to Clear After Implementation

After applying this migration, we should mark these security findings as resolved:
- `quickbooks_tokens_public` (already fixed)
- `personnel_sensitive_data` (already fixed)
- `emergency_contacts_public_exposure` (already fixed)
- `messages_table_public_exposure`
- `time_entries_public_exposure`
- `personnel_onboarding_tokens_public_exposure`
- `estimates_table_public_exposure`
- `purchase_orders_public_exposure`
- `job_orders_public_exposure`
- `change_orders_public_exposure`
- `projects_public_exposure`
- `vendor_invitations_public_exposure`
- `personnel_invitations_public_exposure`
- `quickbooks_mappings_public_exposure`
- `personnel_table_public_exposure`
- `vendors_table_public_exposure`
- `vendor_bills_public_exposure`
- `applicants_table_public_exposure`
- `applications_table_public_exposure`
- `reimbursements_public_exposure`
- `invitations_public_exposure`
- `invoice_payments_public_exposure`
- `personnel_payments_public_exposure`
- `vendor_onboarding_tokens_public_exposure`
- `customers_table_public_exposure`
- `invoices_table_public_exposure`

---

## Expected Outcome

After implementation:
- **27 errors → 0 errors** for data exposure issues
- All sensitive data restricted to authorized roles only
- Portal users (personnel/vendors) can only access their own records
- Token-based tables only accessible via exact token match
- Full Google Play Developer Content Policy compliance for "secure handling" of user data

---

## Testing Recommendations

After applying the migration:
1. Test as admin - should see all data
2. Test as personnel portal user - should only see own records
3. Test as vendor portal user - should only see own POs and bills
4. Test as unauthenticated - should see nothing
5. Verify the app still functions correctly for all user types

