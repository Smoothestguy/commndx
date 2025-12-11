import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, FileText, Loader2, Edit } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { useEstimates, Estimate } from "@/integrations/supabase/hooks/useEstimates";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { useIsMobile } from "@/hooks/use-mobile";
import { EstimateCard } from "@/components/estimates/EstimateCard";
import { EstimateStats } from "@/components/estimates/EstimateStats";
import { EstimateEmptyState } from "@/components/estimates/EstimateEmptyState";
import { EnhancedFilters, FilterOption } from "@/components/shared/EnhancedFilters";
import { ColumnCustomizer, useColumnVisibility, ColumnConfig } from "@/components/shared/ColumnCustomizer";

const statusOptions: FilterOption[] = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "approved", label: "Approved" },
];

const sortOptions = [
  { value: "number", label: "Estimate #" },
  { value: "customer_name", label: "Customer" },
  { value: "total", label: "Total" },
  { value: "created_at", label: "Created Date" },
  { value: "valid_until", label: "Valid Until" },
];

const columnConfigs: ColumnConfig[] = [
  { key: "number", label: "Estimate #" },
  { key: "customer_name", label: "Customer" },
  { key: "project_name", label: "Project" },
  { key: "status", label: "Status" },
  { key: "valid_until", label: "Valid Until" },
  { key: "total", label: "Total" },
  { key: "actions", label: "Actions" },
];

