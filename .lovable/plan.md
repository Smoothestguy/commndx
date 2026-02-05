

# Fix WH-347 Export - Use Official Fillable Template

## Problem Identified

The WH-347 export is not using the official DOL fillable PDF template because the **edge function deployment is timing out**. The new code that fills the official template has been written but never successfully deployed.

**Evidence:**
- When testing the edge function directly, it returns: `"Unknown form type: wh-347"`
- This confirms the deployed version is outdated and doesn't include the WH-347 handler
- The deployment attempts keep failing with: `"Bundle generation timed out"`

The exported PDF you uploaded is a custom jsPDF-generated layout (not the official form), likely from a previous version or cached data.

## Solution

Split the `generate-pdf` edge function into smaller, dedicated functions to avoid deployment timeouts. Create a dedicated `generate-wh347` edge function just for WH-347 generation.

### Why This Fixes the Issue

- Smaller function = faster bundling = no timeout
- Isolated functionality = easier to deploy and test
- The official fillable template is already uploaded to storage (`form-templates/wh-347-348-fillable.pdf`)

## Implementation Steps

### Step 1: Create Dedicated WH-347 Edge Function

Create a new `generate-wh347` edge function that:
1. Downloads the official template from `form-templates/wh-347-348-fillable.pdf`
2. Uses `pdf-lib` to fill the form fields
3. Returns the filled PDF

### Step 2: Update Frontend to Call New Function

Update `WH347ExportDialog.tsx` to invoke `generate-wh347` instead of `generate-pdf`.

### Step 3: Log and Map Field Names

The edge function will log all available field names from the official PDF template to ensure proper field mapping. The official DOL forms use specific field naming conventions that need to be matched.

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/generate-wh347/index.ts` | **Create** - Dedicated WH-347 function |
| `supabase/config.toml` | Update to include new function config |
| `src/components/time-tracking/WH347ExportDialog.tsx` | Update function invocation |

## Technical Details

### New Edge Function Structure

```typescript
// supabase/functions/generate-wh347/index.ts

// 1. Download template from form-templates bucket
const { data: templateData } = await supabase.storage
  .from("form-templates")
  .download("wh-347-348-fillable.pdf");

// 2. Load with pdf-lib
const pdfDoc = await PDFDocument.load(templateBytes);
const form = pdfDoc.getForm();

// 3. Log field names for mapping
const fields = form.getFields();
console.log("WH-347 Fields:", fields.map(f => f.getName()));

// 4. Fill fields based on form structure
// 5. Return filled PDF
```

### Frontend Update

```typescript
// WH347ExportDialog.tsx
const { data: pdfData, error: pdfError } = await supabase.functions.invoke(
  "generate-wh347",  // Changed from "generate-pdf"
  {
    body: { formData: formDataForBackend },
  }
);
```

## Expected Result

After implementation:
1. The export will use the **exact official DOL WH-347/WH-348 form**
2. All fields will be properly filled using the PDF's native form fields
3. The form will be compliant with Davis-Bacon requirements
4. The deployment should succeed (smaller function size)

