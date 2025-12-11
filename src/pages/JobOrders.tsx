import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Eye, Briefcase, Loader2, Upload } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { useJobOrders, JobOrder } from "@/integrations/supabase/hooks/useJobOrders";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { useIsMobile } from "@/hooks/use-mobile";
import { JobOrderCard } from "@/components/job-orders/JobOrderCard";
import { JobOrderStats } from "@/components/job-orders/JobOrderStats";
import { JobOrderEmptyState } from "@/components/job-orders/JobOrderEmptyState";
import { ImportWorkOrderDialog } from "@/components/job-orders/ImportWorkOrderDialog";
import { EnhancedFilters, FilterOption } from "@/components/shared/EnhancedFilters";
import { ColumnCustomizer, useColumnVisibility, ColumnConfig } from "@/components/shared/ColumnCustomizer";

const statusOptions: FilterOption[] = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "in-progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "on-hold", label: "On Hold" },
];

const sortOptions = [
  { value: "number", label: "Job Order #" },
  { value: "customer_name", label: "Customer" },
  { value: "total", label: "Total Value" },
  { value: "created_at", label: "Created Date" },
];

const columnConfigs: ColumnConfig[] = [
  { key: "number", label: "Job Order #" },
  { key: "customer_name", label: "Customer" },
  { key: "project_name", label: "Project" },
  { key: "status", label: "Status" },
  { key: "total", label: "Total Value" },
  { key: "invoiced_amount", label: "Invoiced" },
  { key: "remaining_amount", label: "Remaining" },
  { key: "actions", label: "Actions" },
];

const JobOrders = () => {
  const navigate = useNavigate();
  const { data: jobOrders, isLoading, error, refetch, isFetching } = useJobOrders();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showImportDialog, setShowImportDialog] = useState(false);

  const { visibleColumns, setVisibleColumns, isColumnVisible } = useColumnVisibility(
    columnConfigs,
    "job-orders"
  );

  const filteredAndSortedJobOrders = useMemo(() => {
    let filtered = jobOrders?.filter((j) => {
      const matchesSearch = j.number.toLowerCase().includes(search.toLowerCase()) ||
        j.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        j.project_name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = selectedStatus === "all" || j.status === selectedStatus;
      return matchesSearch && matchesStatus;
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
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [jobOrders, search, selectedStatus, sortBy, sortOrder]);

  const allColumns: Column<JobOrder>[] = [
    {
      key: "number",
      header: "Job Order #",
      render: (item: JobOrder) => (
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          <span className="font-medium">{item.number}</span>
        </div>
      ),
    },
    { key: "customer_name", header: "Customer" },
    { key: "project_name", header: "Project" },
    {
      key: "status",
      header: "Status",
      render: (item: JobOrder) => <StatusBadge status={item.status} />,
    },
    {
      key: "total",
      header: "Total Value",
      render: (item: JobOrder) => (
        <span className="font-semibold text-primary">
          ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "invoiced_amount",
      header: "Invoiced",
      render: (item: JobOrder) => (
        <span className="text-success">
          ${item.invoiced_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "remaining_amount",
      header: "Remaining",
      render: (item: JobOrder) => (
        <span className="text-warning">
          ${item.remaining_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (item: JobOrder) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/job-orders/${item.id}`);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const columns = allColumns.filter((col) => isColumnVisible(col.key as string));

  return (
    <>
      <SEO 
        title="Job Orders"
        description="Track and manage job orders from approved estimates"
        keywords="job orders, work orders, job tracking, project execution, job management"
      />
      <PageLayout
        title="Job Orders"
        description="Active jobs from approved estimates"
        actions={
          <Button onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import Work Order
          </Button>
        }
      >
        <PullToRefreshWrapper onRefresh={refetch} isRefreshing={isFetching}>
          {/* Search & Filter Controls */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 max-w-md">
                <SearchInput
                  placeholder="Search job orders..."
                  value={search}
                  onChange={setSearch}
                  className="bg-secondary border-border"
                />
              </div>
              {!isMobile && (
                <div className="flex items-center gap-2">
                  <EnhancedFilters
                    statusOptions={statusOptions}
                    statusValue={selectedStatus}
                    onStatusChange={setSelectedStatus}
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
                    storageKey="job-orders"
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
              Error loading job orders: {error.message}
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* Stats */}
              <JobOrderStats jobOrders={jobOrders || []} />

              {/* Job Orders Display */}
              {filteredAndSortedJobOrders.length === 0 ? (
                <JobOrderEmptyState hasFilters={search !== "" || selectedStatus !== "all"} />
              ) : isMobile ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredAndSortedJobOrders.map((jobOrder, index) => (
                    <JobOrderCard
                      key={jobOrder.id}
                      jobOrder={jobOrder}
                      onClick={() => navigate(`/job-orders/${jobOrder.id}`)}
                      index={index}
                    />
                  ))}
                </div>
              ) : (
                <DataTable
                  data={filteredAndSortedJobOrders}
                  columns={columns}
                  onRowClick={(item) => navigate(`/job-orders/${item.id}`)}
                />
              )}
            </>
          )}
        </PullToRefreshWrapper>
        
        <ImportWorkOrderDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
        />
      </PageLayout>
    </>
  );
};

export default JobOrders;
