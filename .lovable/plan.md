
# Plan: Fix Personnel Approval and QuickBooks Vendor Sync Issues

## Summary of Issues Identified

### Issue 1: Inconsistent Approval Behavior
**Problem**: The `ApplicationDetailDialog.tsx` uses `useApproveApplication` hook which directly creates personnel without showing the record type selection dialog. Meanwhile, `RegistrationReviewDialog.tsx` uses `useApproveRegistration` which shows the `ApprovalTypeSelectionDialog` and lets admins choose to create personnel, vendor, customer, or personnel+vendor.

**Root Cause**: Two different approval paths exist with different capabilities.

### Issue 2: Missing Tax Fields During Vendor Sync
**Problem**: When a vendor is created in `approve-personnel-registration/index.ts` (lines 286-299), it does NOT include:
- `tax_id` (should use personnel's `ssn_full`)
- `track_1099` (should default to `true` for 1099 contractors)

The QuickBooks sync function (`quickbooks-sync-vendors/index.ts`) correctly syncs `TaxIdentifier` and `Vendor1099` from the vendor record, but the vendor wasn't created with those fields.

### Issue 3: Manual Vendor Sync from Personnel Page Fails
**Problem**: The `ConvertRecordTypeDialog.tsx` creates vendors locally but does NOT sync them to QuickBooks. After creating a vendor from the personnel detail page, the `quickbooks-sync-vendors` function is never called.

---

## Technical Solution

### Fix 1: Update ApplicationDetailDialog to Show Type Selection

**File**: `src/components/staffing/ApplicationDetailDialog.tsx`

**Changes**:
1. Add state for type selection dialog
2. Import `ApprovalTypeSelectionDialog` and `ApprovalRecordType`
3. Replace `useApproveApplication` with `useApproveApplicationWithType`
4. Modify `handleApprove` to show the type selection dialog instead of directly approving
5. Add a new `handleApproveWithType` function that calls the approval with selected type
6. Render the `ApprovalTypeSelectionDialog` component

```tsx
// Add imports
import { ApprovalTypeSelectionDialog, type RecordType } from "@/components/personnel/ApprovalTypeSelectionDialog";
import { useApproveApplicationWithType } from "@/integrations/supabase/hooks/useStaffingApplications";

// Add state
const [showTypeSelectionDialog, setShowTypeSelectionDialog] = useState(false);

// Replace hook
const approveApplication = useApproveApplicationWithType();

// Modify handleApprove to show dialog
const handleApprove = () => {
  setShowTypeSelectionDialog(true);
};

// Add new handler
const handleApproveWithType = async (recordType: RecordType) => {
  if (!application) return;
  try {
    await approveApplication.mutateAsync({
      applicationId: application.id,
      recordType,
      notes: actionNotes,
    });
    toast.success("Application approved!");
    setShowTypeSelectionDialog(false);
    onOpenChange(false);
  } catch (error) {
    toast.error("Failed to approve application");
  }
};

// Render dialog
<ApprovalTypeSelectionDialog
  open={showTypeSelectionDialog}
  onOpenChange={setShowTypeSelectionDialog}
  onConfirm={handleApproveWithType}
  isLoading={approveApplication.isPending}
  applicantName={`${application?.applicants?.first_name} ${application?.applicants?.last_name}`}
/>
```

---

### Fix 2: Include Tax Fields When Creating Vendor

**File**: `supabase/functions/approve-personnel-registration/index.ts`

**Changes** (lines 286-299): Add `tax_id` from personnel's SSN and set `track_1099` to true:

```typescript
// Create Vendor record if needed
if (recordType === 'vendor' || recordType === 'personnel_vendor') {
  const { data: vendor, error: vendorError } = await serviceClient
    .from("vendors")
    .insert({
      name: `${registration.first_name} ${registration.last_name}`,
      email: registration.email,
      phone: registration.phone,
      address: registration.address,
      city: registration.city,
      state: registration.state,
      zip: registration.zip,
      // Tax fields for 1099 tracking
      tax_id: registration.ssn_full || null,
      track_1099: true,
      vendor_type: 'personnel',
    })
    .select()
    .single();
  // ...
}
```

---

### Fix 3: Add QuickBooks Sync to ConvertRecordTypeDialog

**File**: `src/components/personnel/ConvertRecordTypeDialog.tsx`

**Changes**:
1. Import and use the QuickBooks config and sync hooks
2. After successfully creating a vendor, check if QuickBooks is connected
3. If connected, sync the new vendor to QuickBooks
4. Include tax_id from personnel's ssn_full when creating vendor

```tsx
// Add imports
import { useQuickBooksConfig, useSyncSingleVendor } from "@/integrations/supabase/hooks/useQuickBooks";

// Add hooks in component
const { data: qbConfig } = useQuickBooksConfig();
const syncVendorToQB = useSyncSingleVendor();

// Update createVendorMutation to include tax fields and QB sync
const createVendorMutation = useMutation({
  mutationFn: async () => {
    // Fetch full personnel record to get SSN
    const { data: fullPersonnel } = await supabase
      .from("personnel")
      .select("ssn_full")
      .eq("id", personnel.id)
      .single();
    
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .insert([{
        name: `${personnel.first_name} ${personnel.last_name}`,
        email: personnel.email,
        phone: personnel.phone,
        address: personnel.address,
        city: personnel.city,
        state: personnel.state,
        zip: personnel.zip,
        tax_id: fullPersonnel?.ssn_full || null,
        track_1099: true,
        vendor_type: 'personnel',
      }])
      .select()
      .single();

    if (vendorError) throw vendorError;

    // Link to personnel
    const { error: updateError } = await supabase
      .from("personnel")
      .update({ linked_vendor_id: vendor.id })
      .eq("id", personnel.id);

    if (updateError) throw updateError;

    return vendor;
  },
  onSuccess: async (vendor) => {
    // Sync to QuickBooks if connected
    if (qbConfig?.is_connected) {
      try {
        await syncVendorToQB.mutateAsync(vendor.id);
        toast.success("Vendor created and synced to QuickBooks");
      } catch (qbError) {
        console.error("QuickBooks sync failed:", qbError);
        toast.success("Vendor created", {
          description: "QuickBooks sync pending - can be retried from vendor page"
        });
      }
    } else {
      toast.success("Vendor record created and linked");
    }
    
    queryClient.invalidateQueries({ queryKey: ["personnel", personnel.id] });
    queryClient.invalidateQueries({ queryKey: ["vendors"] });
    onOpenChange(false);
  },
  // ...
});
```

Also update `switchToVendorMutation` with the same tax field inclusion and QB sync.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/staffing/ApplicationDetailDialog.tsx` | Add type selection dialog, switch to `useApproveApplicationWithType` |
| `supabase/functions/approve-personnel-registration/index.ts` | Add `tax_id` and `track_1099` fields when creating vendor |
| `src/components/personnel/ConvertRecordTypeDialog.tsx` | Add QB sync after vendor creation, include tax fields |

---

## Expected Outcomes

1. **Consistent Approval**: Both the staffing applications list (green checkmark) and the application detail dialog will show the same record type selection options

2. **Complete Tax Data**: Vendors created from personnel will have:
   - `tax_id` populated from personnel's SSN
   - `track_1099` set to `true`
   - These will sync to QuickBooks as `TaxIdentifier` and `Vendor1099`

3. **Working Manual Sync**: Creating a vendor from the personnel detail page will automatically trigger QuickBooks sync if connected, ensuring retroactive vendor creation works end-to-end
