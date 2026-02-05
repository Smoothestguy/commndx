

# Fix: Update PersonnelOnboarding.tsx Work Authorization Flow

## Issue Identified
The `PersonnelOnboarding.tsx` file (used for `/onboard/:token`) is **mostly correct** but has one key issue:

**Currently**: SSN + SSN Card upload is shown to ALL users at the top of Step 3, regardless of their citizenship/immigration status.

**Required**: 
- SSN should only be shown/required for U.S. Citizens + Visa/Work Permit/Green Card holders
- ITIN should be shown for "Other" immigration status
- SSN Card upload should not be required for "Other" status

## Changes Required

### File: `src/pages/PersonnelOnboarding.tsx`

1. **Import ITINInput component** (already exists in the project)
   
2. **Restructure Step 3 Logic**:
   - Move SSN input INSIDE the citizenship/immigration conditional blocks
   - Add ITIN input for "Other" immigration status
   - Remove the standalone SSN section at the top

### Updated Flow

```text
Step 3: Work Authorization
    |
    v
"Are you a U.S. Citizen?"
    |
+---+---+
|       |
Yes     No
|       |
v       v
SSN     "Immigration Status?"
+       |
Gov ID  +----+----+----+----+
        |    |    |    |
      Visa  WP   GC  Other
        |    |    |    |
        v    v    v    v
       SSN  SSN  SSN  ITIN
        +    +    +    +
      Visa  EAD  GC   Work Auth
      Doc   Doc  F&B  Doc
```

### Code Changes

**Before (current - lines 674-702)**:
```jsx
{/* Social Security Section - ALWAYS SHOWN */}
<div className="space-y-4">
  <h3>Social Security Information</h3>
  <SSNInput ... />
  <CategoryDocumentUpload documentType="ssn_card" ... />
</div>
```

**After (proposed)**:
```jsx
{/* Citizenship question shown first */}
<div className="space-y-4">
  <h3>Citizenship Status</h3>
  <RadioGroup "Are you a U.S. Citizen?" ... />
</div>

{/* US Citizen: SSN + Gov ID */}
{citizenshipStatus === "us_citizen" && (
  <SSNInput ... />
  <CategoryDocumentUpload documentType="government_id" ... />
)}

{/* Non-US Citizen: Immigration dropdown */}
{citizenshipStatus === "non_us_citizen" && (
  <RadioGroup "Immigration Status" ... />
  
  {/* Visa/Work Permit/Green Card: SSN + specific docs */}
  {["visa", "work_permit", "green_card"].includes(immigrationStatus) && (
    <SSNInput ... />
    {/* Conditional document uploads */}
  )}
  
  {/* Other: ITIN + Work Auth doc */}
  {immigrationStatus === "other" && (
    <ITINInput ... />
    <CategoryDocumentUpload documentType="work_authorization" ... />
  )}
)}
```

## Validation Updates

Update `validateStep3` (or equivalent) to:
- Require SSN for US citizens and visa/work_permit/green_card
- Require ITIN for "other" immigration status
- Require appropriate documents based on selection

## Summary

No need to resend the onboarding link. Once this fix is deployed:
1. Your guy can refresh the page
2. He'll see the corrected flow with citizenship question first
3. Based on his selection, he'll see the appropriate identifier (SSN or ITIN) and document requirements

