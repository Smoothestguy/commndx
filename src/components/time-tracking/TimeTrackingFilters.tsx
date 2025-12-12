import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { usePersonnel } from "@/integrations/supabase/hooks/usePersonnel";
import { useUserRole } from "@/hooks/useUserRole";

interface TimeTrackingFiltersProps {
  projectFilter?: string;
  personnelFilter?: string;
  onProjectChange: (value: string) => void;
  onPersonnelChange: (value: string) => void;
}

export function TimeTrackingFilters({
  projectFilter,
  personnelFilter,
  onProjectChange,
  onPersonnelChange,
}: TimeTrackingFiltersProps) {
  const { data: projects = [] } = useProjects();
  const { isAdmin, isManager } = useUserRole();

  // Use personnel table (source of truth) instead of profiles
  const { data: personnel = [] } = usePersonnel({ status: "active" });

  return (
    <div className="w-full max-w-full overflow-hidden grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:gap-4">
      <div className="w-full sm:w-auto sm:min-w-[200px]">
        <Select value={projectFilter || "all"} onValueChange={onProjectChange}>
          <SelectTrigger className="w-full truncate">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(isAdmin || isManager) && (
        <div className="w-full sm:w-auto sm:min-w-[200px]">
          <Select value={personnelFilter || "all"} onValueChange={onPersonnelChange}>
            <SelectTrigger className="w-full truncate">
              <SelectValue placeholder="All Personnel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Personnel</SelectItem>
              {personnel.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {`${person.first_name} ${person.last_name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
