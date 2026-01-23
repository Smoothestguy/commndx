import { useMemo } from "react";
import { Project } from "@/integrations/supabase/hooks/useProjects";

export type ProjectCategory = "all" | "individual" | "team";

export interface ProjectCategorization {
  individualProjects: Project[];
  teamProjects: Project[];
  counts: {
    individual: number;
    team: number;
  };
}

/**
 * Hook to categorize projects into Individual Contracts vs Team Projects.
 * 
 * Individual Contracts: Projects with exactly 1 personnel assigned AND no job postings
 * Team Projects: Projects with 2+ personnel OR projects with job postings (actively recruiting)
 * 
 * Projects with 0 personnel and no job postings are considered "unassigned" and go into Individual.
 */
export function useProjectCategorization(
  projects: Project[],
  assignmentCounts: Record<string, number> | undefined,
  jobPostingCounts: Record<string, number> | undefined
): ProjectCategorization {
  return useMemo(() => {
    const individualProjects: Project[] = [];
    const teamProjects: Project[] = [];

    projects.forEach((project) => {
      const personnelCount = assignmentCounts?.[project.id] ?? 0;
      const hasJobPostings = (jobPostingCounts?.[project.id] ?? 0) > 0;

      // Team: 2+ personnel OR has job postings (recruiting)
      if (personnelCount >= 2 || hasJobPostings) {
        teamProjects.push(project);
      } else {
        // Individual: 0-1 personnel AND no job postings
        individualProjects.push(project);
      }
    });

    // Sort both arrays by updated_at descending (most recently updated first)
    individualProjects.sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    teamProjects.sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    return {
      individualProjects,
      teamProjects,
      counts: {
        individual: individualProjects.length,
        team: teamProjects.length,
      },
    };
  }, [projects, assignmentCounts, jobPostingCounts]);
}

/**
 * Filter projects by category
 */
export function filterProjectsByCategory(
  projects: Project[],
  category: ProjectCategory,
  assignmentCounts: Record<string, number> | undefined,
  jobPostingCounts: Record<string, number> | undefined
): Project[] {
  if (category === "all") return projects;

  return projects.filter((project) => {
    const personnelCount = assignmentCounts?.[project.id] ?? 0;
    const hasJobPostings = (jobPostingCounts?.[project.id] ?? 0) > 0;
    const isTeam = personnelCount >= 2 || hasJobPostings;

    return category === "team" ? isTeam : !isTeam;
  });
}
