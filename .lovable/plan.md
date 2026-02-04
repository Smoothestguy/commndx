

# Require Save Before Attachment Sync

## Problem

When editing a vendor bill, you can upload attachments **before** saving your edits to the bill. This causes issues because:

1. **The attachment immediately tries to sync to QuickBooks** when uploaded
2. **If the bill has unsaved changes**, QuickBooks may have stale data or the sync may fail
3. **Clicking "Retry" works** because by then you've likely saved the bill

The expected flow should be: **Edit bill → Save → Then upload attachments** (or prompt to save first).

---

## Solution

Add a "save required" check to the attachment upload flow for vendor bills in edit mode.

### Approach A: Prompt to Save First (Recommended)

When the user tries to upload an attachment while there are unsaved form changes:

1. Show a confirmation dialog: "You have unsaved changes. Save the bill before uploading attachments?"
2. If "Save & Upload": auto-save the bill, then proceed with the attachment upload
3. If "Cancel": close the dialog, no upload

### Implementation Steps

**Step 1: Track Form "Dirty" State**

Add logic in `VendorBillForm.tsx` to detect when form fields have changed from their initial values:

```typescript
const [initialFormData, setInitialFormData] = useState<object | null>(null);

// Set initial form data after bill is loaded
useEffect(() => {
  if (bill && isEditing && vendors) {
    // ... existing field population
    setInitialFormData({
      vendor_id: bill.vendor_id,
      bill_date: bill.bill_date,
      due_date: bill.due_date,
      status: bill.status,
      tax_rate: bill.tax_rate,
      notes: bill.notes,
      lineItems: JSON.stringify(bill.line_items),
    });
  }
}, [bill, isEditing, vendors]);

// Compute if form is dirty
const isFormDirty = useMemo(() => {
  if (!initialFormData || !isEditing) return false;
  const currentData = {
    vendor_id: selectedVendor?.id,
    bill_date: billDate,
    due_date: dueDate,
    status,
    tax_rate: taxRate,
    notes,
    lineItems: JSON.stringify(lineItems),
  };
  return JSON.stringify(currentData) !== JSON.stringify(initialFormData);
}, [initialFormData, selectedVendor, billDate, dueDate, status, taxRate, notes, lineItems, isEditing]);
```

**Step 2: Pass Dirty State + Save Handler to Attachments Component**

Update `VendorBillAttachments` to receive:
- `isFormDirty: boolean` - whether the form has unsaved changes
- `onSaveRequired: () => Promise<void>` - callback to save the form before proceeding

**Step 3: Add Save-First Dialog in Attachments Component**

When upload is triggered and `isFormDirty` is true:
1. Show AlertDialog: "Save changes before uploading?"
2. On confirm: call `onSaveRequired()`, then proceed with upload
3. On cancel: abort

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/vendor-bills/VendorBillForm.tsx` | Add dirty state tracking, pass `isFormDirty` and `onSaveRequired` to attachments component |
| `src/components/vendor-bills/VendorBillAttachments.tsx` | Accept new props, show save-first dialog when dirty |
| `src/components/shared/FileAttachmentUpload.tsx` | Add optional `requireSave` prop and `onBeforeUpload` callback for the save-first flow |

---

## User Experience After Fix

1. **Edit bill** → change vendor name, line items, etc.
2. **Try to upload attachment** → Dialog appears: "You have unsaved changes. Save the bill first to sync attachments to QuickBooks."
3. **Click "Save & Upload"** → Bill is saved, then attachment uploads and syncs
4. **Or click "Cancel"** → Nothing happens, user can continue editing

This ensures the attachment sync always happens against the latest saved bill data.

---

## Technical Details

The key insight is that the current flow allows:
- Form edits (not saved yet)
- Attachment upload (immediately triggers QB sync)
- QB sync uses the **old** bill data from the database

By requiring a save first, we ensure:
- Bill is up-to-date in the database
- QB has the latest bill data before attachment is linked
- Sync succeeds on first try

