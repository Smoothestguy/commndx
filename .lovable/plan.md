
# Plan: Fix Personnel-Linked Vendor Records with Incorrect Data

## Problem Summary

I found **17 vendor records** that were created from personnel but have incorrect data:

| Issue | Count |
|-------|-------|
| Wrong `vendor_type` (not 'personnel') | 8 records |
| Missing `track_1099` (false instead of true) | 17 records |
| Missing `tax_id` (SSN available but not copied) | 7 records |

---

## Records to Fix

### Group 1: Wrong vendor_type + Missing track_1099 + Has SSN to copy (4 records)

| Personnel Name | Vendor ID | Current Type | SSN to Copy |
|---------------|-----------|--------------|-------------|
| Abraham Gamez | 0f836ee6-2594-43cc-a9f4-1e86626b14f2 | contractor | 637111259 |
| Alejandro De La Cruz | 63058799-ffcd-4143-8c7d-42ab08a164aa | contractor | 645707605 |
| Francisco Fereira | 273e8770-a867-45b7-b318-b87b739ccd46 | contractor | 881842961 |
| Jhoandry jose Suarez Vargas | 40765a4a-1e1c-4f97-9fce-8e744f73b828 | contractor | 697549077 |

### Group 2: Wrong vendor_type + Missing track_1099 + No SSN (3 records)

| Personnel Name | Vendor ID | Current Type |
|---------------|-----------|--------------|
| Anderson José Guzmán rosendo | 3c39635d-1497-4aa0-bf41-268c1c542c4d | supplier |
| Juan Cambero | a2d1201a-a161-4f7c-b937-948f5d612447 | supplier |
| Lucy Acevedo | 795b65e1-8d15-4b87-8fe7-1a7e6477f39d | supplier |

### Group 3: Correct vendor_type but Missing track_1099 + Has SSN to copy (3 records)

| Personnel Name | Vendor ID | SSN to Copy |
|---------------|-----------|-------------|
| Rosswall Garcia | 0c03e82b-68d8-4efd-8a80-d7c5774bae31 | 178885307 |
| (already fixed) Andrés Felipe Alcaraz López | - | - |

### Group 4: Correct vendor_type but Missing track_1099 + No SSN (7 records)

| Personnel Name | Vendor ID |
|---------------|-----------|
| ALONSO GONZALEZ | 96e8eb34-f43e-4ddc-a284-54f5d1d88571 |
| CESAR GAMEZ | fc4dd5d7-f7be-4cbf-a7e8-397925e3efb6 |
| Hector Garcia | d0a9c0a0-4e07-44c9-b6d1-1418d45a9aef |
| JADE HALL | e29ba682-b5bf-4c89-affc-5a7b94989b3b |
| Jonni Rosales | e87b5587-4bcd-4b0f-8654-0b5316e9e8cd |
| JORGE GONZALEZ | 7f4b8dd7-2761-46bd-9728-6dd509c35239 |
| Joseph Urdaneta | 03310729-01fe-46b5-9431-8464923cc04f |
| MARIELA GAMEZ | c37cb69c-88ac-48e5-813c-65c7307f6d5c |
| ORIANA PEREZ | cef1b878-1d45-485b-9308-e1f6648eaf80 |

---

## Solution: Single Database Update

Execute a batch update to fix all 17 records in one query:

```sql
-- Fix vendors with SSN available (copy tax_id from personnel)
UPDATE vendors v
SET 
  vendor_type = 'personnel',
  track_1099 = true,
  tax_id = p.ssn_full
FROM personnel p
WHERE p.linked_vendor_id = v.id
  AND p.linked_vendor_id IS NOT NULL
  AND (v.vendor_type != 'personnel' OR v.track_1099 = false OR (v.tax_id IS NULL AND p.ssn_full IS NOT NULL));
```

---

## Expected Results After Fix

| Field | Before | After |
|-------|--------|-------|
| `vendor_type` | contractor/supplier/personnel | personnel (all) |
| `track_1099` | false | true (all) |
| `tax_id` | null | Populated from SSN where available |

---

## Impact

- **17 vendor records** will be corrected
- **7 records** will have `tax_id` populated from personnel SSN
- All will be properly identified as `personnel` type vendors
- All will have `track_1099 = true` for tax compliance
- QuickBooks sync will now work correctly for these vendors
