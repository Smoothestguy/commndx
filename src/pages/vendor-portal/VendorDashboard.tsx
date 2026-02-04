import { SEO } from "@/components/SEO";
import { StatCard } from "@/components/dashboard/StatCard";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { VendorPortalLayout } from "@/components/vendor-portal/VendorPortalLayout";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/utils";
import {
  FileText,
  DollarSign,
  ClipboardList,
  ListChecks,
} from "lucide-react";
import {
  useVendorPurchaseOrders,
  useVendorBills,
  VendorPurchaseOrder,
  VendorBill,
} from "@/integrations/supabase/hooks/useVendorPortal";

export default function VendorDashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const {
    data: purchaseOrders,
    isLoading: poLoading,
    refetch: refetchPOs,
    isFetching: isFetchingPOs,
  } = useVendorPurchaseOrders();

  const {
    data: bills,
    isLoading: billsLoading,
    refetch: refetchBills,
    isFetching: isFetchingBills,
  } = useVendorBills();

  const handleRefresh = async () => {
    await Promise.all([refetchPOs(), refetchBills()]);
  };

  const isRefreshing = isFetchingPOs || isFetchingBills;
  const isLoading = poLoading || billsLoading;

  const stats = useMemo(() => {
    if (!purchaseOrders || !bills) {
      return {
        openPOs: 0,
        totalContractValue: 0,
        billedToDate: 0,
        remainingToBill: 0,
        pendingBills: 0,
        approvedBills: 0,
      };
    }

    const openPOs = purchaseOrders.filter((po) => 
      po.status !== "closed" && po.status !== "cancelled"
    ).length;

    const totalContractValue = purchaseOrders.reduce(
      (sum, po) => sum + (po.revised_total ?? 0),
      0
    );

    const billedToDate = purchaseOrders.reduce(
      (sum, po) => sum + (po.billed_to_date ?? 0),
      0
    );

    const remainingToBill = purchaseOrders.reduce(
      (sum, po) => sum + (po.remaining_to_bill ?? 0),
      0
    );

    const pendingBills = bills.filter(
      (b) => b.status === "open" || b.status === "draft"
    ).length;

    const approvedBills = bills.filter((b) => b.status === "paid").length;

    return {
      openPOs,
      totalContractValue,
      billedToDate,
      remainingToBill,
      pendingBills,
      approvedBills,
    };
  }, [purchaseOrders, bills]);

  const recentPOs = useMemo(
    () => purchaseOrders?.slice(0, 5) ?? [],
    [purchaseOrders]
  );

  const recentBills = useMemo(
    () => bills?.slice(0, 5) ?? [],
    [bills]
  );

  const poColumns: Column<VendorPurchaseOrder>[] = useMemo(
    () => [
      { key: "number", header: "PO #" },
      { key: "project_name", header: "Project" },
      {
        key: "status",
        header: "Status",
        render: (po) => <StatusBadge status={po.status as any} />,
      },
      {
        key: "revised_total",
        header: "Revised Total",
        render: (po) => (
          <span className="font-medium">
            {formatCurrency(po.revised_total)}
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

  const billColumns: Column<VendorBill>[] = useMemo(
    () => [
      { key: "number", header: "Bill #" },
      { key: "po_number", header: "PO #" },
      {
        key: "status",
        header: "Status",
        render: (bill) => <StatusBadge status={bill.status as any} />,
      },
      {
        key: "total",
        header: "Amount",
        render: (bill) => (
          <span className="font-medium">{formatCurrency(bill.total)}</span>
        ),
      },
    ],
    []
  );

  return (
    <>
      <SEO
        title="Vendor Dashboard"
        description="View your purchase orders, change order impact, and billing status."
        keywords="vendor portal, purchase orders, billing, change orders"
      />
      <VendorPortalLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground">See your POs, billing progress, and submit bills.</p>
            </div>
            <Button
              onClick={() => navigate("/vendor/bills/new")}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              {!isMobile && "New Bill"}
            </Button>
          </div>
          
          <PullToRefreshWrapper
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          >
            {/* Stats - 2 cols on mobile/tablet portrait, 4 cols on tablet landscape+ */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4 mb-4 sm:mb-8">
              <StatCard
                title="Open POs"
                value={isLoading ? "..." : stats.openPOs}
                change={`${purchaseOrders?.length ?? 0} total POs`}
                changeType="neutral"
                icon={ClipboardList}
              />
              <StatCard
                title="Contract Value"
                value={
                  isLoading ? "..." : formatCurrency(stats.totalContractValue)
                }
                change={`Billed ${formatCurrency(stats.billedToDate)}`}
                changeType="positive"
                icon={DollarSign}
              />
              <StatCard
                title="Remaining to Bill"
                value={
                  isLoading ? "..." : formatCurrency(stats.remainingToBill)
                }
                change="Based on approved POs/COs"
                changeType="neutral"
                icon={ListChecks}
              />
              <StatCard
                title="Pending Bills"
                value={isLoading ? "..." : stats.pendingBills}
                change={
                  stats.approvedBills > 0
                    ? `${stats.approvedBills} paid`
                    : "No paid bills yet"
                }
                changeType="neutral"
                icon={FileText}
              />
            </div>

            {/* Recent POs + Bills */}
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
              {/* Recent POs */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base sm:text-lg font-semibold text-foreground">
                    Your Purchase Orders
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/vendor/pos")}
                    className="text-xs sm:text-sm"
                  >
                    View all
                  </Button>
                </div>

                {isLoading ? (
                  <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                    Loading POs...
                  </div>
                ) : recentPOs.length === 0 ? (
                  <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                    No POs assigned to you yet.
                  </div>
                ) : isMobile ? (
                  <div className="space-y-3">
                    {recentPOs.map((po) => (
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
                            Remaining:{" "}
                            {formatCurrency(po.remaining_to_bill ?? 0)}
                          </span>
                          <span className="text-primary font-semibold">
                            {formatCurrency(po.revised_total ?? 0)}
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <DataTable
                    data={recentPOs}
                    columns={poColumns}
                    onRowClick={(po) => navigate(`/vendor/pos/${po.id}`)}
                  />
                )}
              </div>

              {/* Recent Bills */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base sm:text-lg font-semibold text-foreground">
                    Your Bills
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/vendor/bills")}
                    className="text-xs sm:text-sm"
                  >
                    View all
                  </Button>
                </div>

                {isLoading ? (
                  <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                    Loading bills...
                  </div>
                ) : recentBills.length === 0 ? (
                  <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                    You haven't submitted any bills yet.
                  </div>
                ) : isMobile ? (
                  <div className="space-y-3">
                    {recentBills.map((bill) => (
                      <Card
                        key={bill.id}
                        className="p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => navigate(`/vendor/bills/${bill.id}`)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-medium text-foreground">
                              {bill.number}
                            </span>
                            <p className="text-sm text-muted-foreground">
                              PO: {bill.po_number}
                            </p>
                        </div>
                        <StatusBadge status={bill.status as any} />
                      </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">
                            {bill.submitted_at
                              ? new Date(bill.submitted_at).toLocaleDateString()
                              : "Not submitted"}
                          </span>
                          <span className="text-primary font-semibold">
                            {formatCurrency(bill.total)}
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <DataTable
                    data={recentBills}
                    columns={billColumns}
                    onRowClick={(bill) => navigate(`/vendor/bills/${bill.id}`)}
                  />
                )}
              </div>
            </div>
          </PullToRefreshWrapper>
        </div>
      </VendorPortalLayout>
    </>
  );
}
