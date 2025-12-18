import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2, Loader2, Filter, X } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { Card, CardContent } from "@/components/ui/card";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectStats } from "@/components/projects/ProjectStats";
import { ProjectFilters } from "@/components/projects/ProjectFilters";
import { ProjectEmptyState } from "@/components/projects/ProjectEmptyState";
import { ProjectFormDialog, initialProjectFormData, type ProjectFormData } from "@/components/projects/ProjectFormDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects, useAddProject, useUpdateProject, useDeleteProject, Project, ProjectStage } from "@/integrations/supabase/hooks/useProjects";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { stageConfig } from "@/components/projects/ProjectCard";

const Projects = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: projects, isLoading, error, refetch, isFetching } = useProjects();
  const { data: customers } = useCustomers();
  const addProject = useAddProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterCustomer, setFilterCustomer] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [sortBy, setSortBy] = useState<"name" | "start_date" | "end_date">("start_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(initialProjectFormData);

  // Apply filters and sorting
  const filteredProjects = projects
    ?.filter((p) => {
      // Search filter
      const searchMatch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        customers?.find(c => c.id === p.customer_id)?.name.toLowerCase().includes(search.toLowerCase());
      
      // Status filter
      const statusMatch = filterStatus === "all" || p.status === filterStatus;
      
      // Stage filter
      const stageMatch = filterStage === "all" || p.stage === filterStage;
      
      // Customer filter
      const customerMatch = filterCustomer === "all" || p.customer_id === filterCustomer;
      
      // Date range filter
      let dateMatch = true;
      if (filterDateFrom) {
        dateMatch = dateMatch && new Date(p.start_date) >= new Date(filterDateFrom);
      }
      if (filterDateTo) {
        const projectEndDate = p.end_date || p.start_date;
        dateMatch = dateMatch && new Date(projectEndDate) <= new Date(filterDateTo);
      }
      
      return searchMatch && statusMatch && stageMatch && customerMatch && dateMatch;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "start_date") {
        comparison = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      } else if (sortBy === "end_date") {
        const aDate = a.end_date || "9999-12-31";
        const bDate = b.end_date || "9999-12-31";
        comparison = new Date(aDate).getTime() - new Date(bDate).getTime();
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    }) || [];

  const clearFilters = () => {
    setFilterStatus("all");
    setFilterStage("all");
    setFilterCustomer("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setSearch("");
  };

  const hasActiveFilters = filterStatus !== "all" || filterStage !== "all" || filterCustomer !== "all" || !!filterDateFrom || !!filterDateTo || !!search;

  const columns = [
    { key: "name", header: "Project Name" },
    { 
      key: "customer", 
      header: "Customer",
      render: (item: Project) => {
        const customer = customers?.find(c => c.id === item.customer_id);
        return customer?.name || "Unknown";
      }
    },
    {
      key: "start_date",
      header: "Start Date",
      render: (item: Project) => format(new Date(item.start_date), "MMM dd, yyyy"),
    },
    {
      key: "end_date",
      header: "End Date",
      render: (item: Project) => item.end_date ? format(new Date(item.end_date), "MMM dd, yyyy") : "-",
    },
    {
      key: "stage",
      header: "Stage",
      render: (item: Project) => {
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
      render: (item: Project) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      header: "",
      render: (item: Project) => (
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

  return (
    <>
      <SEO 
        title="Projects"
        description="Manage and track all your business projects with Command X"
        keywords="project management, customer projects, project tracking, project status"
      />
      <PageLayout
      title="Projects"
      description="Manage customer projects and track their status"
      actions={
        <Button variant="glow" onClick={openNewDialog}>
          <Plus className="h-4 w-4" />
          Add Project
        </Button>
      }
    >
      <PullToRefreshWrapper onRefresh={refetch} isRefreshing={isFetching}>
        {/* Quick Stats */}
        {!isLoading && !error && projects && (
          <ProjectStats projects={projects} />
        )}

        {/* Search & Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <SearchInput
                placeholder="Search projects..."
                value={search}
                onChange={setSearch}
                className="bg-secondary border-border"
              />
            </div>
            {!isMobile && (
              <>
                <Button
                  variant={showFilters ? "default" : "outline"}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
                {hasActiveFilters && (
                  <Button variant="ghost" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Mobile Filters */}
          {isMobile && (
            <ProjectFilters
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterStage={filterStage}
              setFilterStage={setFilterStage}
              activeFiltersCount={hasActiveFilters ? 1 : 0}
              onClearFilters={clearFilters}
              search={search}
            />
          )}

          {/* Desktop Filters */}
          {!isMobile && showFilters && (
            <Card className="glass border-border">
              <CardContent className="pt-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="filterStage">Stage</Label>
                    <Select value={filterStage} onValueChange={setFilterStage}>
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Stages</SelectItem>
                        <SelectItem value="quote">Quote</SelectItem>
                        <SelectItem value="task_order">Task Order</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="complete">Complete</SelectItem>
                        <SelectItem value="canceled">Canceled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="filterStatus">Status</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="on-hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="filterCustomer">Customer</Label>
                    <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Customers</SelectItem>
                        {customers?.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="filterDateFrom">Start Date From</Label>
                    <Input
                      id="filterDateFrom"
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="filterDateTo">End Date To</Label>
                    <Input
                      id="filterDateTo"
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-4">
                    <Label className="text-sm font-medium">Sort by:</Label>
                    <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                      <SelectTrigger className="w-[180px] bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="start_date">Start Date</SelectItem>
                        <SelectItem value="end_date">End Date</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={sortOrder} onValueChange={(v: any) => setSortOrder(v)}>
                      <SelectTrigger className="w-[150px] bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Ascending</SelectItem>
                        <SelectItem value="desc">Descending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
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
        {!isLoading && !error && filteredProjects.length === 0 && (
          <ProjectEmptyState
            hasFilters={hasActiveFilters}
            onAddProject={openNewDialog}
            onClearFilters={clearFilters}
          />
        )}

        {/* Mobile Card Layout */}
        {!isLoading && !error && filteredProjects.length > 0 && isMobile && (
          <div className="space-y-3">
            {filteredProjects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                customerName={customers?.find(c => c.id === project.customer_id)?.name || "Unknown"}
                onEdit={() => handleEdit(project)}
                onDelete={() => handleDelete(project.id)}
                onClick={() => navigate(`/projects/${project.id}`)}
                index={index}
              />
            ))}
          </div>
        )}

        {/* Desktop Table Layout */}
        {!isLoading && !error && filteredProjects.length > 0 && !isMobile && (
          <DataTable
            data={filteredProjects}
            columns={columns}
            onRowClick={(item) => navigate(`/projects/${item.id}`)}
          />
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
    </PageLayout>
    </>
  );
};

export default Projects;
