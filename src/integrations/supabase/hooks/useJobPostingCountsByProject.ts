import { useQuery } from "@tanstack/react-query";
import { supabase } from "../client";

/**
 * Hook to fetch job posting counts per project.
 * A project has job postings if it has task orders with associated job postings.
 */
export function useJobPostingCountsByProject(projectIds: string[]) {
  return useQuery({
    queryKey: ["job-posting-counts", projectIds],
    queryFn: async () => {
      if (!projectIds.length) return {} as Record<string, number>;

      // Get job postings linked through project_task_orders
      const { data, error } = await supabase
        .from("project_task_orders")
        .select(`
          project_id,
          job_postings:job_postings(id)
        `)
        .in("project_id", projectIds);

      if (error) throw error;

      // Count job postings per project
      const counts: Record<string, number> = {};
      
      // Initialize all project IDs with 0
      projectIds.forEach(id => {
        counts[id] = 0;
      });

      // Count actual job postings
      data?.forEach((pto: any) => {
        if (pto.project_id && pto.job_postings) {
          const postingCount = Array.isArray(pto.job_postings) 
            ? pto.job_postings.length 
            : (pto.job_postings ? 1 : 0);
          counts[pto.project_id] = (counts[pto.project_id] || 0) + postingCount;
        }
      });

      return counts;
    },
    enabled: projectIds.length > 0,
  });
}
