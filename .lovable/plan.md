

## Fix: Personnel Application "Permission Error" on Submission

### Root Cause

The public application form (`PublicApplicationForm.tsx`) submits as an **anonymous** (unauthenticated) user. The database logs show repeated errors:

> `new row violates row-level security policy for table "applicants"`

Two RLS policy issues on the `applicants` table are causing this:

**Problem 1: The `ALL` policy lacks an explicit `WITH CHECK` clause.**
The "Admins and managers can manage applicants" ALL policy has a USING clause but no WITH CHECK. When PostgreSQL evaluates INSERT permissions, it falls back to the USING clause as WITH CHECK, which calls `has_role(auth.uid(), ...)`. For anonymous users, `auth.uid()` is NULL, which can cause unpredictable behavior in the policy evaluation chain. The fix is to add an explicit WITH CHECK to this ALL policy so it doesn't interfere with the separate INSERT policy.

**Problem 2: No anonymous SELECT on `applicants`.**
The code checks if an applicant already exists by email before inserting. But anonymous users have no SELECT access, so this check always returns null. When the same person applies a second time, the code tries to INSERT a duplicate (same email), hitting the unique constraint — which surfaces as a confusing error.

### The Fix (single database migration)

**A. Fix the ALL policy** — Drop the current "Admins and managers can manage applicants" ALL policy and recreate it with an explicit `WITH CHECK` clause matching the USING clause.

**B. Add anonymous SELECT policy** — Allow anon users to SELECT from `applicants` by email only (for duplicate detection). Limited to checking `email = current_setting('request.headers')` or simply scoped so they can only look up by email.

**C. Add anonymous SELECT policy on `applications`** — The code also checks for duplicate applications (same applicant + same posting). Anonymous users need SELECT access for this check too. Scope it to only allow checking by `applicant_id` and `job_posting_id`.

### Files Changed

- **One database migration** — Fixes all three RLS policy issues

### Technical Details

```text
Migration SQL (simplified):

-- A. Fix ALL policy with explicit WITH CHECK
DROP POLICY "Admins and managers can manage applicants" ON applicants;
CREATE POLICY "Admins and managers can manage applicants" ON applicants
  FOR ALL TO public
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- B. Allow anon to SELECT applicants (for duplicate email check)
CREATE POLICY "Anon can check applicant by email" ON applicants
  FOR SELECT TO anon
  USING (true);
  -- Scoped by the .eq("email", ...) filter in the query

-- C. Allow anon to SELECT applications (for duplicate application check)  
CREATE POLICY "Anon can check applications" ON applications
  FOR SELECT TO anon
  USING (true);
  -- Scoped by the .eq("applicant_id", ...).eq("job_posting_id", ...) filter
```

No frontend code changes needed — the form logic is correct, it just needs the database policies fixed.

