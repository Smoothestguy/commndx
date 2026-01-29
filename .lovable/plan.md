
# Fix: Vendor Search Fails When Personnel Has No Linked Vendor

## Problem Identified
The vendor search in the "Link Personnel to Vendor" dialog fails with a **400 error** when the personnel record has no linked vendor (`vendor_id` is null).

**Root Cause:** Line 69 in `PersonnelVendorMergeDialog.tsx`:
```typescript
.neq("id", currentVendorId || "")
```

When `currentVendorId` is `null` or `undefined`, this passes an empty string `""` to the `.neq()` filter. PostgreSQL then tries to compare `id` (a UUID column) against an empty string, which fails with:
```
"invalid input syntax for type uuid: \"\""
```

**Network request showing the error:**
```
GET .../vendors?...&id=neq.&order=name.asc
Status: 400
Response: {"code":"22P02","message":"invalid input syntax for type uuid: \"\""}
```

## Solution
Conditionally apply the `.neq()` filter only when `currentVendorId` is a valid value (not null/undefined).

### Changes to `src/components/merge/PersonnelVendorMergeDialog.tsx`

**Before (lines 65-71):**
```typescript
const { data, error } = await supabase
  .from("vendors")
  .select("id, name, email, phone, company, status")
  .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
  .neq("id", currentVendorId || "")
  .order("name")
  .limit(20);
```

**After:**
```typescript
let query = supabase
  .from("vendors")
  .select("id, name, email, phone, company, status")
  .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);

// Only exclude current vendor if one is linked
if (currentVendorId) {
  query = query.neq("id", currentVendorId);
}

const { data, error } = await query
  .order("name")
  .limit(20);
```

## File Changes Summary

| File | Action |
|------|--------|
| `src/components/merge/PersonnelVendorMergeDialog.tsx` | Conditionally apply `.neq()` filter only when `currentVendorId` is truthy |

## Technical Notes
- The `.neq("id", "")` call generates an invalid PostgREST filter `id=neq.` which PostgreSQL rejects
- When no vendor is linked (`currentVendorId` is null), we don't need to exclude any vendor from results
- This pattern (conditional filter chaining) is common in Supabase queries when filters are optional
