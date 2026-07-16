import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { EnhancedDataTable, EnhancedColumn } from "@/components/shared/EnhancedDataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Users as UsersIcon, User, Archive, ArchiveRestore, X } from "lucide-react";
import { ProjectContextMenu, ProjectRowActionsMenu } from "@/components/projects/ProjectContextMenu";
import { SearchInput } from "@/components/ui/search-input";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectStats } from "@/components/projects/ProjectStats";
import { ProjectFilters } from "@/components/projects/ProjectFilters";
import { ProjectEmptyState } from "@/components/projects/ProjectEmptyState";
import { ProjectFormDialog, initialProjectFormData, type ProjectFormData } from "@/components/projects/ProjectFormDialog";
import { ProjectCreateWizard } from "@/components/projects/ProjectCreateWizard";
import { ProjectSection } from "@/components/projects/ProjectSection";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserRole } from "@/hooks/useUserRole";
import {
  useProjects,
  useAddProject,
  useUpdateProject,
  useDeleteProject,
  useArchiveProject,
  useUnarchiveProject,
  Project,
} from "@/integrations/supabase/hooks/useProjects";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useAssignmentCountsByProject } from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { useJobPostingCountsByProject } from "@/integrations/supabase/hooks/useJobPostingCountsByProject";
import { useProjectCategorization, filterProjectsByCategory, ProjectCategory } from "@/hooks/useProjectCategorization";
import { format } from "date-fns";
import { stageConfig } from "@/components/projects/ProjectCard";
import { getCustomerDisplayName } from "@/utils/customerDisplayName";

type TabKey = "active" | "quotes" | "completed" | "on-hold" | "archived";
const TAB_KEYS: TabKey[] = ["active", "quotes", "completed", "on-hold", "archived"];

function bucketOf(p: Project): TabKey {
  if (p.archived_at) return "archived";
  if (p.stage === "quote") return "quotes";
  if (p.status === "on-hold") return "on-hold";
  if (p.status === "completed" || p.stage === "complete" || p.stage === "canceled") return "completed";
  return "active";
}

