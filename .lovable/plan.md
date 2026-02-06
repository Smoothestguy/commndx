
# Fix WH-347 Export - Personnel Names Not Captured Correctly

## Problem Summary

The WH-347 export is only showing "chris" for all employee rows instead of each individual employee's name. This is caused by two issues:

1. **PDF Field Name Mismatch**: The edge function uses incorrect field name patterns that don't match the actual PDF template field names
2. **Missing Personnel Data**: The `useAdminTimeEntriesByWeek` hook doesn't fetch all required fields (`address`, `city`, `state`, `zip`, `ssn_last_four`) from personnel

## Root Cause Analysis

### Issue 1: PDF Field Names

**Actual PDF Template Fields (from logs):**
| Field Type | Actual Name Pattern |
|------------|-------------------|
| Name/Address/SSN | `nameAddrSSN1`, `nameAddrSSN2`, ... |
| Classification | `workClassification1`, `workClassification2`, ... |
| Overtime Hours Day 1-7 | `OT11`-`OT17`, `OT21`-`OT27`, ... |
| Straight Time Hours | `ST11`-`ST17`, `ST21`-`ST27`, ... |
| Total OT Hours | `totalHoursOT1`, `totalHoursOT2`, ... |
| Total ST Hours | `totalHoursST1`, `totalHoursST2`, ... |
| Gross | `gross1`, `gross2`, ... |
| FICA | `fica1`, `fica2`, ... |
| Withholding | `withholding1`, `withholding2`, ... |
| Net Wages | `netWages1`, `netWages2`, ... |
| Contractor | `contractor` |
| Address | `address` |
| Payroll No | `payrollNo` |
| Week Ending | `weekEnding` |
| Project/Location | `projectAndLocation` |

**Current Code (Incorrect):**
```typescript
setTextField(form, [`Name${rowNum}`, `NameRow${rowNum}`, ...], emp.name, allFieldNames);
```

**Should Be:**
```typescript
setTextField(form, [`nameAddrSSN${rowNum}`], emp.name + '\n' + emp.address + '\n' + ssnMasked, allFieldNames);
```

### Issue 2: Missing Personnel Fields

**Current Query (in useTimeEntries.ts line 256):**
```typescript
personnel:personnel_id(id, first_name, last_name, hourly_rate, photo_url)
```

**Should Include:**
```typescript
personnel:personnel_id(id, first_name, last_name, hourly_rate, photo_url, address, city, state, zip, ssn_last_four)
```

## Implementation Plan

### Step 1: Update Personnel Query

**File:** `src/integrations/supabase/hooks/useTimeEntries.ts`

Add missing fields to the personnel select in `useAdminTimeEntriesByWeek`:
- `address`
- `city`  
- `state`
- `zip`
- `ssn_last_four`

### Step 2: Rewrite Edge Function Field Mapping

**File:** `supabase/functions/generate-wh347/index.ts`

Update the field name patterns to match actual PDF template:

| Data | Old Pattern | New Pattern |
|------|------------|-------------|
| Employee Name/Address/SSN | `Name${row}`, `Address${row}` | `nameAddrSSN${row}` (combined field) |
| Work Classification | `Class${row}` | `workClassification${row}` |
| OT Hours Day X | `O${dayName}${row}` | `OT${row}${dayNum}` |
| ST Hours Day X | `S${dayName}${row}` | `ST${row}${dayNum}` |
| Total OT Hours | `TotalO${row}` | `totalHoursOT${row}` |
| Total ST Hours | `TotalS${row}` | `totalHoursST${row}` |
| OT Rate | `RateO${row}` | `rateOfPayOT${row}` |
| ST Rate | `RateS${row}` | `rateOfPayST${row}` |
| Gross | `Gross${row}` | `gross${row}` |
| FICA | `FICA${row}` | `fica${row}` |
| Withholding | `WT${row}` | `withholding${row}` |
| Total Deductions | `TotalDed${row}` | `totalDeductions${row}` |
| Net Wages | `Net${row}` | `netWages${row}` |
| Contractor | `ContractorName` | `contractor` |
| Address | `ContractorAddress` | `address` |
| Payroll No | `PayrollNo` | `payrollNo` |
| Week Ending | `WeekEnding` | `weekEnding` |
| Project | `ProjectName` | `projectAndLocation` |
| W/H Exemptions | `WH${row}` | `noWithholdingExemptions${row}` |

### Step 3: Update Day Column Mapping

The PDF uses day numbers 1-7 rather than day names:
- Day 1 = first day column (corresponds to days in order from the form)
- `OT11` = Row 1, Day 1 Overtime
- `ST27` = Row 2, Day 7 Straight Time

## Files to Modify

| File | Changes |
|------|---------|
| `src/integrations/supabase/hooks/useTimeEntries.ts` | Add missing personnel fields to select |
| `supabase/functions/generate-wh347/index.ts` | Fix all field name patterns to match PDF template |

## Testing

After implementation:
1. Export WH-347 for a project with multiple personnel
2. Verify all employee names appear correctly in Column 1
3. Verify addresses and SSN (last 4) appear in name column
4. Verify hours populate correctly in day columns
5. Verify totals and calculations are correct
