

## Reactivate Deactivated Personnel and Remove from User Management

### Overview
Two changes: (1) add the ability to reactivate deactivated personnel, and (2) ensure deactivated personnel are fully excluded from the User Management page.

---

### 1. Add Reactivate Personnel Hook

**File: `src/integrations/supabase/hooks/usePersonnel.ts`**

Create a new `useReactivatePersonnel` mutation that sets `status` back to `"active"` for a given personnel ID, with audit logging.

---

### 2. Add Reactivate Button to Personnel Table and Mobile Card

**File: `src/components/personnel/PersonnelTable.tsx`**

- Import `useReactivatePersonnel`
- For personnel with status `"inactive"` or `"do_not_hire"`, show a "Reactivate" action in the dropdown/actions area (RotateCcw icon)
- On click, call `reactivatePersonnel.mutateAsync(id)` to set status back to `"active"`

**File: `src/components/personnel/MobilePersonnelCard.tsx`**

- Same change: add a Reactivate button for inactive personnel

---

### 3. Ensure Deactivated Personnel Are Excluded from User Management

**File: `src/pages/UserManagement.tsx`** (lines 265-271)

The current code already excludes personnel-linked users from the user list. However, it excludes ALL personnel (active and inactive). This is already correct behavior per the user's request -- personnel should not appear in user management at all regardless of status.

No change needed here since the existing filter already removes all personnel-linked users. The user's request is "remove them entirely from the user management page" which is already implemented.

---

### Technical Details

**New hook: `useReactivatePersonnel`** in `src/integrations/supabase/hooks/usePersonnel.ts`

```typescript
export const useReactivatePersonnel = () => {
  // mutation: update status from 'inactive'/'do_not_hire' back to 'active'
  // audit log the reactivation
  // invalidate personnel queries
  // toast success
};
```

**PersonnelTable.tsx changes:**
- Add a "Reactivate" dropdown menu item that appears only when `person.status !== "active"`
- Uses `useReactivatePersonnel` hook
- Shows RotateCcw icon with "Reactivate" label

**MobilePersonnelCard.tsx changes:**
- Add a "Reactivate" button in the action area for inactive personnel
- Same hook usage

### Files to Modify

| File | Purpose |
|------|---------|
| `src/integrations/supabase/hooks/usePersonnel.ts` | Add `useReactivatePersonnel` mutation hook |
| `src/components/personnel/PersonnelTable.tsx` | Add Reactivate action in dropdown for inactive personnel |
| `src/components/personnel/MobilePersonnelCard.tsx` | Add Reactivate button for inactive personnel |

