import { useState } from "react";
import { format } from "date-fns";
import { Calendar, Clock, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  usePersonnelSchedulesByProject,
  useCreateSchedule,
  useDeleteSchedule,
} from "@/integrations/supabase/hooks/usePersonnelSchedules";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function ScheduleManager() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Form state for new schedule
  const [newSchedule, setNewSchedule] = useState({
    personnel_id: "",
    scheduled_start_time: "08:00",
    scheduled_end_time: "17:00",
    notes: "",
  });

  const { data: projects = [] } = useProjects();
  const { data: schedules = [], isLoading } = usePersonnelSchedulesByProject(
    selectedProjectId || undefined,
    selectedDate
  );
  const createSchedule = useCreateSchedule();
  const deleteSchedule = useDeleteSchedule();

  // Get personnel list
  const { data: personnel = [] } = useQuery({
    queryKey: ["personnel-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel")
        .select("id, first_name, last_name")
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const handleCreateSchedule = async () => {
    if (!selectedProjectId || !newSchedule.personnel_id) {
      toast.error("Please select a project and personnel member");
      return;
    }

    try {
      await createSchedule.mutateAsync({
        project_id: selectedProjectId,
        personnel_id: newSchedule.personnel_id,
        scheduled_date: selectedDate,
        scheduled_start_time: newSchedule.scheduled_start_time,
        scheduled_end_time: newSchedule.scheduled_end_time || null,
        notes: newSchedule.notes || null,
      });
      setIsAddDialogOpen(false);
      setNewSchedule({
        personnel_id: "",
        scheduled_start_time: "08:00",
        scheduled_end_time: "17:00",
        notes: "",
      });
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await deleteSchedule.mutateAsync(id);
    } catch (error) {
      // Error handled by hook
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Personnel Schedules
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Label>Project</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[180px]">
            <Label>Date</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!selectedProjectId}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Schedule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Schedule</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Personnel</Label>
                    <Select
                      value={newSchedule.personnel_id}
                      onValueChange={(v) =>
                        setNewSchedule({ ...newSchedule, personnel_id: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select personnel" />
                      </SelectTrigger>
                      <SelectContent>
                        {personnel.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.first_name} {p.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={newSchedule.scheduled_start_time}
                        onChange={(e) =>
                          setNewSchedule({
                            ...newSchedule,
                            scheduled_start_time: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={newSchedule.scheduled_end_time}
                        onChange={(e) =>
                          setNewSchedule({
                            ...newSchedule,
                            scheduled_end_time: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={newSchedule.notes}
                      onChange={(e) =>
                        setNewSchedule({ ...newSchedule, notes: e.target.value })
                      }
                      placeholder="Optional notes..."
                    />
                  </div>
                  <Button
                    onClick={handleCreateSchedule}
                    disabled={createSchedule.isPending}
                    className="w-full"
                  >
                    {createSchedule.isPending ? "Creating..." : "Create Schedule"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Schedules Table */}
        {!selectedProjectId ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Select a project to view schedules</p>
          </div>
        ) : isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No schedules for this date</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personnel</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>End Time</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell>
                    <div className="font-medium">
                      {schedule.personnel?.first_name} {schedule.personnel?.last_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {schedule.scheduled_start_time?.slice(0, 5)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {schedule.scheduled_end_time ? (
                      <Badge variant="outline">
                        {schedule.scheduled_end_time?.slice(0, 5)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {schedule.notes || "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteSchedule(schedule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
