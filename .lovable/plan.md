

# Add Mandatory Payroll Field to Project Creation

## Overview
Add a "Mandatory Payroll" (Yes/No) toggle to the project creation and edit form. This boolean field will be stored in the `projects` table.

## Database Change

A new column needs to be added to the `projects` table:

```sql
ALTER TABLE projects 
ADD COLUMN mandatory_payroll BOOLEAN DEFAULT false;
```

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `mandatory_payroll` | boolean | false | Whether payroll is mandatory for this project |

## Implementation

### 1. Database Migration
Add `mandatory_payroll` boolean column with default `false`

### 2. Update Form Data Interface

**File**: `src/components/projects/ProjectFormDialog.tsx`

Add to `ProjectFormData` interface:
```typescript
interface ProjectFormData {
  // ... existing fields
  mandatory_payroll: boolean;
}
```

Update `initialProjectFormData`:
```typescript
export const initialProjectFormData: ProjectFormData = {
  // ... existing fields
  mandatory_payroll: false,
};
```

### 3. Add Toggle to Form UI

Add a new toggle in the form (after Time Clock Settings section):

```text
+--------------------------------------------------+
| Payroll Settings                                 |
|--------------------------------------------------|
| Mandatory Payroll                    [Toggle]    |
| Personnel must be on payroll for this project    |
+--------------------------------------------------+
```

**Location in form**: After "Time Clock Settings" section, before "Description"

### 4. Update useProjects Hook

**File**: `src/integrations/supabase/hooks/useProjects.ts`

Add `mandatory_payroll` to the `Project` interface:
```typescript
export interface Project {
  // ... existing fields
  mandatory_payroll: boolean;
}
```

### 5. Update Projects.tsx Form Submission

**File**: `src/pages/Projects.tsx`

Ensure `mandatory_payroll` is passed when creating/editing projects and pre-populated when editing.

## Files to Modify

| File | Change |
|------|--------|
| Database | Add `mandatory_payroll` column to `projects` table |
| `src/components/projects/ProjectFormDialog.tsx` | Add field to interface, initial data, and form UI |
| `src/integrations/supabase/hooks/useProjects.ts` | Add field to Project interface |
| `src/pages/Projects.tsx` | Handle field in create/edit logic |

## UI Preview

The toggle will appear in a "Payroll Settings" section:

```text
─────────────────────────────────────────────────
  Payroll Settings
─────────────────────────────────────────────────
  Mandatory Payroll                    [  OFF  ]
  Personnel must be on payroll for this project
─────────────────────────────────────────────────
```

