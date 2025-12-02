import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Calendar, User, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Project } from "@/integrations/supabase/hooks/useProjects";

interface ProjectCardProps {
  project: Project;
  customerName: string;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
  index: number;
}

export function ProjectCard({ 
  project, 
  customerName, 
  onEdit, 
  onDelete, 
  onClick,
  index 
}: ProjectCardProps) {
  const statusColorMap = {
    active: "border-success/30",
    completed: "border-primary/30",
    "on-hold": "border-warning/30",
  };

  return (
    <div
      className={`glass rounded-xl p-4 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 cursor-pointer group animate-fade-in border-l-4 ${statusColorMap[project.status]}`}
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={onClick}
    >
      {/* Header: Name & Status */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-heading text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
          {project.name}
        </h3>
        <StatusBadge status={project.status} />
      </div>

      {/* Customer Info */}
      <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
        <User className="h-4 w-4" />
        <span>{customerName}</span>
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span>
          {format(new Date(project.start_date), "MMM dd, yyyy")}
          {project.end_date && (
            <>
              {" → "}
              {format(new Date(project.end_date), "MMM dd, yyyy")}
            </>
          )}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="h-8 px-3"
          >
            <Edit className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-8 px-3 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </div>
  );
}
