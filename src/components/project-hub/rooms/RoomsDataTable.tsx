import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectRoom, RoomScopeSummaryItem } from "@/integrations/supabase/hooks/useProjectRooms";
import { useState } from "react";

interface RoomsDataTableProps {
  rooms: ProjectRoom[];
  summaryItems: RoomScopeSummaryItem[];
  onDeleteRoom: (id: string) => void;
  isDeleting: boolean;
  projectId: string;
}

// Scope columns in display order
const SCOPE_COLUMNS = [
  { key: 'carpet', label: 'Carpet', code: 'H-CP-01' },
  { key: 'floor_tile', label: 'Floor Tile', code: 'H-ST-01.F' },
  { key: 'shower_floor', label: 'Shr Floor', code: 'H-ST-01.SF' },
  { key: 'shower_wall', label: 'Shr Wall', code: 'H-ST-01.SW' },
  { key: 'trim_top', label: 'Trim Top', code: 'H-TL-002' },
  { key: 'trim_side', label: 'Trim Side', code: 'H-TL-003' },
  { key: 'bath_threshold', label: 'Bath Thr', code: 'H-TS-001' },
  { key: 'entry_threshold', label: 'Entry Thr', code: 'H-TS-002' },
  { key: 'shower_curbs', label: 'Curbs', code: 'Curb' },
];

function getScopeValue(room: ProjectRoom, scopeCode: string): number {
  if (!room.room_scope_items) return 0;
  const item = room.room_scope_items.find(si => {
    const code = (si.scope_code || '').toLowerCase();
    const desc = (si.scope_description || '').toLowerCase();
    const key = scopeCode.toLowerCase();
    return code.includes(key) || desc.includes(key);
  });
  return item ? Number(item.allocated_quantity) : 0;
}

// Match scope items by JO line item description
function getScopeValueByLineItem(room: ProjectRoom, summaryItems: RoomScopeSummaryItem[], scopeCode: string): number {
  if (!room.room_scope_items) return 0;
  
  // Find matching summary item by code
  const matchingLI = summaryItems.find(si => {
    const desc = si.description.toLowerCase();
    const code = scopeCode.toLowerCase();
    return desc.includes(code);
  });
  
  if (matchingLI) {
    const scopeItem = room.room_scope_items.find(si => si.job_order_line_item_id === matchingLI.job_order_line_item_id);
    if (scopeItem) return Number(scopeItem.allocated_quantity);
  }
  
  // Fallback to scope_code/description matching
  return getScopeValue(room, scopeCode);
}

export function RoomsDataTable({ rooms, summaryItems, onDeleteRoom, isDeleting, projectId }: RoomsDataTableProps) {
  const [expandedFloors, setExpandedFloors] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    rooms.forEach(room => initial.add(room.floor_number || 0));
    return initial;
  });

  // Group rooms by floor
  const floorGroups = rooms.reduce<Record<number, ProjectRoom[]>>((acc, room) => {
    const floor = room.floor_number || 0;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {});

  const floors = Object.keys(floorGroups).map(Number).sort((a, b) => a - b);
  const hasMultipleFloors = floors.length > 1;

  const toggleFloor = (floor: number) => {
    setExpandedFloors(prev => {
      const next = new Set(prev);
      if (next.has(floor)) next.delete(floor);
      else next.add(floor);
      return next;
    });
  };


  const renderRoomRow = (room: ProjectRoom) => (
    <TableRow key={room.id}>
      <TableCell className="font-medium">{room.unit_number}</TableCell>
      <TableCell className="text-xs">{room.shower_size || '—'}</TableCell>
      <TableCell>{room.ceiling_height || '—'}</TableCell>
      {SCOPE_COLUMNS.map(col => {
        const val = getScopeValueByLineItem(room, summaryItems, col.code);
        return (
          <TableCell key={col.key} className="text-right tabular-nums text-xs">
            {val > 0 ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
          </TableCell>
        );
      })}
      <TableCell>
        <span className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
          room.status === 'not_started' && "bg-muted text-muted-foreground",
          room.status === 'in_progress' && "bg-blue-500/10 text-blue-600 border-blue-500/20",
          room.status === 'complete' && "bg-green-500/10 text-green-600 border-green-500/20",
          room.status === 'verified' && "bg-purple-500/10 text-purple-600 border-purple-500/20",
        )}>
          {room.status.replace('_', ' ')}
        </span>
      </TableCell>
      <TableCell className="text-xs truncate max-w-[100px]">{room.notes || ''}</TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onDeleteRoom(room.id)}
          disabled={isDeleting}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[70px]">Unit</TableHead>
            <TableHead className="w-[90px]">Shower</TableHead>
            <TableHead className="w-[50px]">Ht</TableHead>
            {SCOPE_COLUMNS.map(col => (
              <TableHead key={col.key} className="text-right text-xs w-[70px]">{col.label}</TableHead>
            ))}
            <TableHead className="w-[90px]">Status</TableHead>
            <TableHead className="w-[100px]">Notes</TableHead>
            <TableHead className="w-[40px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rooms.length === 0 ? (
            <TableRow>
              <TableCell colSpan={SCOPE_COLUMNS.length + 6} className="text-center py-8 text-muted-foreground">
                No rooms yet. Import rooms or add manually.
              </TableCell>
            </TableRow>
          ) : hasMultipleFloors ? (
            floors.map(floor => (
              <>
                <TableRow
                  key={`floor-${floor}`}
                  className="bg-muted/50 cursor-pointer hover:bg-muted"
                  onClick={() => toggleFloor(floor)}
                >
                  <TableCell colSpan={SCOPE_COLUMNS.length + 6}>
                    <div className="flex items-center gap-2 font-medium text-sm">
                      {expandedFloors.has(floor) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      Floor {floor} ({floorGroups[floor].length} units)
                    </div>
                  </TableCell>
                </TableRow>
                {expandedFloors.has(floor) && floorGroups[floor].map(renderRoomRow)}
              </>
            ))
          ) : (
            rooms.map(renderRoomRow)
          )}
        </TableBody>
      </Table>
    </div>
  );
}
