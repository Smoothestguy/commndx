
# Plan: Fix Personnel Portal Project History Visibility After Unassignment

## Problem Summary

When personnel are unassigned from a project, they lose access to view that project's history in the portal. This happens because:

1. **Portal queries filter by `status = 'active'`** - The `usePersonnelAssignments` hook only returns assignments where `status = 'active'`, hiding all ended assignments
2. **Unique constraint blocks history preservation** - There's a `UNIQUE (personnel_id, project_id)` constraint preventing multiple assignment records per personnel-project pair
3. **Reassignment overwrites history** - The bulk assign uses `upsert` which updates the existing row instead of creating new assignment periods

## Current Table Schema

The `personnel_project_assignments` table has:
- `assigned_at` - when assignment started
- `unassigned_at` - when assignment ended (nullable)
- `status` - 'active', 'unassigned', or 'removed'

There's no explicit `starts_at`/`ends_at` pattern, but the existing fields can serve the same purpose.

---

## Solution Overview

### Phase 1: Database Changes

**1.1 Drop the unique constraint and add period-based unique constraint**

```sql
-- Drop old constraint
ALTER TABLE personnel_project_assignments 
DROP CONSTRAINT personnel_project_assignments_personnel_id_project_id_key;

-- Add new constraint that allows multiple assignments if they don't overlap
-- (only one active assignment per personnel-project at a time)
CREATE UNIQUE INDEX personnel_project_assignments_active_unique 
ON personnel_project_assignments (personnel_id, project_id) 
WHERE status = 'active';
```

This allows multiple assignment records for the same personnel-project pair (for history), while ensuring only ONE can be active at a time.

### Phase 2: Hook Updates

**2.1 Update `usePersonnelAssignments` in `src/integrations/supabase/hooks/usePortal.ts`**

Create two separate hooks:
- `usePersonnelActiveAssignments` - for current/active projects (can clock in, submit)
- `usePersonnelAllAssignments` - for all assignments (history visibility)

```typescript
// Active assignments only (for actions like clocking in)
export function usePersonnelActiveAssignments(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["personnel-active-assignments", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];
      const { data, error } = await supabase
        .from("personnel_project_assignments")
        .select(`*, project:projects(...)`)
        .eq("personnel_id", personnelId)
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
    enabled: !!personnelId,
  });
}

// All assignments (for viewing history)
export function usePersonnelAllAssignments(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["personnel-all-assignments", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];
      const { data, error } = await supabase
        .from("personnel_project_assignments")
        .select(`*, project:projects(...)`)
        .eq("personnel_id", personnelId)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!personnelId,
  });
}
```

**2.2 Update reassignment logic in `usePersonnelProjectAssignments.ts`**

Change `useBulkAssignPersonnelToProject` to create NEW assignment rows instead of upserting:

```typescript
// Check if already has an active assignment
const { data: existing } = await supabase
  .from("personnel_project_assignments")
  .select("id")
  .eq("personnel_id", personnelId)
  .eq("project_id", projectId)
  .eq("status", "active")
  .maybeSingle();

if (existing) {
  // Already active - skip or update
  return existing;
} else {
  // Insert new assignment (leaves old ended assignments intact)
  const { data, error } = await supabase
    .from("personnel_project_assignments")
    .insert({ personnel_id, project_id, status: 'active', ... })
    .select()
    .single();
}
```

### Phase 3: Portal UI Updates

**3.1 Update `PortalProjects.tsx`**

Show two sections:
- **Current Projects** - Active assignments (can clock in, take actions)
- **Past Projects** - Ended assignments (view history only)

```typescript
const { data: allAssignments } = usePersonnelAllAssignments(personnel?.id);

const currentProjects = allAssignments?.filter(a => a.status === 'active') || [];
const pastProjects = allAssignments?.filter(a => a.status !== 'active') || [];

// Deduplicate past projects (show latest assignment per project not in current)
const pastProjectIds = new Set(pastProjects.map(a => a.project?.id));
const uniquePastProjects = pastProjects.filter((a, i, arr) => 
  arr.findIndex(x => x.project?.id === a.project?.id) === i
);
```

