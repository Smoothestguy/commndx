import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Calendar, User, ChevronRight, Users } from "lucide-react";
import { format } from "date-fns";
import { Project, ProjectStage } from "@/integrations/supabase/hooks/useProjects";

interface ProjectCardProps {
  project: Project;
  customerName: string;
  assignmentCount?: number;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
  index?: number; // Made optional - no longer used for staggered animations
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
  assignmentCount = 0,
  onEdit, 
  onDelete, 
  onClick,
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
      onClick={onClick}
    >
      {/* Header: Name & Badges */}
      <div className="flex items-start justify-between gap-2 mb-1.5 min-w-0">
        <h3 className="font-heading text-sm sm:text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1 min-w-0 flex-1">
          {project.name}
        </h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Badge variant={stage.variant} className={`text-[9px] sm:text-xs px-1.5 py-0 sm:px-2 sm:py-0.5 ${stage.className}`}>
            {stage.label}
          </Badge>
          <StatusBadge status={project.status} className="text-[9px] sm:text-xs" />
        </div>
      </div>

      {/* Customer, Team & Date - Compact Row */}
      <div className="flex items-center justify-between gap-2 text-[11px] sm:text-sm text-muted-foreground min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <User className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="truncate">{customerName}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>{assignmentCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>{format(new Date(project.start_date), "MMM dd")}</span>
          </div>
        </div>
      </div>

      {/* Chevron indicator - hidden on mobile */}
      <div className="hidden sm:flex items-center justify-end mt-2 pt-2 border-t border-border/30">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
          <span>View details</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}

export { stageConfig };
