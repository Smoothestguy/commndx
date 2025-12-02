import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectStats } from "@/components/projects/ProjectStats";
import { ProjectEmptyState } from "@/components/projects/ProjectEmptyState";
import { JobOrderCard } from "@/components/job-orders/JobOrderCard";
import { JobOrderStats } from "@/components/job-orders/JobOrderStats";
import { JobOrderEmptyState } from "@/components/job-orders/JobOrderEmptyState";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useJobOrders } from "@/integrations/supabase/hooks/useJobOrders";
import { Skeleton } from "@/components/ui/skeleton";

export default function Jobs() {
  const [activeTab, setActiveTab] = useState("projects");
  const navigate = useNavigate();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: jobOrders, isLoading: jobOrdersLoading } = useJobOrders();
  const { data: customers } = useCustomers();

  return (
    <PageLayout title="Jobs">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="job-orders">Job Orders</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="projects" className="mt-0 space-y-6">
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
                  const customer = customers?.find(c => c.id === project.customer_id);
                  return (
                    <ProjectCard 
                      key={project.id} 
                      project={project}
                      customerName={customer?.name || 'Unknown'}
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
        </TabsContent>

        <TabsContent value="job-orders" className="mt-0 space-y-6">
          {jobOrdersLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : jobOrders && jobOrders.length > 0 ? (
            <>
              <JobOrderStats jobOrders={jobOrders} />
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {jobOrders.map((jobOrder, index) => (
                  <JobOrderCard 
                    key={jobOrder.id} 
                    jobOrder={jobOrder}
                    onClick={() => navigate(`/job-orders/${jobOrder.id}`)}
                    index={index}
                  />
                ))}
              </div>
            </>
          ) : (
            <JobOrderEmptyState />
          )}
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
