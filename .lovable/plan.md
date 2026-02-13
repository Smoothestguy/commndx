

## Fix CSV/Excel Import for Driskill Hotel Unit Data

### Problem
The current import expects columns named "Unit Number", "Unit", or "Room" in a standard flat CSV. The actual file has:
- Headers on row 3 with names like "Unit No.", "H-CP-01 Carpet", "H-ST-01.F - (Floor)", etc.
- Data starting at row 5
- Unit number in the 4th column (index D)
- Shower size and ceiling height metadata
- 9 scope quantity columns (Carpet, Floor, Shower Floor, Shower Wall, Trim Top, Trim Side, Bath Threshold, Entry Threshold, Shower Curbs)

### Solution
Update `handleImportCSV` in `ProjectUnitsSection.tsx` to intelligently detect this file format and parse it correctly. No backend function needed -- the CSV can be parsed client-side with XLSX.

### Changes to `src/components/project-hub/ProjectUnitsSection.tsx`

Update the `handleImportCSV` function to:

1. **Try standard parsing first** (current logic) -- look for "Unit Number" / "Unit" / "Room" columns
2. **Fall back to smart detection** if standard parsing finds nothing:
   - Read raw rows using `XLSX.utils.sheet_to_json({ header: 1 })` to get arrays
   - Scan rows for a header row containing "Unit No" (case-insensitive partial match)
   - Once the header row is found, map column indices to scope categories
   - Parse subsequent data rows, extracting:
     - `unit_number` from the "Unit No." column
     - `floor` derived from unit number prefix (2xx = "2", 4xx = "4", 5xx = "5", etc.)
     - `unit_name` from shower size column (useful metadata)
   - Skip empty rows and summary/total rows
   - Create units via `bulkAdd` mutation

3. **Column mapping logic:**
   - Any header containing "Unit No" -> unit_number
   - Any header containing "Carpet" -> scope: Carpet
   - Any header containing "Shower Floor" or "S.F" -> scope: Shower Floor
   - Any header containing "Shower Wall" or "S.W" -> scope: Shower Wall
   - Any header containing "Trim Top" -> scope: Trim Top
   - Any header containing "Trim Side" -> scope: Trim Side
   - Any header containing "Bath Thresh" -> scope: Bath Threshold
   - Any header containing "Entry Thresh" -> scope: Entry Threshold
   - Any header containing "Shower Curb" or "Curbs" -> scope: Shower Curbs
   - Any header containing "Ceiling" -> ceiling_height metadata (stored in notes)
   - Any header containing "Shower Size" -> shower size metadata (stored in unit_name)

4. **Floor derivation:**
   ```
   Unit 2xx -> Floor 2
   Unit 4xx -> Floor 4
   Unit 5xx -> Floor 5
   (general: first digit of 3-digit number)
   ```

5. **Import preview:** After parsing, show a confirmation toast with the count of units found before inserting (e.g., "Found 65 units across 3 floors. Importing...").

### Technical Details

The key parsing logic:

```typescript
// Read raw arrays instead of JSON objects
const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

// Find header row by scanning for "Unit No"
let headerRowIdx = -1;
let colMap: Record<string, number> = {};
for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
  const row = rawRows[i];
  const unitColIdx = row?.findIndex((cell: any) => 
    String(cell || "").toLowerCase().includes("unit no")
  );
  if (unitColIdx >= 0) {
    headerRowIdx = i;
    // Build column index map from this header row
    row.forEach((cell: any, idx: number) => {
      const label = String(cell || "").toLowerCase();
      if (label.includes("unit no")) colMap.unit_number = idx;
      if (label.includes("carpet")) colMap.carpet = idx;
      // ... etc for each scope column
    });
    break;
  }
}

// Parse data rows after header
for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
  const row = rawRows[i];
  const unitNum = String(row[colMap.unit_number] || "").trim();
  if (!unitNum || isNaN(Number(unitNum))) continue; // skip empty/total rows
  
  const floor = unitNum.length === 3 ? unitNum[0] : undefined;
  units.push({ unit_number: unitNum, floor, ... });
}
```

### Files to Modify

| File | Action |
|------|--------|
| `src/components/project-hub/ProjectUnitsSection.tsx` | Modify - enhance `handleImportCSV` with smart format detection |

