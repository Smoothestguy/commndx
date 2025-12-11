import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Eye, ShoppingCart, Loader2 } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { usePurchaseOrders, PurchaseOrder } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { useIsMobile } from "@/hooks/use-mobile";
import { PurchaseOrderCard } from "@/components/purchase-orders/PurchaseOrderCard";
import { PurchaseOrderStats } from "@/components/purchase-orders/PurchaseOrderStats";
import { PurchaseOrderEmptyState } from "@/components/purchase-orders/PurchaseOrderEmptyState";
import { EnhancedFilters, FilterOption } from "@/components/shared/EnhancedFilters";
import { ColumnCustomizer, useColumnVisibility, ColumnConfig } from "@/components/shared/ColumnCustomizer";

const statusOptions: FilterOption[] = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in-progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const sortOptions = [
  { value: "number", label: "PO #" },
  { value: "vendor_name", label: "Vendor" },
  { value: "total", label: "Amount" },
  { value: "created_at", label: "Created Date" },
  { value: "due_date", label: "Due Date" },
];

const columnConfigs: ColumnConfig[] = [
  { key: "number", label: "PO #" },
  { key: "vendor_name", label: "Vendor" },
  { key: "customer_name", label: "Customer" },
  { key: "project_name", label: "Project" },
  { key: "job_order_number", label: "Job Order" },
  { key: "status", label: "Status" },
  { key: "total", label: "Amount" },
  { key: "due_date", label: "Due Date" },
  { key: "actions", label: "Actions" },
];

const PurchaseOrders = () => {
  const navigate = useNavigate();
  const { data: purchaseOrders, isLoading, error, refetch, isFetching } = usePurchaseOrders();
  const { data: vendors } = useVendors();
  const { data: projects } = useProjects();
  const isMobile = useIsMobile();
  
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { visibleColumns, setVisibleColumns, isColumnVisible } = useColumnVisibility(
    columnConfigs,
    "purchase-orders"
  );

  // Build entity filter options
  const vendorOptions: FilterOption[] = [
    { value: "all", label: "All Vendors" },
    ...(vendors?.map((v) => ({ value: v.id, label: v.name })) || []),
  ];

  const projectOptions: FilterOption[] = [
    { value: "all", label: "All Projects" },
    ...(projects?.map((p) => ({ value: p.id, label: p.name })) || []),
  ];

  const filteredAndSortedPOs = useMemo(() => {
    let filtered = purchaseOrders?.filter((po) => {
      const matchesSearch = po.number.toLowerCase().includes(search.toLowerCase()) ||
        po.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
        po.project_name.toLowerCase().includes(search.toLowerCase()) ||
        po.customer_name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = selectedStatus === "all" || po.status === selectedStatus;
      const matchesVendor = vendorFilter === "all" || po.vendor_id === vendorFilter;
      const matchesProject = projectFilter === "all" || po.project_id === projectFilter;
      
      let matchesDate = true;
      if (dateFrom) {
        matchesDate = matchesDate && new Date(po.created_at) >= new Date(dateFrom);
      }
      if (dateTo) {
        matchesDate = matchesDate && new Date(po.created_at) <= new Date(dateTo);
      }
      
      return matchesSearch && matchesStatus && matchesVendor && matchesProject && matchesDate;
    }) || [];

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "number") {
        comparison = a.number.localeCompare(b.number);
      } else if (sortBy === "vendor_name") {
        comparison = a.vendor_name.localeCompare(b.vendor_name);
      } else if (sortBy === "total") {
        comparison = a.total - b.total;
      } else if (sortBy === "created_at") {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === "due_date") {
        comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [purchaseOrders, search, selectedStatus, vendorFilter, projectFilter, dateFrom, dateTo, sortBy, sortOrder]);

  const hasActiveFilters = selectedStatus !== "all" || vendorFilter !== "all" || projectFilter !== "all" || !!dateFrom || !!dateTo || !!search;

  const allColumns: Column<PurchaseOrder>[] = [
    {
      key: "number",
      header: "PO #",
      render: (item: PurchaseOrder) => (
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <span className="font-medium">{item.number}</span>
        </div>
      ),
    },
    { key: "vendor_name", header: "Vendor" },
    { key: "customer_name", header: "Customer" },
    { key: "project_name", header: "Project" },
    {
      key: "job_order_number",
      header: "Job Order",
      render: (item: PurchaseOrder) => (
        <Button
          variant="link"
          className="p-0 h-auto text-primary"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/job-orders/${item.job_order_id}`);
          }}
        >
          {item.job_order_number}
        </Button>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: PurchaseOrder) => <StatusBadge status={item.status} />,
    },
    {
      key: "total",
      header: "Amount",
      render: (item: PurchaseOrder) => (
        <span className="font-semibold text-primary">
          ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    { key: "due_date", header: "Due Date" },
    {
      key: "actions",
      header: "",
      render: (item: PurchaseOrder) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/purchase-orders/${item.id}`);
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
        title="Purchase Orders"
        description="Create and manage purchase orders for vendors"
        keywords="purchase orders, vendor orders, procurement, purchasing, PO management"
      />
      <PageLayout
        title="Purchase Orders"
        description="Manage vendor purchase orders for job orders"
        actions={
          <Button variant="glow" onClick={() => navigate("/purchase-orders/new")}>
            <Plus className="h-4 w-4" />
            New Purchase Order
          </Button>
        }
      >
        <PullToRefreshWrapper onRefresh={refetch} isRefreshing={isFetching}>
          {/* Search & Filter Controls */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 max-w-md">
                <SearchInput
                  placeholder="Search purchase orders..."
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
                    entityFilters={[
                      {
                        label: "Vendor",
                        options: vendorOptions,
                        value: vendorFilter,
                        onChange: setVendorFilter,
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
                    storageKey="purchase-orders"
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
              Error loading purchase orders: {error.message}
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* Stats */}
              <PurchaseOrderStats purchaseOrders={purchaseOrders || []} />

              {/* Purchase Orders Display */}
              {filteredAndSortedPOs.length === 0 ? (
                <PurchaseOrderEmptyState
                  onCreatePO={() => navigate("/purchase-orders/new")}
                  hasFilters={hasActiveFilters}
                />
              ) : isMobile ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredAndSortedPOs.map((po, index) => (
                    <PurchaseOrderCard
                      key={po.id}
                      purchaseOrder={po}
                      onClick={() => navigate(`/purchase-orders/${po.id}`)}
                      onJobOrderClick={(jobOrderId) => navigate(`/job-orders/${jobOrderId}`)}
                      index={index}
                    />
                  ))}
                </div>
              ) : (
                <DataTable
                  data={filteredAndSortedPOs}
                  columns={columns}
                  onRowClick={(item) => navigate(`/purchase-orders/${item.id}`)}
                />
              )}
            </>
          )}
        </PullToRefreshWrapper>
      </PageLayout>
    </>
  );
};

export default PurchaseOrders;
