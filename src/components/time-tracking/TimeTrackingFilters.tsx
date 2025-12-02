import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

  const { data: personnel = [] } = useQuery({
    queryKey: ["personnel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .order("first_name");

      if (error) throw error;
      return data;
    },
    enabled: isAdmin || isManager,
  });

  return (
    <div className="flex flex-wrap gap-4">
      <div className="min-w-[200px]">
        <Select value={projectFilter || "all"} onValueChange={onProjectChange}>
          <SelectTrigger>
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
        <div className="min-w-[200px]">
          <Select value={personnelFilter || "all"} onValueChange={onPersonnelChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Personnel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Personnel</SelectItem>
              {personnel.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.first_name && person.last_name
                    ? `${person.first_name} ${person.last_name}`
                    : person.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
