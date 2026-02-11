
## Fix: Allow SSN Entry in W9 Tax Form When "Individual" Is Selected

### Problem
In the personnel onboarding W9 Tax Form (Step 5), when the tax classification is set to "Individual," the Social Security Number boxes are read-only `<div>` elements that only display the SSN from earlier steps. If the SSN was not captured in Step 3 (Work Authorization), these boxes appear empty and the user has no way to enter their TIN on the W9 form.

### Root Cause
In `src/components/personnel/onboarding/W9TaxForm.tsx` (lines 684-692), the SSN section uses plain `<div>` elements to display SSN parts from `personnelData.ssn_full`. Unlike the EIN fields (which use `<Input>` components and are editable when a non-individual classification is selected), the SSN fields are never editable.

```text
Current SSN boxes (read-only divs):
  <div className="w9-tin-box ssn-1">{ssnParts.part1}</div>  -- NOT editable
  <div className="w9-tin-box ssn-2">{ssnParts.part2}</div>  -- NOT editable
  <div className="w9-tin-box ssn-3">{ssnParts.part3}</div>  -- NOT editable

EIN boxes (editable inputs):
  <Input className="w9-tin-box ein-1" ... />  -- Editable when needsEIN
  <Input className="w9-tin-box ein-2" ... />  -- Editable when needsEIN
```

### Solution

**File: `src/components/personnel/onboarding/W9TaxForm.tsx`**

1. Replace the three SSN `<div>` elements (lines 687-691) with `<Input>` components that are editable when "Individual" is selected (i.e., when `needsEIN` is false)
2. Add an `onChange` handler that updates `personnelData.ssn_full` through the existing `onChange` prop -- this requires calling `onChange("ssn_full", newValue)` to propagate the value back
3. When "Individual" is NOT selected (e.g., C Corporation), the SSN inputs should be disabled/dimmed (same behavior as EIN inputs when Individual is selected)
4. The inputs will be pre-filled from `personnelData.ssn_full` if it already has a value from Step 3

### Technical Details

The three SSN `<div>` boxes will become `<Input>` fields:
- SSN Part 1 (3 digits): editable, `maxLength={3}`, updates first 3 chars of ssn_full
- SSN Part 2 (2 digits): editable, `maxLength={2}`, updates chars 3-5 of ssn_full
- SSN Part 3 (4 digits): editable, `maxLength={4}`, updates chars 5-9 of ssn_full

Each input will:
- Strip non-digit characters
- Be disabled when `needsEIN` is true (non-individual classification)
- Use monospace font to match the EIN inputs
- Auto-advance focus to the next box when filled (for better UX)

Additionally, the `W9TaxFormProps` interface and the parent `PersonnelOnboarding.tsx` need to support writing back to `ssn_full` through the `onChange` callback. The current `onChange` prop already accepts any field string, so calling `onChange("ssn_full", value)` should propagate correctly as long as the parent handles it -- which it does via the generic `updateField` pattern.

### Files to Change
1. `src/components/personnel/onboarding/W9TaxForm.tsx` -- Replace SSN `<div>` boxes with editable `<Input>` fields
