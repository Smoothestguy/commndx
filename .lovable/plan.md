

# WH-347 Form Update - Match Official DOL Layout

## Analysis of Official Form vs Current Implementation

After reviewing the uploaded official DOL WH-347 form, I've identified several layout and data discrepancies that need to be corrected:

### Key Differences Found

| Element | Official Form | Current Implementation |
|---------|--------------|------------------------|
| **Checkbox** | "NAME OF CONTRACTOR ☐ OR SUBCONTRACTOR ☐" checkboxes | Not present |
| **Column Headers** | Has "NO. OF WITHHOLDING EXEMPTIONS" column | Not present |
| **Column Order** | Specific numbered columns (1)-(9) | Different order |
| **Daily Hours Row** | Has "O" (overtime) and "S" (straight) sub-rows | Only shows total hours per day |
| **Rate of Pay** | Shows both "O" (OT rate) and "S" (Straight rate) | Only shows one rate |
| **Orientation** | Portrait format | Currently landscape |
| **OMB Expiration** | "Expires 09/30/2026" | Shows "02/28/2027" |
| **Page 2** | Full Statement of Compliance (WH-348) | Abbreviated certification section |

### Implementation Plan

#### 1. Update PDF Generation Layout (`src/utils/wh347ExportUtils.ts`)

Major changes needed:
- Change to portrait orientation to match official form
- Add contractor/subcontractor checkboxes
- Add "NO. OF WITHHOLDING EXEMPTIONS" column
- Split daily hours into O (overtime) and S (straight time) sub-rows
- Show both straight time and overtime rates
- Update OMB expiration date to 09/30/2026
- Add full WH-348 Statement of Compliance on page 2

#### 2. Data Structure Updates

Add to `WH347PersonnelData` interface:
```typescript
withholdingExemptions?: number; // Number of withholding exemptions claimed
isSubcontractor?: boolean;      // Contractor or subcontractor checkbox
```

Update `WH347EmployeeRow` to track daily O/S breakdown:
```typescript
dailyHours: WH347DailyHours[]; // Each day needs { straight: number, overtime: number }
```

#### 3. Updated Column Layout (Portrait)

Match the official form's structure:

```text
| (1) NAME, IDENTIFYING NUMBER | (2) NO. W/H | (3) WORK CLASS | (4) DAY AND DATE | (5) TOTAL | (6) RATE | (7) GROSS | (8) DEDUCTIONS | (9) NET |
|                              | EXEMPTIONS  |                | O|S rows per day | HOURS     | O|S      | EARNED    | FICA|W/H|OTHER| WAGES   |
```

#### 4. Add Full WH-348 Statement of Compliance (Page 2)

Include:
- Date field
- Name of Signatory Party and Title
- Full legal compliance text with all 4 points
- Fringe benefits checkboxes (a) and (b)
- Exceptions table
- Remarks section
- Name/Title and Signature fields
- Legal warning about falsification

### Files to Modify

| File | Changes |
|------|---------|
| `src/utils/wh347ExportUtils.ts` | Major rewrite of PDF layout to match official form |
| `src/components/time-tracking/WH347ExportDialog.tsx` | Add withholding exemptions input, contractor/subcontractor toggle |

### UI Preview (Updated Dialog)

Add a new field in the export dialog:

```text
+--------------------------------------------------+
| Export WH-347 Certified Payroll                  |
+--------------------------------------------------+
| ○ Contractor  ○ Subcontractor                    |
|                                                  |
| Payroll Number: *          Week Period:          |
| [   1   ]                  Feb 2 - Feb 8, 2026   |
|                                                  |
| Personnel & Work Classifications                 |
| ┌──────────────────────────────────────────────┐ |
| │ ☑ John Doe        [Electrician ▼]  W/H: [2] │ |
| │ ☑ Jane Smith      [Laborer     ▼]  W/H: [1] │ |
| └──────────────────────────────────────────────┘ |
+--------------------------------------------------+
```

### Technical Details

**PDF Layout Changes:**
- Portrait orientation (8.5" x 11")
- Smaller row heights to fit 8 personnel per page
- Each employee row has two sub-rows: O (overtime) and S (straight time)
- Column widths adjusted for portrait format
- Second page for WH-348 Statement of Compliance

**Calculation Changes:**
- Daily hours split into straight (S) and overtime (O) based on cumulative weekly threshold
- First 40 hours are straight time, hours beyond are overtime
- Both rates displayed: straight rate and OT rate (1.5x multiplier)

