

# Fix: Allow Formatted Phone Number Search

## Problem
Phone numbers are stored in the database as digits only (e.g., `9045345243`), but users often paste formatted phone numbers like `(904) 534-5243`. The current search looks for the exact string, which doesn't match.

| Search Input | Stored Value | Match? |
|--------------|--------------|--------|
| `9045345243` | `9045345243` | Yes |
| `(904) 534-5243` | `9045345243` | No |
| `904-534-5243` | `9045345243` | No |

## Solution
Normalize the search input by stripping all non-digit characters before searching the phone field. This way, both formatted and unformatted phone numbers will match.

### Changes to `src/integrations/supabase/hooks/usePersonnel.ts`

**Before (lines 29-33):**
```typescript
if (filters?.search) {
  query = query.or(
    `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,personnel_number.ilike.%${filters.search}%`
  );
}
```

**After:**
```typescript
if (filters?.search) {
  // Strip non-digits from search for phone matching
  const phoneSearch = filters.search.replace(/\D/g, '');
  
  // Build search conditions - use normalized phone if it has digits
  const searchConditions = [
    `first_name.ilike.%${filters.search}%`,
    `last_name.ilike.%${filters.search}%`,
    `email.ilike.%${filters.search}%`,
    `personnel_number.ilike.%${filters.search}%`,
  ];
  
  // Add phone search with normalized digits if there are any
  if (phoneSearch.length > 0) {
    searchConditions.push(`phone.ilike.%${phoneSearch}%`);
  }
  
  query = query.or(searchConditions.join(','));
}
```

### Also Update `usePersonnelWithRelations` (around lines 127-131)
Apply the same fix to maintain consistent search behavior.

## File Changes Summary

| File | Action |
|------|--------|
| `src/integrations/supabase/hooks/usePersonnel.ts` | Normalize phone search by stripping non-digits in both `usePersonnel` and `usePersonnelWithRelations` hooks |

## How It Works

| User Types | Phone Search Becomes | Matches DB Value |
|------------|---------------------|------------------|
| `(904) 534-5243` | `9045345243` | `9045345243` Yes |
| `904-534-5243` | `9045345243` | `9045345243` Yes |
| `9045345243` | `9045345243` | `9045345243` Yes |
| `John` | (empty - no digits) | Name search only |

## Technical Notes
- The `replace(/\D/g, '')` regex strips all non-digit characters
- Other fields (name, email, personnel_number) still use the original search string
- This matches the input behavior of the `FormattedPhoneInput` component which also stores only digits
