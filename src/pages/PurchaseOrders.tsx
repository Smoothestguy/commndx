import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { EnhancedDataTable, EnhancedColumn } from "@/components/shared/EnhancedDataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Eye, ShoppingCart, Loader2 } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { usePurchaseOrders, PurchaseOrder } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";

import { PurchaseOrderCard } from "@/components/purchase-orders/PurchaseOrderCard";
import { PurchaseOrderStats } from "@/components/purchase-orders/PurchaseOrderStats";
import { PurchaseOrderEmptyState } from "@/components/purchase-orders/PurchaseOrderEmptyState";

const PurchaseOrders = () => {
  const navigate = useNavigate();
  const { data: purchaseOrders, isLoading, error, refetch, isFetching } = usePurchaseOrders();
  const { data: vendors } = useVendors();
  const { data: projects } = useProjects();
  
  
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const filteredPOs = useMemo(() => {
    return purchaseOrders?.filter((po) => {
      const matchesSearch = po.number.toLowerCase().includes(search.toLowerCase()) ||
        po.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
        po.project_name.toLowerCase().includes(search.toLowerCase()) ||
        po.customer_name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = selectedStatus === "all" || po.status === selectedStatus;
      
      return matchesSearch && matchesStatus;
    }) || [];
  }, [purchaseOrders, search, selectedStatus]);

  const hasActiveFilters = selectedStatus !== "all" || !!search;

  const columns: EnhancedColumn<PurchaseOrder>[] = [
    {
      key: "number",
      header: "PO #",
      sortable: true,
      filterable: true,
      getValue: (item) => item.number,
      render: (item) => (
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <Link
            to={`/purchase-orders/${item.id}`}
            className="font-medium text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {item.number}
          </Link>
        </div>
      ),
    },
    { 
      key: "vendor_name", 
      header: "Vendor",
      sortable: true,
      filterable: true,
      getValue: (item) => item.vendor_name,
      render: (item) => (
        <Link
          to={`/vendors/${item.vendor_id}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {item.vendor_name}
        </Link>
      ),
    },
    { 
      key: "customer_name", 
      header: "Customer",
      sortable: true,
      filterable: true,
      getValue: (item) => item.customer_name,
      render: (item) => (
        <Link
          to={`/customers/${item.customer_id}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {item.customer_name}
        </Link>
      ),
    },
    { 
      key: "project_name", 
      header: "Project",
      sortable: true,
      filterable: true,
      getValue: (item) => item.project_name,
      render: (item) => (
        <Link
          to={`/projects/${item.project_id}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {item.project_name}
        </Link>
      ),
    },
    {
      key: "job_order_number",
      header: "Job Order",
      sortable: true,
      filterable: true,
      getValue: (item) => item.job_order_number,
      render: (item) => (
        <Link
          to={`/job-orders/${item.job_order_id}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {item.job_order_number}
        </Link>
      ),
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
      key: "total",
      header: "Amount",
      sortable: true,
      filterable: false,
      getValue: (item) => item.total,
      render: (item) => (
        <span className="font-semibold text-primary">
          ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    { 
      key: "due_date", 
      header: "Due Date",
      sortable: true,
      filterable: false,
      getValue: (item) => item.due_date,
      render: (item) => new Date(item.due_date).toLocaleDateString(),
    },
    {
      key: "actions",
      header: "",
      sortable: false,
      filterable: false,
      render: (item) => (
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
          <div className="flex items-center gap-2">
            {/* Search in header - responsive width */}
            <div className="hidden sm:block w-48 md:w-64 lg:w-80">
              <SearchInput
                placeholder="Search purchase orders..."
                value={search}
                onChange={setSearch}
                className="h-9 bg-secondary border-border"
              />
            </div>
            <Button variant="glow" size="sm" onClick={() => navigate("/purchase-orders/new")}>
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">New Purchase Order</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        }
      >
        <PullToRefreshWrapper onRefresh={refetch} isRefreshing={isFetching}>
          {/* Mobile-only search */}
          <div className="sm:hidden mb-4">
            <SearchInput
              placeholder="Search purchase orders..."
              value={search}
              onChange={setSearch}
              className="bg-secondary border-border"
            />
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
              {filteredPOs.length === 0 ? (
                <PurchaseOrderEmptyState
                  onCreatePO={() => navigate("/purchase-orders/new")}
                  hasFilters={hasActiveFilters}
                />
              ) : (
                <>
                  {/* Mobile/Tablet Cards - hidden on desktop (1180px+) */}
                  <div className="block min-[1180px]:hidden">
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                      {filteredPOs.map((po, index) => (
                        <PurchaseOrderCard
                          key={po.id}
                          purchaseOrder={po}
                          onClick={() => navigate(`/purchase-orders/${po.id}`)}
                          onJobOrderClick={(jobOrderId) => navigate(`/job-orders/${jobOrderId}`)}
                          index={index}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Desktop Table - hidden below 1180px */}
                  <div className="hidden min-[1180px]:block">
                    <EnhancedDataTable
                      tableId="purchase-orders"
                      data={filteredPOs}
                      columns={columns}
                      onRowClick={(item) => navigate(`/purchase-orders/${item.id}`)}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </PullToRefreshWrapper>
      </PageLayout>
    </>
  );
};

export default PurchaseOrders;
