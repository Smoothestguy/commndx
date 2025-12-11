import { SEO } from "@/components/SEO";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import { VendorPortalLayout } from "@/components/vendor-portal/VendorPortalLayout";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import {
  useVendorPurchaseOrders,
  VendorPurchaseOrder,
} from "@/integrations/supabase/hooks/useVendorPortal";

export default function VendorPOsList() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");

  const { data: purchaseOrders, isLoading } = useVendorPurchaseOrders();

  const filteredPOs = useMemo(() => {
    if (!purchaseOrders) return [];
    if (!search) return purchaseOrders;
    
    const searchLower = search.toLowerCase();
    return purchaseOrders.filter(
      (po) =>
        po.number.toLowerCase().includes(searchLower) ||
        po.project_name.toLowerCase().includes(searchLower) ||
        po.customer_name.toLowerCase().includes(searchLower)
    );
  }, [purchaseOrders, search]);

  const columns: Column<VendorPurchaseOrder>[] = useMemo(
    () => [
      { key: "number", header: "PO #" },
      { key: "project_name", header: "Project" },
      { key: "customer_name", header: "Customer" },
      {
        key: "status",
        header: "Status",
        render: (po) => <StatusBadge status={po.status as any} />,
      },
      {
        key: "revised_total",
        header: "Total Value",
        render: (po) => (
          <span className="font-medium">
            {formatCurrency(po.revised_total)}
          </span>
        ),
      },
      {
        key: "billed_to_date",
        header: "Billed",
        render: (po) => (
          <span className="text-muted-foreground">
            {formatCurrency(po.billed_to_date)}
          </span>
        ),
      },
      {
        key: "remaining_to_bill",
        header: "Remaining",
        render: (po) => (
          <span className="text-primary font-semibold">
            {formatCurrency(po.remaining_to_bill)}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <>
      <SEO
        title="My Purchase Orders"
        description="View all your assigned purchase orders."
      />
      <VendorPortalLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">My Purchase Orders</h1>
            <p className="text-muted-foreground">View all your assigned purchase orders and billing progress.</p>
          </div>

          <div className="max-w-sm">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search POs..."
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading purchase orders...
            </div>
          ) : filteredPOs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "No purchase orders match your search." : "No purchase orders assigned to you yet."}
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {filteredPOs.map((po) => (
                <Card
                  key={po.id}
                  className="p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => navigate(`/vendor/pos/${po.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-medium text-foreground">
                        {po.number}
                      </span>
                      <p className="text-sm text-muted-foreground">
                        {po.project_name}
                      </p>
                    </div>
                    <StatusBadge status={po.status as any} />
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                      Remaining: {formatCurrency(po.remaining_to_bill)}
                    </span>
                    <span className="text-primary font-semibold">
                      {formatCurrency(po.revised_total)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <DataTable
              data={filteredPOs}
              columns={columns}
              onRowClick={(po) => navigate(`/vendor/pos/${po.id}`)}
            />
          )}
        </div>
      </VendorPortalLayout>
    </>
  );
}
