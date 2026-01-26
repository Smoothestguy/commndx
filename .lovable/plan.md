

# Plan: Fix Existing Vendor Record for Andrés Felipe Alcaraz López

## Problem Identified

The vendor record for **Andrés Felipe Alcaraz López** was created before my code fix was deployed. As a result, the vendor has incorrect data:

| Field | Current Value | Should Be |
|-------|--------------|-----------|
| `vendor_type` | `supplier` | `personnel` |
| `track_1099` | `false` | `true` |
| `tax_id` | `null` | `082415208` (from personnel SSN) |

The personnel record (`a235edf4-d675-4e89-a38e-21cc9deb0675`) is correctly linked to the vendor (`8269ef6a-bf14-42a7-88e5-35673571b849`), but the vendor data needs to be corrected.

---

## Solution

Update the existing vendor record directly in the database to have the correct values.

### Database Update Required

```sql
UPDATE vendors
SET 
  vendor_type = 'personnel',
  track_1099 = true,
  tax_id = '082415208'
WHERE id = '8269ef6a-bf14-42a7-88e5-35673571b849';
```

---

## After Fix Verification

Once updated, the vendor record will have:
- `vendor_type`: `personnel` - Correctly identifies this as a personnel-linked vendor
- `track_1099`: `true` - Enables 1099 tax tracking
- `tax_id`: `082415208` - Tax identifier for QuickBooks sync

---

## QuickBooks Sync (Optional)

After the database update, if QuickBooks integration is connected, you may want to trigger a sync to push the updated tax information to QuickBooks:
- Go to the Vendor detail page
- Use the "Sync to QuickBooks" action

---

## Future Prevention

The code fix I implemented earlier ensures that any **new** vendor records created from the `ConvertRecordTypeDialog` will automatically have the correct:
- `vendor_type: 'personnel'`
- `track_1099: true`
- `tax_id` populated from the personnel's SSN

This was a one-time issue caused by timing between the code change and deployment.