const Projects = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { isAdmin, isManager } = useUserRole();
  const canArchive = isAdmin || isManager;

  // Fetch ALL (including archived) so we can bucket + count in one pass
  const { data: allProjects, isLoading, error, refetch, isFetching } = useProjects({ includeArchived: true });
  const { data: customers } = useCustomers();
  const addProject = useAddProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const archiveProject = useArchiveProject();
  const unarchiveProject = useUnarchiveProject();

  const projectIds = allProjects?.map(p => p.id) || [];
  const { data: assignmentCounts } = useAssignmentCountsByProject(projectIds);
  const { data: jobPostingCounts } = useJobPostingCountsByProject(projectIds);

  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<ProjectCategory>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(initialProjectFormData);

  const tabParam = (searchParams.get("tab") || "active") as TabKey;
  const activeTab: TabKey = TAB_KEYS.includes(tabParam) ? tabParam : "active";
  const setActiveTab = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v === "active") next.delete("tab"); else next.set("tab", v);
    setSearchParams(next, { replace: true });
    setSelectedIds(new Set());
  };

  // Bucket counts
  const bucketCounts = useMemo(() => {
    const c: Record<TabKey, number> = { active: 0, quotes: 0, completed: 0, "on-hold": 0, archived: 0 };
    (allProjects || []).forEach(p => { c[bucketOf(p)]++; });
    return c;
  }, [allProjects]);

  // Non-archived (for stats)
  const nonArchived = useMemo(() => (allProjects || []).filter(p => !p.archived_at), [allProjects]);

  // Projects for current tab
  const tabProjects = useMemo(() => (allProjects || []).filter(p => bucketOf(p) === activeTab), [allProjects, activeTab]);

  // Apply search + stage filter
  const baseFilteredProjects = tabProjects.filter((p) => {
    const searchMatch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      getCustomerDisplayName(customers?.find(c => c.id === p.customer_id)).toLowerCase().includes(search.toLowerCase());
    const stageMatch = filterStage === "all" || p.stage === filterStage;
    return searchMatch && stageMatch;
  });

  const filteredProjects = filterProjectsByCategory(
    baseFilteredProjects,
    filterCategory,
    assignmentCounts,
    jobPostingCounts
  );

  const categorization = useProjectCategorization(
    baseFilteredProjects,
    assignmentCounts,
    jobPostingCounts
  );

  const hasActiveFilters = filterStage !== "all" || filterCategory !== "all" || !!search;
  const clearFilters = () => { setFilterStage("all"); setFilterCategory("all"); setSearch(""); };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const handleBulkArchive = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      const p = allProjects?.find(x => x.id === id);
      if (!p) continue;
      await archiveProject.mutateAsync({ id, name: p.name });
    }
    setSelectedIds(new Set());
  };

  const handleBulkUnarchive = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      const p = allProjects?.find(x => x.id === id);
      if (!p) continue;
      await unarchiveProject.mutateAsync({ id, name: p.name });
    }
    setSelectedIds(new Set());
  };

  const isArchivedTab = activeTab === "archived";

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
        ) : <span className="text-muted-foreground">Unknown</span>;
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
        return <Badge variant={stage.variant} className={`text-xs ${stage.className}`}>{stage.label}</Badge>;
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
        <div className="flex items-center gap-1">
          {!isArchivedTab && (
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(item); }}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {canArchive && !isArchivedTab && (
            <Button variant="ghost" size="icon" title="Archive" onClick={(e) => { e.stopPropagation(); archiveProject.mutate({ id: item.id, name: item.name }); }}>
              <Archive className="h-4 w-4" />
            </Button>
          )}
          {canArchive && isArchivedTab && (
            <Button variant="ghost" size="icon" title="Unarchive" onClick={(e) => { e.stopPropagation(); unarchiveProject.mutate({ id: item.id, name: item.name }); }}>
              <ArchiveRestore className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}>
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

  const handleDelete = (id: string) => { deleteProject.mutate(id); };

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
      await updateProject.mutateAsync({ id: editingProject.id, ...submitData });
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
    setIsWizardOpen(true);
  };

  useEffect(() => {
    if (searchParams.get("action") === "add") {
      openNewDialog();
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const renderProjectCards = (projectList: Project[]) => (
    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
      {projectList.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          customerName={getCustomerDisplayName(customers?.find(c => c.id === project.customer_id))}
          assignmentCount={assignmentCounts?.[project.id] ?? 0}
          onEdit={() => handleEdit(project)}
          onDelete={() => handleDelete(project.id)}
          onClick={() => navigate(`/projects/${project.id}`)}
          compact
          selectable
          selected={selectedIds.has(project.id)}
          onSelectChange={(c) => toggleSelect(project.id, c)}
        />
      ))}
    </div>
  );

  const renderProjectTable = (projectList: Project[], tableId: string) => (
    <EnhancedDataTable
      tableId={tableId}
      data={projectList}
      columns={columns}
      onRowClick={(item) => navigate(`/projects/${item.id}`)}
      selectable
      selectedIds={selectedIds}
      onSelectionChange={setSelectedIds}
    />
  );

  const showGroupedView = activeTab === "active" && filterCategory === "all" && baseFilteredProjects.length > 0;

  const tabLabel = (k: TabKey) => {
    const labels: Record<TabKey, string> = {
      active: "Active",
      quotes: "Quotes",
      completed: "Completed",
      "on-hold": "On-Hold",
      archived: "Archived",
    };
    return labels[k];
  };

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
          {!isLoading && !error && allProjects && (
            <ProjectStats
              projects={nonArchived}
              individualCount={categorization.counts.individual}
              teamCount={categorization.counts.team}
            />
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <div className="overflow-x-auto -mx-1 px-1">
              <TabsList className="w-max">
                {TAB_KEYS.map(k => (
                  <TabsTrigger key={k} value={k} className="gap-1.5">
                    {tabLabel(k)}
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {bucketCounts[k]}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>

          <div className="mb-4 overflow-hidden">
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
                filterStatus="all"
                setFilterStatus={() => {}}
                filterStage={filterStage}
                setFilterStage={setFilterStage}
                filterCategory={filterCategory}
                setFilterCategory={setFilterCategory}
                activeFiltersCount={hasActiveFilters ? 1 : 0}
                onClearFilters={clearFilters}
                search={search}
                inline
                hideStatus
              />
            </div>
          </div>

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

          {!isLoading && !error && filteredProjects.length === 0 && !showGroupedView && (
            <ProjectEmptyState
              hasFilters={hasActiveFilters}
              onAddProject={openNewDialog}
              onClearFilters={clearFilters}
            />
          )}

          {!isLoading && !error && showGroupedView && (
            <>
              <div className="block min-[1180px]:hidden">
                <ProjectSection
                  title="Team Projects"
                  icon={<UsersIcon className="h-4 w-4" />}
                  count={categorization.counts.team}
                  storageKey="projects-section-team"
                  defaultOpen
                >
                  {renderProjectCards(categorization.teamProjects)}
                </ProjectSection>
                <ProjectSection
                  title="Individual Contracts"
                  icon={<User className="h-4 w-4" />}
                  count={categorization.counts.individual}
                  storageKey="projects-section-individual"
                >
                  {renderProjectCards(categorization.individualProjects)}
                </ProjectSection>
              </div>
              <div className="hidden min-[1180px]:block">
                <ProjectSection
                  title="Team Projects"
                  icon={<UsersIcon className="h-4 w-4" />}
                  count={categorization.counts.team}
                  storageKey="projects-section-team"
                  defaultOpen
                >
                  {renderProjectTable(categorization.teamProjects, "projects-team")}
                </ProjectSection>
                <ProjectSection
                  title="Individual Contracts"
                  icon={<User className="h-4 w-4" />}
                  count={categorization.counts.individual}
                  storageKey="projects-section-individual"
                >
                  {renderProjectTable(categorization.individualProjects, "projects-individual")}
                </ProjectSection>
              </div>
            </>
          )}

          {!isLoading && !error && !showGroupedView && filteredProjects.length > 0 && (
            <>
              <div className="block min-[1180px]:hidden">
                {renderProjectCards(filteredProjects)}
              </div>
              <div className="hidden min-[1180px]:block">
                {renderProjectTable(filteredProjects, `projects-${activeTab}`)}
              </div>
            </>
          )}
        </PullToRefreshWrapper>

        {/* Floating bulk action bar */}
        {canArchive && selectedIds.size > 0 && (
          <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-popover border border-border shadow-xl rounded-full px-4 py-2 flex items-center gap-3">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            {isArchivedTab ? (
              <Button size="sm" onClick={handleBulkUnarchive} disabled={unarchiveProject.isPending}>
                <ArchiveRestore className="h-4 w-4 mr-1" /> Unarchive selected
              </Button>
            ) : (
              <Button size="sm" onClick={handleBulkArchive} disabled={archiveProject.isPending}>
                <Archive className="h-4 w-4 mr-1" /> Archive selected
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

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

        <ProjectCreateWizard open={isWizardOpen} onOpenChange={setIsWizardOpen} />

        <FloatingActionButton
          onClick={openNewDialog}
          icon={<Plus className="h-5 w-5" />}
        />
      </PageLayout>
    </>
  );
};

export default Projects;
