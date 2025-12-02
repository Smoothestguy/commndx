import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PersonnelForm } from "@/components/personnel/PersonnelForm";
import { useBulkAssignPersonnelToProject } from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

interface QuickAddPersonnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  projectName?: string;
  onSuccess?: () => void;
}

export function QuickAddPersonnelDialog({ 
  open, 
  onOpenChange, 
  projectId,
  projectName,
  onSuccess 
}: QuickAddPersonnelDialogProps) {
  const queryClient = useQueryClient();
  const assignToProject = useBulkAssignPersonnelToProject();

  const handleSuccess = async (newPersonnelId?: string) => {
    if (projectId && newPersonnelId) {
      try {
        await assignToProject.mutateAsync({
          personnelIds: [newPersonnelId],
          projectId,
        });
        toast.success(`Personnel added and assigned to ${projectName || "project"}`);
      } catch (error) {
        toast.error("Personnel added but failed to assign to project");
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["personnel-by-project"] });
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add New Personnel
          </DialogTitle>
          {projectId && (
            <p className="text-sm text-muted-foreground">
              Will be automatically assigned to: <span className="font-medium">{projectName}</span>
            </p>
          )}
        </DialogHeader>
        
        <PersonnelForm 
          onSuccess={handleSuccess}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
