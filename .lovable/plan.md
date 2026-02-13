

## Visual Floor Plan Map for Room/Unit Tracking

### Overview
Build a visual, interactive floor plan map component that renders rooms as labeled boxes organized by floor, using the data extracted from the uploaded PDF spreadsheet. This replaces (or supplements) the current table-only view with a spatial grid layout.

### Data from PDF
The uploaded document contains **~65 rooms** across 3 floors:
- **Floor 2**: Units 251, 252
- **Floor 4**: Units 412-447
- **Floor 5**: Units 512-547

Each room has scope quantities for: Carpet, Shower Floor, Shower Wall, Trim Top, Trim Side, Bath Threshold, Entry Threshold, Shower Curbs.

### Changes

**1. New Component: `src/components/project-hub/ProjectUnitsFloorPlan.tsx`**

A visual floor plan component that:
- Groups units by floor (derived from unit number: 2xx = Floor 2, 4xx = Floor 4, 5xx = Floor 5)
- Renders each room as a clickable card/box in a responsive grid layout
- Color-codes rooms by status (gray = Not Started, blue = In Progress, green = Complete, purple = Verified)
- Shows the unit number prominently inside each box
- Clicking a room opens a detail panel/dialog showing all scope items, quantities, assigned contractors, and status
- Includes a floor selector (tabs) to switch between floors

**2. Update `src/components/project-hub/ProjectUnitsSection.tsx`**

- Add a toggle between "Table View" and "Floor Plan View" using icon buttons (List / LayoutGrid)
- Default to Floor Plan view
- Both views share the same data hooks and dialogs

**3. Auto-import PDF data**

- Enhance the existing CSV/Excel import to also parse the specific column format from this PDF (Unit No., Carpet, Shower Floor, etc.)
- Map the PDF columns to JO line item descriptions for automatic scope item creation during import

### Visual Layout

```text
+---------------------------+
| Floor 4                   |
+---------------------------+
| [412] [414] [415] [416]   |
| [418] [419] [420] [421]   |
| [422] [423] [424] [425]   |
| [426] [427] [428] [429]   |
| [430] [431] [432] [433]   |
| [435] [436] [437] [438]   |
| [439] [440] [441] [442]   |
| [444] [445] [446] [447]   |
+---------------------------+
```

Each room box shows:
- Unit number (large, centered)
- Status color indicator (border or background tint)
- Small progress indicator (e.g., "3/7 scopes done")
- Hover tooltip with scope summary

Clicking a room opens a side panel or dialog with full scope details, contractor assignments, and status controls.

### Technical Details

**Floor Plan Component structure:**
```tsx
// ProjectUnitsFloorPlan.tsx
- FloorTabs (Floor 2 | Floor 4 | Floor 5)
- Grid of RoomCard components
  - Each RoomCard: unit_number, status color, scope progress
  - onClick: opens detail dialog with scope items table
```

**Floor derivation logic:**
```typescript
const getFloor = (unitNumber: string) => {
  const num = parseInt(unitNumber);
  if (num >= 200 && num < 300) return "2";
  if (num >= 400 && num < 500) return "4";
  if (num >= 500 && num < 600) return "5";
  return "Other";
};
```

**Room card styling (status-based):**
```typescript
const statusColors = {
  not_started: "bg-muted border-border",
  in_progress: "bg-blue-500/10 border-blue-500",
  complete: "bg-green-500/10 border-green-500",
  verified: "bg-purple-500/10 border-purple-500",
};
```

**View toggle in ProjectUnitsSection:**
- Add state: `const [viewMode, setViewMode] = useState<"table" | "floorplan">("floorplan")`
- Render either the existing table or the new FloorPlan component based on toggle
- Both views share the same `useProjectUnits` data

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/project-hub/ProjectUnitsFloorPlan.tsx` | Create -- visual grid floor plan component |
| `src/components/project-hub/ProjectUnitsSection.tsx` | Modify -- add view toggle between table and floor plan |

