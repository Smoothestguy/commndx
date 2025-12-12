import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useAssignToProject } from "@/integrations/supabase/hooks/useProjectAssignments";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AssignUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignUserDialog({ open, onOpenChange }: AssignUserDialogProps) {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<string>("");

  const { data: projects = [] } = useProjects();
  const { mutate: assignUser, isPending } = useAssignToProject();

  // Fetch all users (profiles)
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .order("first_name", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = () => {
    if (!selectedUser || !selectedProject) return;

    assignUser(
      {
        user_id: selectedUser,
        project_id: selectedProject,
      },
      {
        onSuccess: () => {
          setSelectedUser("");
          setSelectedProject("");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign User to Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="user">User</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger id="user" className="w-full truncate">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id} className="truncate">
                    {user.first_name} {user.last_name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger id="project" className="w-full truncate">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id} className="truncate">
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedUser || !selectedProject || isPending}
          >
            {isPending ? "Assigning..." : "Assign"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}