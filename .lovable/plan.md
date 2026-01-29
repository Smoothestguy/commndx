
# Add Phone to Personnel Search

## Problem Identified
The Personnel Management search currently does NOT include the `phone` field. Looking at line 29-32 in `usePersonnel.ts`:

```typescript
if (filters?.search) {
  query = query.or(
    `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,personnel_number.ilike.%${filters.search}%`
  );
}
```

| Field | Currently Searchable |
|-------|---------------------|
| first_name | Yes |
| last_name | Yes |
| email | Yes |
| personnel_number | Yes |
| **phone** | **NO - Missing** |

## Solution
Add `phone` field to the search filter in the `usePersonnel` hook.

### Changes to `src/integrations/supabase/hooks/usePersonnel.ts`

**Before (lines 29-33):**
```typescript
if (filters?.search) {
  query = query.or(
    `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,personnel_number.ilike.%${filters.search}%`
  );
}
```

**After:**
```typescript
if (filters?.search) {
  query = query.or(
    `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,personnel_number.ilike.%${filters.search}%`
  );
}
```

### Also Update `usePersonnelWithRelations` (lines 128-131)
The same fix needs to be applied to the `usePersonnelWithRelations` hook which has the same search logic:

**Before:**
```typescript
if (filters?.search) {
  query = query.or(
    `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,personnel_number.ilike.%${filters.search}%`
  );
}
```

**After:**
```typescript
if (filters?.search) {
  query = query.or(
    `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,personnel_number.ilike.%${filters.search}%`
  );
}
```

## File Changes Summary

| File | Action |
|------|--------|
| `src/integrations/supabase/hooks/usePersonnel.ts` | Add `phone.ilike` to search filters in both `usePersonnel` and `usePersonnelWithRelations` hooks |

## Fields After Fix

| Field | Searchable |
|-------|------------|
| first_name | Yes |
| last_name | Yes |
| email | Yes |
| phone | Yes |
| personnel_number | Yes |

## Technical Notes
- The `phone` field is nullable, but using `ilike` with null values is safe in PostgreSQL (returns no match)
- This matches the pattern used in the Vendors page search we just updated
- Both hooks need updating to ensure consistent search behavior across the app
