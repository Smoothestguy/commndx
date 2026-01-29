
# Fix: Allow Formatted Phone Number Search on Vendors Page

## Problem
Phone number search on the Vendors page fails when pasting formatted phone numbers like `(904) 534-5243`. The search compares the exact formatted string against database values stored as digits only (e.g., `9045345243`).

**Current behavior in `src/pages/Vendors.tsx`:**

| Search Type | Current Code (Line) | Issue |
|-------------|---------------------|-------|
| Vendor phone | `v.phone.toLowerCase().includes(searchLower)` (line 222) | No normalization |
| Personnel phone | `p.phone.includes(search)` (line 196) | No normalization |

## Solution
Normalize the search input by stripping non-digit characters when matching phone numbers. This allows users to paste formatted phone numbers like `(904) 534-5243` which will be converted to `9045345243` for matching.

### Changes to `src/pages/Vendors.tsx`

**Fix 1: Vendor search (around line 218-226)**

Before:
```typescript
const searchLower = search.toLowerCase();
const matchesSearch =
  v.name.toLowerCase().includes(searchLower) ||
  v.email.toLowerCase().includes(searchLower) ||
  (v.phone && v.phone.toLowerCase().includes(searchLower)) ||
  ...
```

After:
```typescript
const searchLower = search.toLowerCase();
const phoneSearch = search.replace(/\D/g, ''); // Strip non-digits
const matchesSearch =
  v.name.toLowerCase().includes(searchLower) ||
  v.email.toLowerCase().includes(searchLower) ||
  (v.phone && phoneSearch.length > 0 && v.phone.includes(phoneSearch)) ||
  ...
```

**Fix 2: Personnel search in Vendors page (around line 193-196)**

Before:
```typescript
const matchesSearch =
  fullName.includes(search.toLowerCase()) ||
  p.email.toLowerCase().includes(search.toLowerCase()) ||
  (p.phone && p.phone.includes(search));
```

After:
```typescript
const phoneSearch = search.replace(/\D/g, ''); // Strip non-digits
const matchesSearch =
  fullName.includes(search.toLowerCase()) ||
  p.email.toLowerCase().includes(search.toLowerCase()) ||
  (p.phone && phoneSearch.length > 0 && p.phone.includes(phoneSearch));
```

## File Changes Summary

| File | Action |
|------|--------|
| `src/pages/Vendors.tsx` | Normalize phone search by stripping non-digits for both vendor and personnel filtering |

## How It Works After Fix

| User Types | Phone Search Becomes | Matches DB Value |
|------------|---------------------|------------------|
| `(904) 534-5243` | `9045345243` | `9045345243` Yes |
| `904-534-5243` | `9045345243` | `9045345243` Yes |
| `9045345243` | `9045345243` | `9045345243` Yes |
| `John` | (empty) | Name/email search only |

## Technical Notes
- Uses `replace(/\D/g, '')` to strip all non-digit characters
- Only applies phone matching when the normalized search has digits (avoids matching empty string)
- Other fields (name, email, specialty, company, etc.) continue using the original search string
- This matches the fix already applied to `usePersonnel.ts` hook
