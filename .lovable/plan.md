

## Step 2: RBAC & RLS Hardening

### What Already Exists (No Changes Needed)

Your platform already has a comprehensive RBAC foundation:

- **`user_roles`** table with `app_role` enum: `admin`, `manager`, `user`, `personnel`, `vendor`, `accounting`
- **`user_permissions`** table with granular module-level permissions (`can_view`, `can_add`, `can_edit`, `can_delete` per module)
- **`project_assignments`** table with `project_role`, `status`, `assigned_by` columns
- **`has_role()`** and **`has_permission()`** security definer functions
- **RLS enabled** on all critical tables (`projects`, `invoices`, `estimates`, `purchase_orders`, `change_orders`, `vendor_bills`, `job_orders`, `po_addendums`, `project_assignments`)
- **Client-side** `usePermissionCheck`, `useUserRole`, `useMyPermissions` hooks

Creating new `departments`, `roles`, `permissions`, `role_permissions` tables would duplicate and conflict with this existing system. Instead, this plan focuses on **hardening the gaps** in the current setup.

---

### Gap 1: Missing `WITH CHECK` on `ALL` Policies

Several `ALL`-type RLS policies are missing explicit `WITH CHECK` clauses. Without `WITH CHECK`, PostgreSQL falls back to the `USING` clause for inserts/updates, but best practice (and your project memory notes) requires explicit `WITH CHECK`.

**Tables affected:**
- `change_orders` - "Admins and managers can manage change orders"
- `estimates` - "Admins and managers can manage estimates"
- `invoices` - "Admins and managers can manage invoices"
- `purchase_orders` - "Admins and managers can manage purchase orders"
- `vendor_bills` - "Admins and managers can manage vendor bills"
- `po_addendums` - "Admins and managers can manage po_addendums"
- `project_assignments` - "Admins and managers can manage assignments"
- `projects` - "Admins and managers can manage projects"

**Fix:** Drop and recreate each policy with matching `WITH CHECK` clause.

---

### Gap 2: Project-Scoped Access for Regular Users on Financial Tables

Currently, regular `user` role can `SELECT` all records on financial tables (invoices, estimates, purchase_orders, change_orders, job_orders). There is no project-scoping -- a user with `can_view` permission sees ALL projects' financial data regardless of assignment.

**Fix:** Add project-scoped SELECT policies for `user` role on financial tables, restricting visibility to projects the user is assigned to via `project_assignments`.

New helper function:

```sql
CREATE OR REPLACE FUNCTION public.is_assigned_to_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_assignments
    WHERE user_id = _user_id
      AND project_id = _project_id
      AND status = 'active'
  )
$$;
```

Then update SELECT policies on financial tables to scope `user` role:

```text
-- Example for invoices:
-- Admins/Managers: see all (unchanged)
-- Users: see only invoices linked to their assigned projects
```

**Tables to update:** `invoices`, `estimates`, `purchase_orders`, `change_orders`, `job_orders`, `vendor_bills`

---

### Gap 3: `user_permissions` Not Enforced at Database Level

The `has_permission()` function exists but RLS policies don't use it -- they only check `has_role()`. This means the granular permission toggles (e.g., "user X cannot view invoices") are only enforced client-side, which can be bypassed via direct API calls.

**Fix:** Update SELECT policies for `user` role to additionally check `has_permission()`:

```text
-- Before (current):
has_role(auth.uid(), 'user')

-- After (hardened):
has_role(auth.uid(), 'user') AND has_permission(auth.uid(), 'invoices', 'view')
```

This ensures the database itself enforces module-level permissions.

---

### Gap 4: Accounting Role Not in Financial RLS Policies

The `accounting` role has full access to financial modules in client-side code (`usePermissionCheck`) but is NOT included in any database RLS policies. This means accounting users are blocked at the database level.

**Fix:** Add accounting role to SELECT and ALL policies on financial tables:

```text
-- Add to financial table policies:
OR has_role(auth.uid(), 'accounting')
```

**Tables:** `invoices`, `estimates`, `purchase_orders`, `change_orders`, `vendor_bills`, `po_addendums`

---

### Implementation: Single Migration

All changes will be in one migration with the following structure:

1. Create `is_assigned_to_project()` helper function
2. Drop and recreate policies on each table with:
   - Admin/Manager: full ALL with explicit WITH CHECK
   - Accounting: full access on financial tables only
   - User: project-scoped + permission-checked SELECT
   - Personnel/Vendor: existing self-access policies (unchanged)

### Technical Details

**Migration SQL structure (per table pattern):**

```sql
-- 1. Helper function
CREATE OR REPLACE FUNCTION public.is_assigned_to_project(...)

-- 2. For each financial table (invoices, estimates, etc.):
DROP POLICY IF EXISTS "old_policy_name" ON public.table_name;

-- Admin/Manager full access with WITH CHECK
CREATE POLICY "Admins and managers full access" ON public.table_name
  FOR ALL TO public
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Accounting access (financial tables only)
CREATE POLICY "Accounting full access" ON public.table_name
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'accounting'))
  WITH CHECK (has_role(auth.uid(), 'accounting'));

-- User scoped access
CREATE POLICY "Users view assigned projects" ON public.table_name
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'user')
    AND has_permission(auth.uid(), 'module_name', 'view')
    AND is_assigned_to_project(auth.uid(), project_id)
  );
```

**No client-side code changes needed** -- the existing hooks and permission checks remain valid. The database now enforces what was previously client-side only.

### Risk Assessment

- **Non-destructive**: Only policy changes, no table modifications
- **Backward compatible**: Admin/Manager access unchanged
- **Production safe**: All changes are additive security restrictions on `user` role
- **Rollback**: Each dropped policy's original definition will be included as comments

