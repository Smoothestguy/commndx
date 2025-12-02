import { CheckSquare, Calendar, User, MoreVertical, Pencil, Trash2, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, isPast, isToday } from "date-fns";
import type { Task, TaskStatus, TaskPriority } from "@/types/roofing";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (id: string) => void;
  onToggleComplete?: (task: Task) => void;
}

const statusColors: Record<TaskStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  in_progress: "bg-blue-500/10 text-blue-500",
  completed: "bg-green-500/10 text-green-500",
  cancelled: "bg-gray-500/10 text-gray-500",
};

const priorityColors: Record<TaskPriority, string> = {
  low: "bg-gray-500/10 text-gray-500",
  medium: "bg-blue-500/10 text-blue-500",
  high: "bg-orange-500/10 text-orange-500",
  urgent: "bg-red-500/10 text-red-500",
};

export function TaskCard({ task, onEdit, onDelete, onToggleComplete }: TaskCardProps) {
  const isCompleted = task.status === "completed";
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isCompleted;
  const isDueToday = task.due_date && isToday(new Date(task.due_date));

  return (
    <Card className={cn(
      "hover:shadow-md transition-shadow",
      isCompleted && "opacity-60"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={isCompleted}
            onCheckedChange={() => onToggleComplete?.(task)}
            className="mt-1"
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className={cn(
                  "font-medium",
                  isCompleted && "line-through text-muted-foreground"
                )}>
                  {task.title}
                </h3>
                {(task.customer || task.project) && (
                  <p className="text-sm text-muted-foreground">
                    {task.customer?.name}
                    {task.project && ` • ${task.project.name}`}
                  </p>
                )}
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit?.(task)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onDelete?.(task.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {task.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {task.description}
              </p>
            )}
            
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Badge variant="outline" className={priorityColors[task.priority]}>
                {task.priority}
              </Badge>
              
              <Badge variant="outline" className={statusColors[task.status]}>
                {task.status.replace("_", " ")}
              </Badge>
              
              {task.due_date && (
                <div className={cn(
                  "flex items-center gap-1 text-xs",
                  isOverdue && "text-destructive",
                  isDueToday && !isCompleted && "text-orange-500"
                )}>
                  <Calendar className="h-3 w-3" />
                  {isOverdue ? "Overdue: " : isDueToday ? "Due today" : "Due: "}
                  {!isDueToday && format(new Date(task.due_date), "MMM d")}
                </div>
              )}
              
              {task.assignee && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                  <User className="h-3 w-3" />
                  {task.assignee.first_name} {task.assignee.last_name}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