const Estimates = () => {
  const navigate = useNavigate();
  const { data: estimates, isLoading, error, refetch, isFetching } = useEstimates();
  const { data: customers } = useCustomers();
  const { data: projects } = useProjects();
  const isMobile = useIsMobile();
  
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { visibleColumns, setVisibleColumns, isColumnVisible } = useColumnVisibility(
    columnConfigs,
    "estimates"
  );

  // Count drafts
  const draftCount = estimates?.filter(e => e.status === "draft").length || 0;

  // Build entity filter options
  const customerOptions: FilterOption[] = [
    { value: "all", label: "All Customers" },
    ...(customers?.map((c) => ({ value: c.id, label: c.name })) || []),
  ];

  const projectOptions: FilterOption[] = [
    { value: "all", label: "All Projects" },
    ...(projects?.map((p) => ({ value: p.id, label: p.name })) || []),
  ];

  const filteredAndSortedEstimates = useMemo(() => {
    let filtered = estimates?.filter((e) => {
      const matchesSearch = e.number.toLowerCase().includes(search.toLowerCase()) ||
        e.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        (e.project_name && e.project_name.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = selectedStatus === "all" || e.status === selectedStatus;
      const matchesCustomer = customerFilter === "all" || e.customer_id === customerFilter;
      const matchesProject = projectFilter === "all" || e.project_id === projectFilter;
      
      let matchesDate = true;
      if (dateFrom) {
        matchesDate = matchesDate && new Date(e.created_at) >= new Date(dateFrom);
      }
      if (dateTo) {
        matchesDate = matchesDate && new Date(e.created_at) <= new Date(dateTo);
      }
      
      return matchesSearch && matchesStatus && matchesCustomer && matchesProject && matchesDate;
    }) || [];

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "number") {
        comparison = a.number.localeCompare(b.number);
      } else if (sortBy === "customer_name") {
        comparison = a.customer_name.localeCompare(b.customer_name);
      } else if (sortBy === "total") {
        comparison = a.total - b.total;
      } else if (sortBy === "created_at") {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === "valid_until") {
        comparison = new Date(a.valid_until).getTime() - new Date(b.valid_until).getTime();
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [estimates, search, selectedStatus, customerFilter, projectFilter, dateFrom, dateTo, sortBy, sortOrder]);

  const hasActiveFilters = selectedStatus !== "all" || customerFilter !== "all" || projectFilter !== "all" || !!dateFrom || !!dateTo || !!search;

  const allColumns: Column<Estimate>[] = [
    {
      key: "number",
      header: "Estimate #",
      render: (item: Estimate) => (
        <div className="flex items-center gap-2">
          <FileText className={`h-4 w-4 ${item.status === 'draft' ? 'text-amber-500' : 'text-primary'}`} />
          <span className="font-medium">{item.number}</span>
          {item.status === "draft" && (
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
              Draft
            </Badge>
          )}
        </div>
      ),
    },
    { 
      key: "customer_name", 
      header: "Customer",
      render: (item: Estimate) => (
        <span className={item.customer_name === "Draft" ? "text-muted-foreground italic" : ""}>
          {item.customer_name === "Draft" ? "No customer" : item.customer_name}
        </span>
      ),
    },
    { key: "project_name", header: "Project" },
    {
      key: "status",
      header: "Status",
      render: (item: Estimate) => <StatusBadge status={item.status} />,
    },
    { key: "valid_until", header: "Valid Until" },
    {
      key: "total",
      header: "Total",
      render: (item: Estimate) => (
        <span className={`font-semibold ${item.status === 'draft' ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`}>
          ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (item: Estimate) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/estimates/${item.id}`);
            }}
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/estimates/${item.id}/edit`);
            }}
            title="Edit estimate"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const columns = allColumns.filter((col) => isColumnVisible(col.key as string));

  const handleRowClick = (item: Estimate) => {
    navigate(`/estimates/${item.id}`);
  };

  return (
    <>
      <SEO 
        title="Estimates"
        description="Create and manage project estimates for customers"
        keywords="estimates, project estimates, quotations, pricing, customer estimates"
      />
      <PageLayout
        title="Estimates"
        description="Create and manage project estimates"
        actions={
          <Button variant="glow" onClick={() => navigate("/estimates/new")}>
            <Plus className="h-4 w-4" />
            New Estimate
          </Button>
        }
      >
        <PullToRefreshWrapper onRefresh={refetch} isRefreshing={isFetching}>
          {/* Search & Filter Controls */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <SearchInput
                  placeholder="Search estimates..."
                  value={search}
                  onChange={setSearch}
                  className="bg-secondary border-border max-w-md"
                />
              </div>
              {draftCount > 0 && (
                <Button
                  variant={selectedStatus === "draft" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStatus(selectedStatus === "draft" ? "all" : "draft")}
                  className="whitespace-nowrap"
                >
                  <FileText className="h-4 w-4 mr-1" />
                  My Drafts ({draftCount})
                </Button>
              )}
              {!isMobile && (
                <div className="flex items-center gap-2">
                  <EnhancedFilters
                    statusOptions={statusOptions}
                    statusValue={selectedStatus}
                    onStatusChange={setSelectedStatus}
                    entityFilters={[
                      {
                        label: "Customer",
                        options: customerOptions,
                        value: customerFilter,
                        onChange: setCustomerFilter,
                      },
                      {
                        label: "Project",
                        options: projectOptions,
                        value: projectFilter,
                        onChange: setProjectFilter,
                      },
                    ]}
                    showDateRange
                    dateFromValue={dateFrom}
                    dateToValue={dateTo}
                    onDateFromChange={setDateFrom}
                    onDateToChange={setDateTo}
                    dateFromLabel="Created From"
                    dateToLabel="Created To"
                    sortOptions={sortOptions}
                    sortValue={sortBy}
                    onSortChange={setSortBy}
                    sortOrderValue={sortOrder}
                    onSortOrderChange={setSortOrder}
                  />
                  <ColumnCustomizer
                    columns={columnConfigs}
                    visibleColumns={visibleColumns}
                    onVisibleColumnsChange={setVisibleColumns}
                    storageKey="estimates"
                  />
                </div>
              )}
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
              Error loading estimates: {error.message}
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* Stats */}
              <EstimateStats estimates={estimates || []} />

              {/* Estimates Display */}
              {filteredAndSortedEstimates.length === 0 ? (
                <EstimateEmptyState
                  onCreateEstimate={() => navigate("/estimates/new")}
                  hasFilters={hasActiveFilters}
                />
              ) : isMobile ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredAndSortedEstimates.map((estimate, index) => (
                    <EstimateCard
                      key={estimate.id}
                      estimate={estimate}
                      onClick={() => handleRowClick(estimate)}
                      index={index}
                    />
                  ))}
                </div>
              ) : (
                <DataTable
                  data={filteredAndSortedEstimates}
                  columns={columns}
                  onRowClick={handleRowClick}
                />
              )}
            </>
          )}
        </PullToRefreshWrapper>
      </PageLayout>
    </>
  );
};

export default Estimates;
