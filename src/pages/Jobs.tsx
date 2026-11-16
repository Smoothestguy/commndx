import { useEventLocationIndex } from "@/hooks/useProjectEvent";
import { eventCustomers } from "@/lib/projectEvent";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectStats } from "@/components/projects/ProjectStats";
import { ProjectEmptyState } from "@/components/projects/ProjectEmptyState";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { Skeleton } from "@/components/ui/skeleton";
import { getCustomerDisplayName } from "@/utils/customerDisplayName";

export default function Jobs() {
  const navigate = useNavigate();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: customers } = useCustomers();
  const locations = useEventLocationIndex();

  return (
    <PageLayout title="Jobs">
      <div className="space-y-6">
        {projectsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : projects && projects.length > 0 ? (
          <>
            <ProjectStats projects={projects} />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project, index) => {
                const names = eventCustomers((locations.data || []).filter(l => l.project_id === project.id), project.customer_id).map(r => getCustomerDisplayName(customers?.find(c => c.id === r.id))).join(", ");
                return (
                  <ProjectCard 
                    key={project.id} 
                    project={project}
                    customerName={names}
                    onEdit={() => navigate(`/projects/${project.id}`)}
                    onDelete={() => {}}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    index={index}
                  />
                );
              })}
            </div>
          </>
        ) : (
          <ProjectEmptyState 
            hasFilters={false}
            onAddProject={() => navigate('/projects')}
            onClearFilters={() => {}}
          />
        )}
      </div>
    </PageLayout>
  );
}
