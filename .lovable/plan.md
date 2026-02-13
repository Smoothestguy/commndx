

## Fix CSV Import - Debug and Robustify Parsing

### Root Cause Analysis
The import function has a logic flow issue with this specific CSV format. The CSV has:
- Row 1: all empty (commas only)
- Row 2: some numbers scattered
- Row 3: actual headers ("Unit No.", "Carpet", etc.)
- Row 4: empty
- Rows 5+: unit data

The XLSX library's `sheet_to_json()` with defaults uses row 1 as headers (all empty), producing objects with `__EMPTY_X` keys. The standard mapping correctly produces 0 valid units, and the fallback smart detection should run. However, there may be subtle issues with how XLSX handles sparse CSV rows in the raw array mode that prevent proper detection.

### Fix Strategy
Improve the `handleImportCSV` function in `ProjectUnitsSection.tsx` with:

1. **Add console logging** at each stage for debugging
2. **Always try smart detection** regardless of standard parsing results -- run it first since the standard approach is too fragile for non-standard layouts
3. **More robust cell checking** -- handle cases where XLSX returns `undefined` for empty cells in sparse arrays by using optional chaining
4. **Better number detection** -- the current `isNaN(Number(unitNum))` check may fail if the unit number has whitespace or is parsed as a number by XLSX (already a number type, not a string)

### Changes to `src/components/project-hub/ProjectUnitsSection.tsx`

Rewrite the `handleImportCSV` function to:

1. **Try smart detection FIRST** (scan raw arrays for "Unit No." header)
2. **Fall back to standard parsing** only if smart detection finds nothing
3. Add robust type coercion: `String(row[colMap.unit_number] ?? "")` instead of `String(row[colMap.unit_number] || "")`
4. Use `Number.isFinite(Number(unitNum))` instead of `!isNaN(Number(unitNum))` for more reliable number checking (rejects empty strings and NaN)
5. Add a `console.log` for debugging that shows the parsed units before inserting
6. Ensure the toast messages fire correctly

### Technical Details

```typescript
const handleImportCSV = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    let unitsToAdd = [];

    // Step 1: Try smart detection first (raw arrays)
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    let headerRowIdx = -1;
    const colMap = {};

    for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
      const row = rawRows[i];
      if (!Array.isArray(row)) continue;
      for (let j = 0; j < row.length; j++) {
        const cellVal = String(row[j] ?? "").toLowerCase().trim();
        if (cellVal.includes("unit no")) {
          headerRowIdx = i;
          colMap.unit_number = j;
          // Map remaining columns from this header row
          row.forEach((cell, idx) => {
            const label = String(cell ?? "").toLowerCase().trim();
            // ... same column mapping logic
          });
          break;
        }
      }
      if (headerRowIdx >= 0) break;
    }

    if (headerRowIdx >= 0 && colMap.unit_number !== undefined) {
      for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!Array.isArray(row)) continue;
        const rawVal = row[colMap.unit_number];
        const unitNum = String(rawVal ?? "").trim();
        if (!unitNum || !Number.isFinite(Number(unitNum))) continue;
        // ... build unit object
      }
    }

    // Step 2: Fall back to standard parsing if smart detection found nothing
    if (unitsToAdd.length === 0) {
      const rows = XLSX.utils.sheet_to_json(sheet);
      unitsToAdd = rows.map(row => ({
        unit_number: String(
          row["Unit Number"] || row["unit_number"] || row["Unit"] || 
          row["Room"] || row["Unit No."] || row["Unit No"] || ""
        ).trim(),
        // ... other fields
      })).filter(u => u.unit_number);
    }

    if (unitsToAdd.length === 0) {
      toast.error("No valid units found...");
      return;
    }

    const floors = [...new Set(unitsToAdd.map(u => u.floor).filter(Boolean))];
    toast.info(`Found ${unitsToAdd.length} units across ${floors.length} floor(s). Importing...`);
    
    await bulkAdd.mutateAsync({ project_id: projectId, units: unitsToAdd });
  } catch (error) {
    toast.error(`Import failed: ${error.message}`);
  }
  e.target.value = "";
};
```

Key improvements:
- Smart detection runs FIRST, not as a fallback
- Added `"Unit No."` and `"Unit No"` to the standard key checks
- Using `?? ""` instead of `|| ""` for null/undefined coercion
- Using `Number.isFinite()` for more reliable numeric checks
- Scanning 15 rows instead of 10 for header detection
- Using `Array.isArray(row)` guard for sparse data
- Always showing the info toast with count before importing

### Files to Modify

| File | Action |
|------|--------|
| `src/components/project-hub/ProjectUnitsSection.tsx` | Modify - fix import parsing order and robustness |

