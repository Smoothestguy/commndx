import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { EnhancedDataTable, EnhancedColumn } from "@/components/shared/EnhancedDataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Loader2, Users as UsersIcon, User } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectStats } from "@/components/projects/ProjectStats";
import { ProjectFilters } from "@/components/projects/ProjectFilters";
import { ProjectEmptyState } from "@/components/projects/ProjectEmptyState";
import { ProjectFormDialog, initialProjectFormData, type ProjectFormData } from "@/components/projects/ProjectFormDialog";
import { ProjectSection } from "@/components/projects/ProjectSection";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile";
import { useProjects, useAddProject, useUpdateProject, useDeleteProject, Project, ProjectStage } from "@/integrations/supabase/hooks/useProjects";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useAssignmentCountsByProject } from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { useJobPostingCountsByProject } from "@/integrations/supabase/hooks/useJobPostingCountsByProject";
import { useProjectCategorization, filterProjectsByCategory, ProjectCategory } from "@/hooks/useProjectCategorization";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { stageConfig } from "@/components/projects/ProjectCard";
import { getCustomerDisplayName } from "@/utils/customerDisplayName";
import { Users } from "lucide-react";

const Projects = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const { data: projects, isLoading, error, refetch, isFetching } = useProjects();
  const { data: customers } = useCustomers();
  const addProject = useAddProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  
  // Get assignment counts for all projects
  const projectIds = projects?.map(p => p.id) || [];
  const { data: assignmentCounts } = useAssignmentCountsByProject(projectIds);
  const { data: jobPostingCounts } = useJobPostingCountsByProject(projectIds);
  
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<ProjectCategory>("all");
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(initialProjectFormData);

  // Apply filters (status, stage, search)
  const baseFilteredProjects = projects
    ?.filter((p) => {
      // Search filter
      const searchMatch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        getCustomerDisplayName(customers?.find(c => c.id === p.customer_id)).toLowerCase().includes(search.toLowerCase());
      
      // Status filter
      const statusMatch = filterStatus === "all" || p.status === filterStatus;
      
      // Stage filter
      const stageMatch = filterStage === "all" || p.stage === filterStage;
      
      return searchMatch && statusMatch && stageMatch;
    }) || [];

  // Then apply category filter
  const filteredProjects = filterProjectsByCategory(
    baseFilteredProjects,
    filterCategory,
    assignmentCounts,
    jobPostingCounts
  );

  // Get categorization for grouped view (when category filter is "all")
  const categorization = useProjectCategorization(
    baseFilteredProjects,
    assignmentCounts,
    jobPostingCounts
  );

  const hasActiveFilters = filterStatus !== "all" || filterStage !== "all" || filterCategory !== "all" || !!search;

  const clearFilters = () => {
    setFilterStatus("all");
    setFilterStage("all");
    setFilterCategory("all");
    setSearch("");
  };

  const columns: EnhancedColumn<Project>[] = [
    { 
      key: "name", 
      header: "Project Name",
      sortable: true,
      filterable: true,
      getValue: (item) => item.name,
      render: (item) => (
        <Link 
          to={`/projects/${item.id}`}
          className="text-primary hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {item.name}
        </Link>
      ),
    },
    { 
      key: "customer", 
      header: "Customer",
      sortable: true,
      filterable: true,
      getValue: (item) => getCustomerDisplayName(customers?.find(c => c.id === item.customer_id)),
      render: (item) => {
        const customer = customers?.find(c => c.id === item.customer_id);
        return customer ? (
          <Link
            to={`/customers/${customer.id}`}
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {getCustomerDisplayName(customer)}
          </Link>
        ) : (
          <span className="text-muted-foreground">Unknown</span>
        );
      },
    },
    {
      key: "start_date",
      header: "Start Date",
      sortable: true,
      filterable: false,
      getValue: (item) => item.start_date,
      render: (item) => format(new Date(item.start_date), "MMM dd, yyyy"),
    },
    {
      key: "end_date",
      header: "End Date",
      sortable: true,
      filterable: false,
      getValue: (item) => item.end_date || "",
      render: (item) => item.end_date ? format(new Date(item.end_date), "MMM dd, yyyy") : "-",
    },
    {
      key: "stage",
      header: "Stage",
      sortable: true,
      filterable: true,
      getValue: (item) => item.stage || "quote",
      render: (item) => {
        const stage = stageConfig[item.stage] || stageConfig.quote;
        return (
          <Badge variant={stage.variant} className={`text-xs ${stage.className}`}>
            {stage.label}
          </Badge>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      getValue: (item) => item.status,
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: "team",
      header: "Team",
      sortable: true,
      filterable: false,
      getValue: (item) => assignmentCounts?.[item.id] ?? 0,
      render: (item) => {
        const count = assignmentCounts?.[item.id] ?? 0;
        return (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <UsersIcon className="h-4 w-4" />
            <span>{count}</span>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      sortable: false,
      filterable: false,
      render: (item) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(item);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(item.id);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      customer_id: project.customer_id,
      status: project.status,
      stage: project.stage || "quote",
      start_date: project.start_date,
      end_date: project.end_date || "",
      description: project.description || "",
      address: project.address || "",
      city: project.city || "",
      state: project.state || "",
      zip: project.zip || "",
      customer_po: project.customer_po || "",
      poc_name: project.poc_name || "",
      poc_phone: project.poc_phone || "",
      poc_email: project.poc_email || "",
      use_customer_address: false,
      time_clock_enabled: (project as any).time_clock_enabled || false,
      require_clock_location: (project as any).require_clock_location ?? true,
      mandatory_payroll: project.mandatory_payroll || false,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteProject.mutate(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { use_customer_address, ...submitFields } = formData;
    const submitData = {
      ...submitFields,
      end_date: formData.end_date || null,
      description: formData.description || null,
      address: formData.address || null,
      city: formData.city || null,
      state: formData.state || null,
      zip: formData.zip || null,
      customer_po: formData.customer_po || null,
      poc_name: formData.poc_name || null,
      poc_phone: formData.poc_phone || null,
      poc_email: formData.poc_email || null,
      mandatory_payroll: formData.mandatory_payroll,
    };

    if (editingProject) {
      await updateProject.mutateAsync({
        id: editingProject.id,
        ...submitData,
      });
    } else {
      await addProject.mutateAsync(submitData);
    }

    setIsDialogOpen(false);
    setEditingProject(null);
    setFormData(initialProjectFormData);
  };

  const openNewDialog = () => {
    setEditingProject(null);
    setFormData(initialProjectFormData);
    setIsDialogOpen(true);
  };

  // Handle ?action=add query param to open dialog
  useEffect(() => {
    if (searchParams.get("action") === "add") {
      openNewDialog();
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Helper to render project cards for a list of projects
  const renderProjectCards = (projectList: Project[]) => (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
      {projectList.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          customerName={getCustomerDisplayName(customers?.find(c => c.id === project.customer_id))}
          assignmentCount={assignmentCounts?.[project.id] ?? 0}
          onEdit={() => handleEdit(project)}
          onDelete={() => handleDelete(project.id)}
          onClick={() => navigate(`/projects/${project.id}`)}
        />
      ))}
    </div>
  );

  // Helper to render project table for a list of projects
  const renderProjectTable = (projectList: Project[], tableId: string) => (
    <EnhancedDataTable
      tableId={tableId}
      data={projectList}
      columns={columns}
      onRowClick={(item) => navigate(`/projects/${item.id}`)}
    />
  );

  // Determine if we show grouped sections or flat list
  const showGroupedView = filterCategory === "all" && baseFilteredProjects.length > 0;

  return (
    <>
      <SEO 
        title="Projects"
        description="Manage and track all your business projects with Command X"
        keywords="project management, customer projects, project tracking, project status"
      />
      <PageLayout
      title="Projects"
      description={isMobile ? undefined : "Manage customer projects and track their status"}
      actions={
        !isMobile ? (
          <Button variant="glow" onClick={openNewDialog}>
            <Plus className="h-4 w-4" />
            Add Project
          </Button>
        ) : undefined
      }
    >
      <PullToRefreshWrapper onRefresh={refetch} isRefreshing={isFetching}>
        {/* Quick Stats */}
        {!isLoading && !error && projects && (
          <ProjectStats 
            projects={projects} 
            individualCount={categorization.counts.individual}
            teamCount={categorization.counts.team}
          />
        )}

        {/* Search & Filters - Combined Row */}
        <div className="mb-6 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 w-full">
            <div className="flex-1 min-w-[200px] max-w-md">
              <SearchInput
                placeholder="Search projects..."
                value={search}
                onChange={setSearch}
                className="bg-secondary border-border w-full"
              />
            </div>
            <ProjectFilters
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterStage={filterStage}
              setFilterStage={setFilterStage}
              filterCategory={filterCategory}
              setFilterCategory={setFilterCategory}
              activeFiltersCount={hasActiveFilters ? 1 : 0}
              onClearFilters={clearFilters}
              search={search}
              inline
            />
          </div>
        </div>

        {/* Loading & Error States */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        {error && (
          <div className="text-center py-12 text-destructive">
            Error loading projects: {error.message}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredProjects.length === 0 && !showGroupedView && (
          <ProjectEmptyState
            hasFilters={hasActiveFilters}
            onAddProject={openNewDialog}
            onClearFilters={clearFilters}
          />
        )}

        {/* Grouped View - when category filter is "all" */}
        {!isLoading && !error && showGroupedView && (
          <>
            {/* Mobile/Tablet Cards - hidden on desktop (1180px+) */}
            <div className="block min-[1180px]:hidden">
              <ProjectSection
                title="Team Projects"
                icon={<UsersIcon className="h-4 w-4" />}
                count={categorization.counts.team}
              >
                {renderProjectCards(categorization.teamProjects)}
              </ProjectSection>
              
              <ProjectSection
                title="Individual Contracts"
                icon={<User className="h-4 w-4" />}
                count={categorization.counts.individual}
              >
                {renderProjectCards(categorization.individualProjects)}
              </ProjectSection>
            </div>

            {/* Desktop Table - hidden below 1180px */}
            <div className="hidden min-[1180px]:block">
              <ProjectSection
                title="Team Projects"
                icon={<UsersIcon className="h-4 w-4" />}
                count={categorization.counts.team}
              >
                {renderProjectTable(categorization.teamProjects, "projects-team")}
              </ProjectSection>
              
              <ProjectSection
                title="Individual Contracts"
                icon={<User className="h-4 w-4" />}
                count={categorization.counts.individual}
              >
                {renderProjectTable(categorization.individualProjects, "projects-individual")}
              </ProjectSection>
            </div>
          </>
        )}

        {/* Flat List View - when a specific category is selected */}
        {!isLoading && !error && !showGroupedView && filteredProjects.length > 0 && (
          <>
            {/* Mobile/Tablet Cards - hidden on desktop (1180px+) */}
            <div className="block min-[1180px]:hidden">
              {renderProjectCards(filteredProjects)}
            </div>
            {/* Desktop Table - hidden below 1180px */}
            <div className="hidden min-[1180px]:block">
              {renderProjectTable(filteredProjects, "projects")}
            </div>
          </>
        )}
      </PullToRefreshWrapper>

      {/* Add/Edit Dialog */}
      <ProjectFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        customers={customers}
        editingProject={editingProject}
        isSubmitting={addProject.isPending || updateProject.isPending}
      />

      {/* Mobile FAB */}
      <FloatingActionButton
        onClick={openNewDialog}
        icon={<Plus className="h-5 w-5" />}
      />
    </PageLayout>
    </>
  );
};

export default Projects;
