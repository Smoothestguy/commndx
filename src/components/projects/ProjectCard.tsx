import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Calendar, User, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Project, ProjectStage } from "@/integrations/supabase/hooks/useProjects";

interface ProjectCardProps {
  project: Project;
  customerName: string;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
  index: number;
}

const stageConfig: Record<ProjectStage, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className: string }> = {
  quote: { label: "Quote", variant: "outline", className: "border-blue-500/50 text-blue-600 dark:text-blue-400" },
  task_order: { label: "Task Order", variant: "outline", className: "border-purple-500/50 text-purple-600 dark:text-purple-400" },
  active: { label: "Active", variant: "outline", className: "border-success/50 text-success" },
  complete: { label: "Complete", variant: "outline", className: "border-primary/50 text-primary" },
  canceled: { label: "Canceled", variant: "outline", className: "border-destructive/50 text-destructive" },
};

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

  const stage = stageConfig[project.stage] || stageConfig.quote;

  return (
    <div
      className={`glass rounded-xl p-3 sm:p-4 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 cursor-pointer group animate-fade-in border-l-4 ${statusColorMap[project.status]} min-w-0 overflow-hidden`}
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={onClick}
    >
      {/* Header: Name & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3 min-w-0">
        <h3 className="font-heading text-base sm:text-lg font-semibold text-foreground group-hover:text-primary transition-colors truncate min-w-0">
          {project.name}
        </h3>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap flex-shrink-0">
          <Badge variant={stage.variant} className={`text-[10px] sm:text-xs ${stage.className}`}>
            {stage.label}
          </Badge>
          <StatusBadge status={project.status} />
        </div>
      </div>

      {/* Customer Info */}
      <div className="flex items-center gap-2 mb-2 text-xs sm:text-sm text-muted-foreground min-w-0">
        <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
        <span className="truncate">{customerName}</span>
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-2 mb-3 sm:mb-4 text-xs sm:text-sm text-muted-foreground min-w-0">
        <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
        <span className="truncate">
          <span className="hidden sm:inline">{format(new Date(project.start_date), "MMM dd, yyyy")}</span>
          <span className="sm:hidden">{format(new Date(project.start_date), "MMM dd")}</span>
          {project.end_date && (
            <>
              {" → "}
              <span className="hidden sm:inline">{format(new Date(project.end_date), "MMM dd, yyyy")}</span>
              <span className="sm:hidden">{format(new Date(project.end_date), "MMM dd")}</span>
            </>
          )}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-border/50">
        <div className="flex gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="h-7 sm:h-8 px-2 sm:px-3"
          >
            <Edit className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="hidden xs:inline ml-1 sm:ml-1.5">Edit</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-7 sm:h-8 px-2 sm:px-3 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="hidden xs:inline ml-1 sm:ml-1.5">Delete</span>
          </Button>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
      </div>
    </div>
  );
}

export { stageConfig };
