import { useState } from "react";
import { useProjectRooms, useJobOrderRemainingQuantities, useDeleteRoom, useUpdateRoom, ProjectRoom } from "@/integrations/supabase/hooks/useProjectRooms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DoorOpen, Plus, Upload, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { AddRoomDialog } from "./AddRoomDialog";
import { RoomDetailPane } from "./RoomDetailPane";
import { BulkImportRoomsDialog } from "./BulkImportRoomsDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Props {
  projectId: string;
}

const statusColors: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  complete: "bg-green-500/20 text-green-400 border-green-500/30",
  verified: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const statusLabels: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  complete: "Complete",
  verified: "Verified",
};

export function ProjectRoomsSection({ projectId }: Props) {
  const { data: rooms, isLoading } = useProjectRooms(projectId);
  const { data: remainingQuantities } = useJobOrderRemainingQuantities(projectId);
  const deleteRoom = useDeleteRoom();
  const updateRoom = useUpdateRoom();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);

  const getScopeSummary = (room: ProjectRoom) => {
    if (!room.room_scope_items || room.room_scope_items.length === 0) return "No scope items";
    return room.room_scope_items
      .map((si) => {
        const desc = si.job_order_line_item?.description || "Item";
        return `${si.allocated_quantity} ${si.unit || ""} ${desc}`.trim();
      })
      .join(", ");
  };

  const getQuantityColor = (remaining: number, total: number) => {
    if (total === 0) return "text-muted-foreground";
    const pct = remaining / total;
    if (pct > 0.2) return "text-green-400";
    if (pct > 0.05) return "text-yellow-400";
    return "text-red-400";
  };

  const getQuantityBgColor = (remaining: number, total: number) => {
    if (total === 0) return "border-border";
    const pct = remaining / total;
    if (pct > 0.2) return "border-green-500/30";
    if (pct > 0.05) return "border-yellow-500/30";
    return "border-red-500/30";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DoorOpen className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Rooms / Units</h3>
          {rooms && <Badge variant="secondary">{rooms.length}</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsBulkImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Import
          </Button>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Room
          </Button>
        </div>
      </div>

      {/* Quantity Summary Cards */}
      {remainingQuantities && remainingQuantities.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-4">
          {remainingQuantities.map((rq) => (
            <Card key={rq.line_item_id} className={`border ${getQuantityBgColor(rq.remaining_quantity, rq.total_quantity)}`}>
              <CardContent className="p-3">
                <p className="text-xs font-medium text-muted-foreground truncate">{rq.description}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-sm font-bold">{rq.total_quantity.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">total</span>
                </div>
                <div className="flex gap-3 mt-1 text-xs">
                  <span>{rq.allocated_quantity.toLocaleString()} allocated</span>
                  <span className={`font-semibold ${getQuantityColor(rq.remaining_quantity, rq.total_quantity)}`}>
                    {rq.remaining_quantity.toLocaleString()} remaining
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Rooms Table */}
      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Loading rooms...</CardContent></Card>
      ) : !rooms || rooms.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No rooms added yet. Click "New Room" to get started.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Unit #</TableHead>
                <TableHead>Floor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contractor</TableHead>
                <TableHead>Scope Summary</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room: ProjectRoom) => (
                <>
                  <TableRow
                    key={room.id}
                    className="cursor-pointer"
                    onClick={() => setExpandedRoomId(expandedRoomId === room.id ? null : room.id)}
                  >
                    <TableCell>
                      {expandedRoomId === room.id ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{room.unit_number}</TableCell>
                    <TableCell>{room.floor_number ?? "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={room.status}
                        onValueChange={(val) => {
                          updateRoom.mutate({
                            id: room.id,
                            project_id: projectId,
                            status: val as any,
                          });
                        }}
                      >
                        <SelectTrigger className="h-7 w-[130px]" onClick={(e) => e.stopPropagation()}>
                          <Badge className={`${statusColors[room.status]} text-xs`}>
                            {statusLabels[room.status]}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusLabels).map(([val, label]) => (
                            <SelectItem key={val} value={val}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {room.contractor
                        ? `${room.contractor.first_name} ${room.contractor.last_name}`
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {getScopeSummary(room)}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Room {room.unit_number}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will delete the room and all its scope item allocations. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteRoom.mutate({ id: room.id, project_id: projectId })}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                  {expandedRoomId === room.id && (
                    <TableRow key={`${room.id}-detail`}>
                      <TableCell colSpan={7} className="p-0">
                        <RoomDetailPane room={room} projectId={projectId} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <AddRoomDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        projectId={projectId}
      />

      <BulkImportRoomsDialog
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        projectId={projectId}
      />
    </div>
  );
}
