

## Fix: User Deletion Failing Due to Foreign Key References

### Problem
When trying to delete user "Christina Flores", the edge function fails because the `profiles` table has foreign key references from multiple other tables that aren't being cleaned up before the profile deletion. Specifically, the `estimate_versions.created_by` column still points to her profile, blocking the delete.

### Root Cause
The `delete-user` edge function only cleans up `personnel`, `vendors`, `user_permissions`, `user_roles`, and `notification_preferences` before deleting the profile. But there are 8 additional tables with foreign keys referencing `profiles` that are not handled:

- `estimate_versions.created_by`
- `purchase_orders.approved_by`
- `purchase_orders.submitted_by`
- `project_assignments.user_id`
- `time_entries.user_id`
- `personnel_project_assignments.assigned_by`
- `activities.created_by`
- `appointments.assigned_to`
- `tasks.assigned_to`
- `tasks.created_by`
- `audit_logs.user_id`

### Solution
Update the `delete-user` edge function to nullify all foreign key references to the user's profile before deleting it. This preserves historical data (estimates, POs, audit logs) while allowing the user record to be removed.

### Technical Details

**File: `supabase/functions/delete-user/index.ts`**

Add nullification steps for all referencing tables before the profile delete, setting the referencing columns to `null`:

```
estimate_versions.created_by -> null
purchase_orders.approved_by -> null
purchase_orders.submitted_by -> null
activities.created_by -> null
appointments.assigned_to -> null
tasks.assigned_to -> null
tasks.created_by -> null
audit_logs.user_id -> null
time_entries.user_id -> null
project_assignments -> delete rows
personnel_project_assignments.assigned_by -> null
```

Each update will use the admin client and log any errors without stopping the deletion flow, consistent with the existing pattern in the function.

### Files to Modify

| File | Purpose |
|------|---------|
| `supabase/functions/delete-user/index.ts` | Add cleanup for all 11 additional foreign key references before profile deletion |

