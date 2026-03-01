

## Plan: Personnel Hotel Assignments

A separate `personnel_hotel_assignments` table is the right approach. It keeps hotel logistics cleanly separated from project assignments while linking to both the personnel and the project. This supports multiple hotel stays per person per project (common for long-duration jobs with mid-project hotel changes).

### Database Table: `personnel_hotel_assignments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `personnel_project_assignment_id` | uuid FK → personnel_project_assignments | Links to the active assignment |
| `personnel_id` | uuid FK → personnel | Direct link for easier querying |
| `project_id` | uuid FK → projects | Direct link for easier querying |
| `hotel_name` | text NOT NULL | |
| `hotel_address` | text | Full address |
| `hotel_city` | text | |
| `hotel_state` | text | |
| `hotel_zip` | text | |
| `hotel_phone` | text | |
| `room_number` | text | |
| `confirmation_number` | text | |
| `check_in` | date NOT NULL | |
| `check_out` | date | Nullable for open-ended stays |
| `nightly_rate` | numeric | Optional cost tracking |
| `notes` | text | |
| `status` | text DEFAULT 'active' | active, checked_out, cancelled |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `created_by` | uuid | |

RLS: Authenticated users with appropriate permissions can read/write.

### UI Components

**New section on the Project Hub page** (collapsible, like the existing Asset Assignments section):
- `ProjectHotelAssignmentsSection.tsx` — table/card view showing active hotel assignments for the project
- `AssignHotelDialog.tsx` — form dialog to create/edit a hotel assignment (select personnel from assigned list, enter hotel details)
- Mobile-responsive with card view on small screens, table on desktop

**New hook**: `useHotelAssignments.ts` — CRUD operations for hotel assignments

### Files to Create/Edit

| File | Change |
|------|--------|
| Migration | New `personnel_hotel_assignments` table + RLS policies |
| `src/integrations/supabase/hooks/useHotelAssignments.ts` | New — query/mutation hooks |
| `src/components/project-hub/ProjectHotelAssignmentsSection.tsx` | New — collapsible section with table/cards |
| `src/components/project-hub/AssignHotelDialog.tsx` | New — form dialog for hotel assignment |
| `src/pages/ProjectHub.tsx` | Add hotel assignments section |

