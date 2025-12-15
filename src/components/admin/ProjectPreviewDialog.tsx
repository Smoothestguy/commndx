import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Calendar, MapPin, User, Clock } from "lucide-react";

interface Project {
  id: string;
  name: string;
  status: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  customer_name?: string;
}

interface ProjectPreviewDialogProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  assignedAt?: string;
}

export function ProjectPreviewDialog({ project, open, onClose, assignedAt }: ProjectPreviewDialogProps) {
  if (!project) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "in_progress":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "completed":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "on_hold":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "cancelled":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {project.name}
          </DialogTitle>
          <DialogDescription>
            Project assignment details
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getStatusColor(project.status)}>
              {project.status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
            </Badge>
          </div>

          <div className="space-y-3">
            {assignedAt && (
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Assigned:</span>{" "}
                  <span className="font-medium">{format(parseISO(assignedAt), "MMM d, yyyy")}</span>
                </div>
              </div>
            )}

            {project.customer_name && (
              <div className="flex items-center gap-3 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Customer:</span>{" "}
                  <span className="font-medium">{project.customer_name}</span>
                </div>
              </div>
            )}

            {project.location && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Location:</span>{" "}
                  <span className="font-medium">{project.location}</span>
                </div>
              </div>
            )}

            {(project.start_date || project.end_date) && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Duration:</span>{" "}
                  <span className="font-medium">
                    {project.start_date && format(parseISO(project.start_date), "MMM d, yyyy")}
                    {project.start_date && project.end_date && " - "}
                    {project.end_date && format(parseISO(project.end_date), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
