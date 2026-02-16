import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useProjectRooms, useRoomScopeSummary, useDeleteRoom } from "@/integrations/supabase/hooks/useProjectRooms";
import { RoomScopeSummaryCards } from "./RoomScopeSummaryCards";
import { RoomsDataTable } from "./RoomsDataTable";
import { AddRoomDialog } from "./AddRoomDialog";
import { ImportRoomsDialog } from "./ImportRoomsDialog";
import { Plus, Upload, Home } from "lucide-react";

interface ProjectRoomsSectionProps {
  projectId: string;
}

export function ProjectRoomsSection({ projectId }: ProjectRoomsSectionProps) {
  const { data: rooms, isLoading: roomsLoading } = useProjectRooms(projectId);
  const { data: summaryItems, isLoading: summaryLoading } = useRoomScopeSummary(projectId);
  const deleteRoom = useDeleteRoom();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const handleDeleteRoom = (roomId: string) => {
    if (!confirm('Delete this room and all its scope items?')) return;
    deleteRoom.mutate({ id: roomId, projectId });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5 text-primary" />
          <h3 className="font-heading text-lg font-semibold">
            Rooms / Units ({rooms?.length || 0})
          </h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import Rooms
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Room
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <RoomScopeSummaryCards
        summaryItems={summaryItems || []}
        isLoading={summaryLoading}
      />

      {/* Rooms Table */}
      {roomsLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading rooms...
          </CardContent>
        </Card>
      ) : (
        <RoomsDataTable
          rooms={rooms || []}
          summaryItems={summaryItems || []}
          onDeleteRoom={handleDeleteRoom}
          isDeleting={deleteRoom.isPending}
          projectId={projectId}
        />
      )}

      {/* Dialogs */}
      <AddRoomDialog open={isAddOpen} onOpenChange={setIsAddOpen} projectId={projectId} />
      <ImportRoomsDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        projectId={projectId}
        summaryItems={summaryItems || []}
      />
    </div>
  );
}
