
# Fix Personnel Notification Preferences Duplicate Key Error

## Problem
When toggling SMS notifications off in the personnel portal settings, users get the error:
> "duplicate key value violates unique constraint 'personnel_notification_preferences_personnel_id_key'"

## Root Cause
The `useUpdateNotificationPreferences` hook in `src/integrations/supabase/hooks/usePortal.ts` uses Supabase's `upsert()` method but does **not specify the conflict column**.

Current code (lines 247-254):
```typescript
const { data, error } = await supabase
  .from("personnel_notification_preferences")
  .upsert({
    personnel_id: personnelId,
    ...preferences,
  })
  .select()
  .single();
```

The table structure:
- **Primary key**: `id` (uuid, auto-generated)
- **Unique constraint**: `personnel_id` (the column we want to match on)

By default, Supabase's `upsert` matches on the **primary key** (`id`). Since no `id` is provided, it attempts an INSERT. When a record for that `personnel_id` already exists, it violates the unique constraint.

## Solution
Add the `onConflict` option to specify that upsert should match on `personnel_id`:

```typescript
const { data, error } = await supabase
  .from("personnel_notification_preferences")
  .upsert(
    {
      personnel_id: personnelId,
      ...preferences,
    },
    { onConflict: 'personnel_id' }
  )
  .select()
  .single();
```

This tells Supabase: "If a row with this `personnel_id` already exists, update it; otherwise, insert a new row."

---

## File Changes

### `src/integrations/supabase/hooks/usePortal.ts`

**Lines 247-254** - Update the upsert call:

| Before | After |
|--------|-------|
| `.upsert({ personnel_id: personnelId, ...preferences })` | `.upsert({ personnel_id: personnelId, ...preferences }, { onConflict: 'personnel_id' })` |

---

## Summary

| Aspect | Details |
|--------|---------|
| Root cause | Missing `onConflict` option in upsert |
| Fix | Add `{ onConflict: 'personnel_id' }` to upsert call |
| Files modified | 1 file: `usePortal.ts` |
| Risk | Low - standard Supabase upsert pattern |
