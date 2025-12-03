import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Eye, ShoppingCart, Loader2 } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { usePurchaseOrders, PurchaseOrder } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { useIsMobile } from "@/hooks/use-mobile";
import { PurchaseOrderCard } from "@/components/purchase-orders/PurchaseOrderCard";
import { PurchaseOrderStats } from "@/components/purchase-orders/PurchaseOrderStats";
import { PurchaseOrderFilters } from "@/components/purchase-orders/PurchaseOrderFilters";
import { PurchaseOrderEmptyState } from "@/components/purchase-orders/PurchaseOrderEmptyState";

const PurchaseOrders = () => {
  const navigate = useNavigate();
  const { data: purchaseOrders, isLoading, error, refetch, isFetching } = usePurchaseOrders();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"draft" | "sent" | "acknowledged" | "in-progress" | "completed" | "cancelled" | "">("");

  const filteredPOs = purchaseOrders?.filter((po) => {
    const matchesSearch = po.number.toLowerCase().includes(search.toLowerCase()) ||
      po.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
      po.project_name.toLowerCase().includes(search.toLowerCase()) ||
      po.customer_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !selectedStatus || po.status === selectedStatus;
    return matchesSearch && matchesStatus;
  }) || [];

  const columns = [
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
        {/* Search */}
        <div className="mb-6 max-w-md">
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

            {/* Filters */}
            <PurchaseOrderFilters
              selectedStatus={selectedStatus}
              onStatusChange={setSelectedStatus}
            />

            {/* Purchase Orders Display */}
            {filteredPOs.length === 0 ? (
              <PurchaseOrderEmptyState
                onCreatePO={() => navigate("/purchase-orders/new")}
                hasFilters={search !== "" || selectedStatus !== ""}
              />
            ) : isMobile ? (
              <div className="grid gap-4 sm:grid-cols-2">
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
            ) : (
              <DataTable
                data={filteredPOs}
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
