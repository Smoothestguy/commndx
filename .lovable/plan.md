

# Enhance Vendor Search Functionality

## Problem
The Vendors page search currently only looks at `name`, `specialty`, and `company` fields. Users need to search by additional fields like **email**, **phone**, and **account number** to quickly find vendors.

## Current Behavior
| Search Location | Fields Searched | Status |
|-----------------|-----------------|--------|
| Vendors list page | name, specialty, company | **Missing email, phone, account_number** |
| Personnel list (in Vendors page) | name, email, phone | Already working |
| Personnel-to-Vendor link dialog | name, email, phone | Already working |

## Solution
Update the vendor filtering logic in `src/pages/Vendors.tsx` to include additional searchable fields.

### Changes to `src/pages/Vendors.tsx`

**Before (lines 218-221):**
```typescript
const matchesSearch =
  v.name.toLowerCase().includes(search.toLowerCase()) ||
  (v.specialty && v.specialty.toLowerCase().includes(search.toLowerCase())) ||
  (v.company && v.company.toLowerCase().includes(search.toLowerCase()));
```

**After:**
```typescript
const searchLower = search.toLowerCase();
const matchesSearch =
  v.name.toLowerCase().includes(searchLower) ||
  v.email.toLowerCase().includes(searchLower) ||
  (v.phone && v.phone.toLowerCase().includes(searchLower)) ||
  (v.specialty && v.specialty.toLowerCase().includes(searchLower)) ||
  (v.company && v.company.toLowerCase().includes(searchLower)) ||
  (v.account_number && v.account_number.toLowerCase().includes(searchLower)) ||
  (v.tax_id && v.tax_id.toLowerCase().includes(searchLower));
```

### Fields Now Searchable

| Field | Purpose |
|-------|---------|
| `name` | Vendor display name |
| `email` | Contact email |
| `phone` | Contact phone number |
| `specialty` | Trade/specialty |
| `company` | Company name |
| `account_number` | Internal account reference |
| `tax_id` | Tax identification (partial match for last digits) |

## File Changes Summary

| File | Action |
|------|--------|
| `src/pages/Vendors.tsx` | Update vendor filter logic to include email, phone, account_number, and tax_id |

## Technical Notes

- The `email` field is required (non-nullable), so no null check needed
- Other fields like `phone`, `account_number`, and `tax_id` are nullable and require null checks
- Personnel search already includes email and phone (lines 193-196)
- PersonnelVendorMergeDialog already searches vendors by email and phone via database query (line 68)

