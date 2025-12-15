import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchInput } from "@/components/ui/search-input";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useBulkAssignUserToProjects } from "@/integrations/supabase/hooks/useProjectAssignments";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AssignUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignUserDialog({ open, onOpenChange }: AssignUserDialogProps) {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: projects = [] } = useProjects();
  const { mutate: bulkAssign, isPending } = useBulkAssignUserToProjects();

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

  // Filter projects by search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter(project => 
      project.name?.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  const handleProjectToggle = (projectId: string) => {
    setSelectedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleSelectAll = () => {
    setSelectedProjects(filteredProjects.map(p => p.id));
  };

  const handleClearAll = () => {
    setSelectedProjects([]);
  };

  const handleSubmit = () => {
    if (!selectedUser || selectedProjects.length === 0) return;

    bulkAssign(
      {
        userId: selectedUser,
        projectIds: selectedProjects,
      },
      {
        onSuccess: () => {
          setSelectedUser("");
          setSelectedProjects([]);
          setSearchQuery("");
          onOpenChange(false);
        },
      }
    );
  };

  const handleClose = () => {
    setSelectedUser("");
    setSelectedProjects([]);
    setSearchQuery("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Projects to User</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* User Selection */}
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

          {/* Project Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Projects ({selectedProjects.length} selected)</Label>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSelectAll}
                  className="text-xs h-7"
                >
                  Select All
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleClearAll}
                  className="text-xs h-7"
                >
                  Clear
                </Button>
              </div>
            </div>
            
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search projects..."
              className="mb-2"
            />

            <ScrollArea className="h-[200px] border rounded-md p-2">
              <div className="space-y-1">
                {filteredProjects.map((project) => (
                  <label
                    key={project.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedProjects.includes(project.id)}
                      onCheckedChange={() => handleProjectToggle(project.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {project.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {project.status}
                      </p>
                    </div>
                  </label>
                ))}
                {filteredProjects.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No projects found
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedUser || selectedProjects.length === 0 || isPending}
          >
            {isPending ? "Assigning..." : `Assign to ${selectedProjects.length} Project${selectedProjects.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
