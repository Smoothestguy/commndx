import { SEO } from "@/components/SEO";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubcontractorPortalLayout } from "@/components/subcontractor-portal/SubcontractorPortalLayout";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/utils";
import { Search } from "lucide-react";
import {
  useSubcontractorPurchaseOrders,
  SubcontractorPurchaseOrder,
} from "@/integrations/supabase/hooks/useSubcontractorPortal";

export default function SubcontractorPOList() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");

  const { data: purchaseOrders, isLoading } = useSubcontractorPurchaseOrders();

  const filteredPOs = useMemo(() => {
    if (!purchaseOrders) return [];
    if (!search) return purchaseOrders;
    
    const lower = search.toLowerCase();
    return purchaseOrders.filter(
      (po) =>
        po.number.toLowerCase().includes(lower) ||
        po.project_name.toLowerCase().includes(lower) ||
        po.customer_name.toLowerCase().includes(lower)
    );
  }, [purchaseOrders, search]);

  const columns: Column<SubcontractorPurchaseOrder>[] = useMemo(
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
        header: "Total",
        render: (po) => formatCurrency(po.revised_total),
      },
      {
        key: "billed_to_date",
        header: "Billed",
        render: (po) => formatCurrency(po.billed_to_date),
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
      <SubcontractorPortalLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">My Purchase Orders</h1>
            <p className="text-muted-foreground">View all POs assigned to you and their billing status.</p>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search POs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredPOs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "No POs match your search." : "No purchase orders assigned to you yet."}
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {filteredPOs.map((po) => (
                <Card
                  key={po.id}
                  className="p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => navigate(`/subcontractor/purchase-orders/${po.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-medium text-foreground">{po.number}</span>
                      <p className="text-sm text-muted-foreground">{po.project_name}</p>
                    </div>
                    <StatusBadge status={po.status as any} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Total</p>
                      <p className="font-medium">{formatCurrency(po.revised_total)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Billed</p>
                      <p className="font-medium">{formatCurrency(po.billed_to_date)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Remaining</p>
                      <p className="font-semibold text-primary">{formatCurrency(po.remaining_to_bill)}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <DataTable
              data={filteredPOs}
              columns={columns}
              onRowClick={(po) => navigate(`/subcontractor/purchase-orders/${po.id}`)}
            />
          )}
        </div>
      </SubcontractorPortalLayout>
    </>
  );
}
