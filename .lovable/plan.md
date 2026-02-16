

## Room/Unit Tracking System - Full UI Build

### Current State
- Database tables `project_rooms` and `room_scope_items` already exist with proper RLS policies and a validation trigger (`validate_room_scope_allocation`) that prevents over-allocation
- Tables are missing `shower_size` (text) and `ceiling_height` (integer) columns on `project_rooms`
- No UI components exist -- this is a full frontend build with one schema migration

### Plan

#### 1. Database Migration
Add missing columns to `project_rooms`:
- `shower_size` (text, nullable) -- e.g. "4.6x2.10"
- `ceiling_height` (integer, nullable) -- e.g. 8 or 9

#### 2. Backend Function: `extract-room-units`
New edge function similar to `extract-work-order-items` that accepts a CSV/Excel file (base64) or PDF/image and uses AI to extract room/unit data. Returns structured data with unit numbers, shower sizes, ceiling heights, and scope quantities. Detects and skips totals rows. Extracts special notes (Double Curb, ADA) into a notes field.

#### 3. React Hooks: `useProjectRooms`
New hook file at `src/integrations/supabase/hooks/useProjectRooms.ts`:
- `useProjectRooms(projectId)` -- fetch rooms with their scope items
- `useAddRoom` -- single room creation
- `useBulkImportRooms` -- batch create rooms + scope items in a transaction
- `useUpdateRoom` -- update room details/status
- `useDeleteRoom` -- delete room and its scope items
- `useRoomScopeSummary(projectId)` -- aggregated totals per JO line item (total, allocated, remaining)

#### 4. UI Components

**`src/components/project-hub/rooms/`** directory:

| Component | Purpose |
|-----------|---------|
| `ProjectRoomsSection.tsx` | Main section added to ProjectDetail page. Contains summary cards + rooms table + import button |
| `RoomScopeSummaryCards.tsx` | Color-coded cards showing Total / Allocated / Remaining per scope item (green/yellow/red) |
| `RoomsDataTable.tsx` | Dense table with columns: Unit No., Shower Size, Ceiling Ht, scope quantities (Carpet, Floor Tile, etc.), Status, Contractor, Actions |
| `RoomDetailPane.tsx` | Slide-out or expandable detail showing all scope items with quantities and status |
| `AddRoomDialog.tsx` | Manual single-room entry form |
| `ImportRoomsDialog.tsx` | Three-tab dialog (Upload Spreadsheet, Upload PDF/Image, Manual Entry) with AI extraction, preview table, and batch confirmation |
| `ImportPreviewTable.tsx` | Editable preview table shown after AI extraction -- user can review/edit before confirming |

#### 5. Integration into ProjectDetail.tsx
Add the `ProjectRoomsSection` component between the "Asset Assignments" section and "Milestones" section (around line 567). This renders the full Rooms tab-like section in the Project Hub.

#### 6. Smart Import Flow

```text
User clicks "Import Rooms"
  --> ImportRoomsDialog opens
  --> Tab 1: Upload CSV/XLSX
      - Parse client-side with xlsx library (already installed)
      - Smart header mapping: scan row 3 for keywords
      - Skip totals row (last non-empty row)
      - Detect "Double Curb", "ADA" in shower size --> store in notes
      - Show ImportPreviewTable
  --> Tab 2: Upload PDF/Image
      - Send to extract-room-units edge function
      - AI extracts table data
      - Show ImportPreviewTable
  --> Tab 3: Manual Entry
      - Blank table, add rows manually
  --> User reviews, edits, confirms
  --> Batch insert rooms + scope items
  --> Validate against JO remaining quantities
  --> Show summary toast
```

For CSV/XLSX (Tab 1), parsing happens entirely client-side using the `xlsx` package (already installed). No edge function needed. The smart mapping scans headers for keywords like "Carpet", "Floor", "Shower", "Trim", "Thresh", "Curb" and maps to the corresponding JO line items.

For PDF/Image (Tab 2), the `extract-room-units` edge function uses Gemini to read the table.

#### 7. JO Line Item Linking
When importing, the system needs to link each scope column to a `job_order_line_item_id`. The UI will:
1. Fetch all JO line items for the project's job orders
2. Auto-match by description/code (e.g. "H-CP-01" in description matches "Carpet" column)
3. Show a mapping step if auto-match fails, letting the user manually assign columns to JO line items

### Files to Create/Modify

| File | Action |
|------|--------|
| Database migration | Add `shower_size`, `ceiling_height` to `project_rooms` |
| `supabase/functions/extract-room-units/index.ts` | New edge function for PDF/image AI extraction |
| `src/integrations/supabase/hooks/useProjectRooms.ts` | New hooks for rooms CRUD + summaries |
| `src/components/project-hub/rooms/ProjectRoomsSection.tsx` | Main section component |
| `src/components/project-hub/rooms/RoomScopeSummaryCards.tsx` | Summary cards |
| `src/components/project-hub/rooms/RoomsDataTable.tsx` | Rooms table |
| `src/components/project-hub/rooms/RoomDetailPane.tsx` | Room detail view |
| `src/components/project-hub/rooms/AddRoomDialog.tsx` | Manual add form |
| `src/components/project-hub/rooms/ImportRoomsDialog.tsx` | Import dialog with tabs |
| `src/components/project-hub/rooms/ImportPreviewTable.tsx` | Editable preview table |
| `src/components/project-hub/rooms/ScopeColumnMapper.tsx` | JO line item mapping UI |
| `src/pages/ProjectDetail.tsx` | Add ProjectRoomsSection |

### Technical Notes
- The existing `validate_room_scope_allocation` trigger will enforce that allocated quantities cannot exceed JO line item quantities
- Floor numbers will be derived from unit number prefixes (2xx = Floor 2, 4xx = Floor 4, 5xx = Floor 5)
- The rooms table supports floor-based grouping in the UI via the `floor_number` column
- Summary cards will query `room_scope_items` grouped by `job_order_line_item_id` and compare against `job_order_line_items.quantity`

