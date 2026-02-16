import { SEO } from "@/components/SEO";
import { StatCard } from "@/components/dashboard/StatCard";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { SubcontractorPortalLayout } from "@/components/subcontractor-portal/SubcontractorPortalLayout";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/utils";
import {
  FileText,
  DollarSign,
  ClipboardList,
  AlertTriangle,
  Building2,
} from "lucide-react";
import {
  useSubcontractorPurchaseOrders,
  useSubcontractorBills,
  useSubcontractorBackCharges,
  SubcontractorPurchaseOrder,
  SubcontractorBill,
} from "@/integrations/supabase/hooks/useSubcontractorPortal";
import { useContractorRooms } from "@/integrations/supabase/hooks/useContractorCompletions";

export default function SubcontractorDashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const {
    data: purchaseOrders,
    isLoading: poLoading,
    refetch: refetchPOs,
    isFetching: isFetchingPOs,
  } = useSubcontractorPurchaseOrders();

  const {
    data: bills,
    isLoading: billsLoading,
    refetch: refetchBills,
    isFetching: isFetchingBills,
  } = useSubcontractorBills();

  const {
    data: backCharges,
    isLoading: backChargesLoading,
    refetch: refetchBackCharges,
    isFetching: isFetchingBackCharges,
  } = useSubcontractorBackCharges();

  const { data: rooms, isLoading: roomsLoading } = useContractorRooms();

  const handleRefresh = async () => {
    await Promise.all([refetchPOs(), refetchBills(), refetchBackCharges()]);
  };

  const isRefreshing = isFetchingPOs || isFetchingBills || isFetchingBackCharges;
  const isLoading = poLoading || billsLoading || backChargesLoading;

  const stats = useMemo(() => {
    if (!purchaseOrders || !bills) {
      return {
        openPOs: 0,
        totalContractValue: 0,
        billedToDate: 0,
        remainingToBill: 0,
        totalBackCharges: 0,
        pendingBills: 0,
        paidBills: 0,
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

    const totalBackCharges = backCharges?.reduce(
      (sum, charge) => sum + charge.amount,
      0
    ) || 0;

    const pendingBills = bills.filter(
      (b) => b.status === "open" || b.status === "draft"
    ).length;

    const paidBills = bills.filter((b) => b.status === "paid").length;

    return {
      openPOs,
      totalContractValue,
      billedToDate,
      remainingToBill,
      totalBackCharges,
      pendingBills,
      paidBills,
    };
  }, [purchaseOrders, bills, backCharges]);

  const recentPOs = useMemo(
    () => purchaseOrders?.slice(0, 5) ?? [],
    [purchaseOrders]
  );

  const recentBills = useMemo(
    () => bills?.slice(0, 5) ?? [],
    [bills]
  );

  const poColumns: Column<SubcontractorPurchaseOrder>[] = useMemo(
    () => [
      { key: "number", header: "PO #" },
      { key: "project_name", header: "Project" },
      {
        key: "status",
        header: "Status",
        render: (po) => <StatusBadge status={po.status as any} />,
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

  const billColumns: Column<SubcontractorBill>[] = useMemo(
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
        title="Subcontractor Dashboard"
        description="View your purchase orders, back charges, and billing status."
        keywords="subcontractor portal, purchase orders, billing, back charges"
      />
      <SubcontractorPortalLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground">View your POs, billing progress, and back charges.</p>
            </div>
            <Button
              onClick={() => navigate("/subcontractor/bills/new")}
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
            {/* Stats */}
            <div className="grid gap-3 sm:gap-6 grid-cols-2 md:grid-cols-5 mb-4 sm:mb-8">
              <div className="cursor-pointer" onClick={() => navigate("/subcontractor/completions")}>
                <StatCard
                  title="My Rooms"
                  value={roomsLoading ? "..." : rooms?.length ?? 0}
                  change="Assigned units"
                  changeType="neutral"
                  icon={Building2}
                />
              </div>
              <StatCard
                title="Open POs"
                value={isLoading ? "..." : stats.openPOs}
                change={`${purchaseOrders?.length ?? 0} total POs`}
                changeType="neutral"
                icon={ClipboardList}
              />
              <StatCard
                title="Contract Value"
                value={isLoading ? "..." : formatCurrency(stats.totalContractValue)}
                change={`Billed ${formatCurrency(stats.billedToDate)}`}
                changeType="positive"
                icon={DollarSign}
              />
              <StatCard
                title="Remaining to Bill"
                value={isLoading ? "..." : formatCurrency(stats.remainingToBill)}
                change="Based on approved POs"
                changeType="neutral"
                icon={FileText}
              />
              <StatCard
                title="Back Charges"
                value={isLoading ? "..." : formatCurrency(stats.totalBackCharges)}
                change={stats.totalBackCharges > 0 ? "Applied to POs" : "No back charges"}
                changeType={stats.totalBackCharges > 0 ? "negative" : "neutral"}
                icon={AlertTriangle}
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
                    onClick={() => navigate("/subcontractor/purchase-orders")}
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
                        onClick={() => navigate(`/subcontractor/purchase-orders/${po.id}`)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-medium text-foreground">{po.number}</span>
                            <p className="text-sm text-muted-foreground">{po.project_name}</p>
                          </div>
                          <StatusBadge status={po.status as any} />
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">
                            Remaining: {formatCurrency(po.remaining_to_bill ?? 0)}
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
                    onRowClick={(po) => navigate(`/subcontractor/purchase-orders/${po.id}`)}
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
                    onClick={() => navigate("/subcontractor/bills")}
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
                        onClick={() => navigate(`/subcontractor/bills/${bill.id}`)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-medium text-foreground">{bill.number}</span>
                            <p className="text-sm text-muted-foreground">PO: {bill.po_number}</p>
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
                    onRowClick={(bill) => navigate(`/subcontractor/bills/${bill.id}`)}
                  />
                )}
              </div>
            </div>
          </PullToRefreshWrapper>
        </div>
      </SubcontractorPortalLayout>
    </>
  );
}
