import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchInput } from "@/components/ui/search-input";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useBulkAssignToProject } from "@/integrations/supabase/hooks/useProjectAssignments";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AssignUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignUserDialog({ open, onOpenChange }: AssignUserDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: projects = [] } = useProjects();
  const { mutate: bulkAssign, isPending } = useBulkAssignToProject();

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

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(user => 
      user.first_name?.toLowerCase().includes(query) ||
      user.last_name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    setSelectedUsers(filteredUsers.map(u => u.id));
  };

  const handleClearAll = () => {
    setSelectedUsers([]);
  };

  const handleSubmit = () => {
    if (selectedUsers.length === 0 || !selectedProject) return;

    bulkAssign(
      {
        userIds: selectedUsers,
        projectId: selectedProject,
      },
      {
        onSuccess: () => {
          setSelectedUsers([]);
          setSelectedProject("");
          setSearchQuery("");
          onOpenChange(false);
        },
      }
    );
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setSelectedProject("");
    setSearchQuery("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Users to Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Project Selection */}
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

          {/* User Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Users ({selectedUsers.length} selected)</Label>
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
              placeholder="Search users..."
              className="mb-2"
            />

            <ScrollArea className="h-[200px] border rounded-md p-2">
              <div className="space-y-1">
                {filteredUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={() => handleUserToggle(user.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </label>
                ))}
                {filteredUsers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No users found
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
            disabled={selectedUsers.length === 0 || !selectedProject || isPending}
          >
            {isPending ? "Assigning..." : `Assign ${selectedUsers.length} User${selectedUsers.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
