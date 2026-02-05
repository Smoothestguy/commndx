
# WH-347 Certified Payroll Form Export Feature

## Overview
Add the ability to generate a WH-347 (Davis-Bacon Certified Payroll) form from weekly time entries. This federal form is required for contractors on government-funded construction projects to report weekly payroll data.

## WH-347 Form Requirements

The WH-347 is a standardized federal form that requires:

### Header Section
| Field | Source |
|-------|--------|
| Contractor/Subcontractor Name | Company settings |
| Address | Company settings |
| Payroll Number | Auto-generated sequence |
| Week Ending | Selected week's end date |
| Project Name & Location | Project details |
| Contract Number | Project customer_po field |

### Per-Employee Row Data
| Column | Source |
|--------|--------|
| Name, Address, SSN (last 4) | Personnel table |
| Work Classification | New field needed on personnel or assignment |
| Hours (S, M, T, W, T, F, S) | Daily time entries |
| Total Hours | Sum of daily hours |
| Rate of Pay | Personnel hourly_rate |
| Gross Amount Earned | Hours × Rate (with OT calculation) |
| Deductions (FICA, Withholding, Other) | Personnel payment deductions or zeros |
| Net Wages Paid | Gross minus deductions |

### Certification Section
- Statement of Compliance signature block
- Date and certifying official info

## Database Changes

### Add Work Classification Field
Need to add `work_classification` to either:
- **Option A**: `personnel` table (if classification is static per worker)
- **Option B**: `personnel_project_assignments` table (if classification varies by project)

**Recommended: Option B** - Workers may have different classifications on different projects.

```sql
ALTER TABLE personnel_project_assignments 
ADD COLUMN work_classification TEXT;
```

Common classifications: Electrician, Plumber, Carpenter, Laborer, Ironworker, Equipment Operator, etc.

## Implementation Plan

### 1. Database Migration
Add `work_classification` column to `personnel_project_assignments` table

### 2. Create WH-347 Export Utility

**File**: `src/utils/wh347ExportUtils.ts`

Functions:
- `generateWH347PDF(data: WH347ExportData)` - Generate the official form layout
- `calculateDeductions(personnel)` - Calculate FICA, withholding amounts
- `formatWH347Row(personnel, weekEntries)` - Format a single employee row

The PDF will use jsPDF (already installed) with a precise layout matching the official DOL form.

### 3. Create WH-347 Export Dialog

**File**: `src/components/time-tracking/WH347ExportDialog.tsx`

Modal dialog for:
- Project selection (pre-filled if filtered)
- Payroll number input (auto-suggested)
- Work classification assignment for personnel without one
- Option to include/exclude specific personnel
- Certification details input
- Preview before export

### 4. Add WH-347 Option to Export Menu

**File Modification**: `src/components/time-tracking/WeeklyTimesheet.tsx`

Add a new dropdown item in the export menu:
```tsx
<DropdownMenuItem onClick={() => handleOpenWH347Dialog()}>
  <FileCheck className="h-4 w-4 mr-2" />
  Export WH-347 Certified Payroll
</DropdownMenuItem>
```

### 5. Update Personnel Assignment Form

**File Modification**: `src/components/time-tracking/PersonnelAssignmentDialog.tsx` (or similar)

Add work classification dropdown when assigning personnel to projects.

## Data Flow

```text
[WeeklyTimesheet]
     |
     v
[Export WH-347 Menu Item]
     |
     v
[WH347ExportDialog]
   - Select/confirm project
   - Enter payroll number
   - Assign missing work classifications
   - Enter certification details
     |
     v
[generateWH347PDF()]
   - Fetch personnel data with SSN last 4
   - Fetch daily time entries for week
   - Calculate hours per day (S-S layout)
   - Calculate wages with OT at 1.5x
   - Format deductions
   - Generate official DOL form layout
     |
     v
[PDF Download]
```

## WH-347 PDF Layout

```text
+------------------------------------------------------------------+
| U.S. DEPARTMENT OF LABOR                    WH-347               |
| WAGE AND HOUR DIVISION              OMB No. 1235-0008            |
+------------------------------------------------------------------+
| Contractor: [Company Name]           | Payroll No: [###]         |
| Address: [Company Address]           | Week Ending: [MM/DD/YYYY] |
| Project: [Project Name]              | Contract No: [Customer PO]|
| Project Location: [City, State]      |                           |
+------------------------------------------------------------------+
|    NAME/ADDRESS/SSN    | WORK   |  HOURS WORKED EACH DAY        |
|     (last 4 digits)    | CLASS. | S | M | T | W | T | F | S |TOT|
|------------------------|--------|---|---|---|---|---|---|---|---|
| John Doe               | Elect. | 0 | 8 | 8 | 8 | 8 | 8 | 0 | 40|
| 123 Main St            |        |   |   |   |   |   |   |   |   |
| SSN: ***-**-1234       |        |   |   |   |   |   |   |   |   |
|------------------------|--------|---|---|---|---|---|---|---|---|
| [Continues for each personnel...]                                 |
+------------------------------------------------------------------+
|                        | RATE | GROSS  | DEDUCTIONS      | NET  |
|                        |      | EARNED | FICA | W/H | OTH |WAGES |
|------------------------|------|--------|------|-----|-----|------|
| John Doe               |25.00 |1,000.00| 76.50|80.00|0.00 |843.50|
|------------------------|------|--------|------|-----|-----|------|
+------------------------------------------------------------------+
| STATEMENT OF COMPLIANCE                                          |
| I certify the payroll is correct and complete...                 |
|                                                                   |
| Signature: _________________ Date: ________ Title: _____________ |
+------------------------------------------------------------------+
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Database | Migration | Add `work_classification` to `personnel_project_assignments` |
| `src/utils/wh347ExportUtils.ts` | Create | PDF generation for WH-347 form |
| `src/components/time-tracking/WH347ExportDialog.tsx` | Create | Dialog for WH-347 export options |
| `src/components/time-tracking/WeeklyTimesheet.tsx` | Modify | Add WH-347 export option to menu |
| `src/integrations/supabase/hooks/usePersonnelAssignments.ts` | Modify | Include work_classification in queries |

## Security Considerations

- SSN last 4 digits are fetched only when generating the form
- Form generation happens client-side - no SSN data sent to external services
- Only admins/managers can access this export option
- Audit log entry created when WH-347 is generated

## Future Enhancements

- Save generated WH-347 forms to document storage for compliance records
- Digital signature capture for certification
- Automatic payroll number sequencing by project
- E-submission format for agencies that accept electronic filing
