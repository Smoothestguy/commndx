import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useProjectsByCustomer } from "@/integrations/supabase/hooks/useProjects";

interface ConvertToJobOrderDialogProps {
  trigger: React.ReactNode;
  customerId: string;
  estimateProjectId?: string;
  estimateProjectName?: string;
  isPending: boolean;
  onConvert: (projectId: string, projectName: string) => void;
}

export function ConvertToJobOrderDialog({
  trigger,
  customerId,
  estimateProjectId,
  estimateProjectName,
  isPending,
  onConvert,
}: ConvertToJobOrderDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(estimateProjectId || "");
  const { data: projects, isLoading: projectsLoading } = useProjectsByCustomer(customerId);

  const hasExistingProject = !!estimateProjectId;
  
  const handleConvert = () => {
    if (hasExistingProject) {
      onConvert(estimateProjectId!, estimateProjectName!);
    } else {
      const selectedProject = projects?.find(p => p.id === selectedProjectId);
      if (selectedProject) {
        onConvert(selectedProject.id, selectedProject.name);
      }
    }
    setOpen(false);
  };

  const canConvert = hasExistingProject || selectedProjectId;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert to Job Order</DialogTitle>
          <DialogDescription>
            {hasExistingProject
              ? "This will create a new job order from this estimate, copying all line items and customer information. Continue?"
              : "Select a project for this job order. All line items and customer information will be copied."}
          </DialogDescription>
        </DialogHeader>

        {!hasExistingProject && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project">Project *</Label>
              {projectsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading projects...
                </div>
              ) : projects && projects.length > 0 ? (
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
              ) : (
                <p className="text-sm text-muted-foreground">
                  No projects found for this customer. Please create a project first.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={!canConvert || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
