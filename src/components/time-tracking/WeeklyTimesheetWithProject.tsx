import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { WeekCloseoutControls } from "./WeekCloseoutControls";
import { WeeklyTimesheet } from "./WeeklyTimesheet";
import { Badge } from "@/components/ui/badge";
import { FolderOpen } from "lucide-react";

interface WeeklyTimesheetWithProjectProps {
  currentWeek: Date;
  onWeekChange?: (date: Date) => void;
}

export function WeeklyTimesheetWithProject({ 
  currentWeek, 
  onWeekChange 
}: WeeklyTimesheetWithProjectProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  
  // Find the selected project to get customer_id
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const customerId = selectedProject?.customer_id;

  return (
    <div className="space-y-4">
      {/* Project Selector */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-muted-foreground shrink-0">Project:</span>
            <Select
              value={selectedProjectId || "all"}
              onValueChange={(value) => setSelectedProjectId(value === "all" ? undefined : value)}
            >
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-2">
                    All Projects
                  </span>
                </SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <span className="flex items-center gap-2">
                      {project.name}
                      <Badge variant="outline" className="text-xs">
                        {project.status}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Week Closeout Controls - only show when project is selected */}
          {selectedProjectId && (
            <div className="flex-1 flex justify-end">
              <WeekCloseoutControls
                projectId={selectedProjectId}
                customerId={customerId}
                currentWeek={currentWeek}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Weekly Timesheet */}
      <WeeklyTimesheet
        currentWeek={currentWeek}
        onWeekChange={onWeekChange}
        projectFilter={selectedProjectId}
      />
    </div>
  );
}
