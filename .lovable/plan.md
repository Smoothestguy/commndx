

# Use Official WH-347 Fillable PDF Template

## Overview

You've uploaded the official DOL WH-347/WH-348 fillable PDF form. Instead of generating a custom PDF layout with jsPDF (current approach), we'll use **pdf-lib** to fill in the actual fields of your official template - the same approach used for W-9 and 1099-NEC forms.

## Current vs Proposed Approach

| Aspect | Current (jsPDF) | Proposed (pdf-lib + Template) |
|--------|-----------------|-------------------------------|
| Layout | Custom-drawn boxes and text | Official DOL form layout |
| Compliance | Approximate match | Exact official form |
| Method | Generate from scratch | Fill existing PDF fields |
| Template Storage | None needed | `form-templates` bucket |

## Implementation Steps

### Step 1: Upload Template to Storage

Copy the uploaded PDF to the `form-templates` storage bucket:
- Source: `user-uploads://WH-347-348-PayrollForm-StatmentComp-2.pdf`
- Destination: `form-templates/wh-347-348-fillable.pdf`

### Step 2: Create Edge Function for WH-347 Generation

Add a new handler to the `generate-pdf` edge function (or create a dedicated function) that:
1. Downloads the template from storage
2. Uses `pdf-lib` to fill in the form fields
3. Returns the filled PDF

### Step 3: Update Export Flow

Modify `WH347ExportDialog.tsx` to call the backend function instead of the client-side jsPDF generator.

## Technical Details

### Edge Function: WH-347 Handler

```typescript
// Add to supabase/functions/generate-pdf/index.ts

interface WH347FormData {
  // Header info
  contractorName: string;
  contractorAddress: string;
  isSubcontractor: boolean;
  payrollNumber: string;
  weekEnding: string;
  projectName: string;
  projectLocation: string;
  contractNumber: string;
  
  // Employee rows (up to 8 per page)
  employees: Array<{
    name: string;
    address: string;
    ssnLastFour: string;
    withholdingExemptions: number;
    workClassification: string;
    dailyHours: { straight: number; overtime: number }[];
    totalHours: { straight: number; overtime: number };
    rateOfPay: { straight: number; overtime: number };
    grossEarned: number;
    deductions: { fica: number; withholding: number; other: number };
    totalDeductions: number;
    netWages: number;
  }>;
  
  // Page 2: Statement of Compliance
  signatory: {
    name: string;
    title: string;
    date: string;
  };
  fringeBenefits: {
    paidToPlans: boolean;
    paidInCash: boolean;
  };
}
```

### Field Mapping Process

1. Log all available field names from the template
2. Map data to the correct PDF field names
3. Fill text fields and check appropriate checkboxes
4. Handle multiple employee rows with indexed field names
5. Flatten the form for final output

### Updated Client-Side Export

```typescript
// In WH347ExportDialog.tsx
const handleGenerate = async () => {
  const response = await supabase.functions.invoke('generate-pdf', {
    body: { 
      type: 'wh-347', 
      formData: exportData 
    }
  });
  
  if (response.data) {
    // Download the generated PDF
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `WH-347_${projectName}_${weekEnding}.pdf`;
    link.click();
  }
};
```

## Files to Modify/Create

| File | Action |
|------|--------|
| `form-templates/wh-347-348-fillable.pdf` | Upload template to storage |
| `supabase/functions/generate-pdf/index.ts` | Add WH-347 handler |
| `src/components/time-tracking/WH347ExportDialog.tsx` | Use edge function |
| `src/utils/wh347ExportUtils.ts` | Keep for data organization, remove PDF generation |

## Benefits

- Uses the exact official DOL form layout
- Ensures compliance with certified payroll requirements
- Consistent approach with W-9 and 1099-NEC generation
- Template can be updated without code changes

