

## Room/Unit Tracking System for Project Hub

### Overview
Add a Room/Unit Tracking sub-module to each project that manages granular work allocations against a master Job Order budget. Rooms are created with scope items pulled from Job Order line items, and allocated quantities deduct from the remaining balance.

### Database Changes

#### 1. New Enums
- `room_status`: `not_started`, `in_progress`, `complete`, `verified`
- `room_scope_status`: `pending`, `in_progress`, `complete`, `verified`

#### 2. New Table: `project_rooms`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| project_id | uuid FK(projects) NOT NULL | |
| unit_number | text NOT NULL | e.g. '251' |
| floor_number | integer | derived from unit prefix |
| status | room_status | default 'not_started' |
| assigned_contractor_id | uuid FK(personnel) | nullable |
| assigned_vendor_id | uuid FK(vendors) | nullable |
| notes | text | |
| created_at / updated_at | timestamptz | auto-managed |

Indexes: `project_id`, `(project_id, unit_number)` unique.

#### 3. New Table: `room_scope_items`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| room_id | uuid FK(project_rooms) ON DELETE CASCADE | |
| job_order_line_item_id | uuid FK(job_order_line_items) | |
| allocated_quantity | numeric NOT NULL | validated against remaining |
| completed_quantity | numeric default 0 | |
| unit | text | e.g. 'sq ft', 'lf', 'yards' |
| status | room_scope_status default 'pending' | |
| created_at / updated_at | timestamptz | |

Index: `room_id`, `job_order_line_item_id`.

#### 4. RLS Policies
Following the existing staff-access pattern (admin/manager/user roles can access):
- SELECT, INSERT, UPDATE, DELETE for authenticated staff users on both tables
- Uses `has_role()` helper function consistent with other project-related tables

#### 5. Validation Trigger
A BEFORE INSERT/UPDATE trigger on `room_scope_items` that checks:
```
allocated_quantity <= (job_order_line_item.quantity - SUM(other allocated quantities for same line item))
```
This prevents over-allocation beyond the master Job Order balance.

### UI Components

#### 1. ProjectRoomsSection (new component in `src/components/project-hub/`)
- Renders inside ProjectDetail page after the Asset Assignments section
- **Summary Cards** at top showing per-line-item totals:
  - "Floor Tile: 9,100 total | 3,000 allocated | 6,100 remaining"
  - Color coding: Green (>20% remaining), Yellow (5-20%), Red (<5%)
- **Rooms Table** below:
  - Columns: Unit Number, Floor, Status, Assigned Contractor, Scope Summary, Actions
  - Click to expand/view detail pane with all scope items and quantities
- **"New Room" button** opens a dialog

#### 2. AddRoomDialog (new component)
- Unit number input
- Optional floor number (auto-derived from 3-digit unit prefix if applicable)
- Select scope items from master Job Order line items (multi-select with checkboxes)
- For each selected item: enter allocated quantity (shows remaining balance inline)
- Assign contractor dropdown (personnel list)
- Validates quantities against remaining balances before submission

#### 3. RoomDetailPane (new component)
- Shows all scope items with allocated/completed quantities
- Status badges per scope item
- Edit/update completed quantities
- Change room status

#### 4. BulkImportRoomsDialog (new component)
- Accepts CSV/Excel upload (using existing xlsx library)
- Expected columns: unit_number, carpet_yards, floor_tile_sqft, wall_tile_sqft, shower_floor_sqft, base_lf, thresholds
- Maps columns to matching Job Order line items by keyword matching (e.g., "carpet" -> Carpet line item, "floor tile" -> Floor Tile line item)
- Preview table before import
- Validates total allocations against remaining balances

### Data Hooks

#### `useProjectRooms.ts` (new file in `src/integrations/supabase/hooks/`)
- `useProjectRooms(projectId)` - fetch all rooms with scope items for a project
- `useAddRoom()` - create room + scope items in a transaction
- `useUpdateRoom()` - update room details
- `useDeleteRoom()` - soft or hard delete
- `useUpdateScopeItemProgress()` - update completed_quantity on scope items
- `useJobOrderRemainingQuantities(projectId)` - compute remaining quantities per JO line item

### Integration with ProjectDetail.tsx
- Add the `ProjectRoomsSection` component between Asset Assignments and Milestones sections
- Pass `projectId` and `projectJobOrders` as props
- No tabs needed -- follows the existing scrollable section pattern used by all other sub-modules

### Files to Create
| File | Purpose |
|------|---------|
| DB Migration | Create enums, tables, indexes, RLS, validation trigger |
| `src/integrations/supabase/hooks/useProjectRooms.ts` | Data hooks |
| `src/components/project-hub/ProjectRoomsSection.tsx` | Main rooms section with summary cards + table |
| `src/components/project-hub/AddRoomDialog.tsx` | New room creation dialog |
| `src/components/project-hub/RoomDetailPane.tsx` | Expandable room detail view |
| `src/components/project-hub/BulkImportRoomsDialog.tsx` | CSV/Excel import dialog |

### Files to Modify
| File | Change |
|------|--------|
| `src/pages/ProjectDetail.tsx` | Add ProjectRoomsSection between assets and milestones |

### No Existing Data Affected
All changes are additive -- new tables, new components. No modifications to existing tables or past project data.