**3.2 Update `PortalProjectDetail.tsx`**

Allow viewing ANY project the personnel has ever been assigned to:

```typescript
// Find ANY assignment for this project (not just active)
const assignment = allAssignments?.find(a => a.project?.id === id);
const isActiveAssignment = assignment?.status === 'active';

// Show history regardless of active status
// Only restrict ACTIONS (clock in, submit) to active assignments
```

**3.3 Update `useClockEnabledProjects` in `useTimeClock.ts`**

Keep filtering by `status = 'active'` - only active assignments can clock in.

---

## Files to Modify

| File | Change |
|------|--------|
| **Database Migration** | Drop unique constraint, add partial unique index for active only |
| `src/integrations/supabase/hooks/usePortal.ts` | Add `usePersonnelAllAssignments` hook, keep `usePersonnelAssignments` for active only |
| `src/integrations/supabase/hooks/usePersonnelProjectAssignments.ts` | Update `useBulkAssignPersonnelToProject` to INSERT new rows instead of upsert |
| `src/pages/portal/PortalProjects.tsx` | Show "Current" and "Past Projects" sections |
| `src/pages/portal/PortalProjectDetail.tsx` | Allow viewing projects from any assignment (past or current) |

---

## Technical Details

### Database Migration SQL

```sql
-- 1. Drop the existing unique constraint
ALTER TABLE public.personnel_project_assignments 
DROP CONSTRAINT IF EXISTS personnel_project_assignments_personnel_id_project_id_key;

-- 2. Add partial unique index (only one ACTIVE assignment per personnel-project)
CREATE UNIQUE INDEX personnel_project_assignments_active_unique 
ON public.personnel_project_assignments (personnel_id, project_id) 
WHERE status = 'active';

-- 3. Add index for efficient history queries
CREATE INDEX idx_personnel_assignments_history 
ON public.personnel_project_assignments (personnel_id, assigned_at DESC);
```

### Assignment Flow After Fix

```text
Assign Ricardo to Project X
+-----------------------------------------+
| id: abc123                              |
| personnel_id: ricardo                   |
| project_id: X                           |
| status: active                          |
| assigned_at: 2025-01-01                 |
| unassigned_at: null                     |
+-----------------------------------------+

Unassign Ricardo from Project X
+-----------------------------------------+
| id: abc123                              |
| personnel_id: ricardo                   |
| project_id: X                           |
| status: unassigned                      |
| assigned_at: 2025-01-01                 |
| unassigned_at: 2025-01-15               |
+-----------------------------------------+
Ricardo can STILL VIEW Project X history!

Reassign Ricardo to Project X
+-----------------------------------------+       +-----------------------------------------+
| id: abc123 (OLD)                        |       | id: xyz789 (NEW)                        |
| personnel_id: ricardo                   |       | personnel_id: ricardo                   |
| project_id: X                           |       | project_id: X                           |
| status: unassigned                      |       | status: active                          |
| assigned_at: 2025-01-01                 |       | assigned_at: 2025-01-20                 |
| unassigned_at: 2025-01-15               |       | unassigned_at: null                     |
+-----------------------------------------+       +-----------------------------------------+
Both assignment periods preserved! Full history intact.
```

---

## Acceptance Criteria Verification

| Criteria | How It's Met |
|----------|--------------|
| Unassigned Ricardo still sees Project X history | `usePersonnelAllAssignments` returns all assignments regardless of status |
| Ricardo reassigned = moves back to Current | New active assignment created, old one preserved |
| No assignment records deleted on unassign | Unassign sets `status = 'unassigned'`, no DELETE |
| Past projects show all historical entries | Time entries query uses `project_id`, not assignment status |
| Active actions restricted to active assignments | Clock-in/submit checks for `status = 'active'` |
