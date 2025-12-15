import { useState, useMemo } from "react";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/StatCard";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Eye, FileText, DollarSign, ClipboardList, ListChecks, ArrowLeft, CheckCircle2, XCircle, Building2, ChevronDown, ChevronUp } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { POPreviewDialog } from "@/components/admin/POPreviewDialog";
import { BillPreviewDialog } from "@/components/admin/BillPreviewDialog";
import { UserActivityHistory } from "@/components/admin/UserActivityHistory";
import { useUserActivityLogs } from "@/integrations/supabase/hooks/useUserActivityLogs";

interface POData {
  id: string;
  number: string;
  project_name: string;
  status: string;
  subtotal: number;
  total: number;
  total_addendum_amount: number;
  billed_amount: number | null;
}

interface BillData {
  id: string;
  number: string;
  status: string;
  total: number;
  bill_date: string;
  submitted_at: string | null;
  po_number: string;
}

export default function VendorPortalPreview() {
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [showAllPOs, setShowAllPOs] = useState(false);
  const [showAllBills, setShowAllBills] = useState(false);
  const [selectedPO, setSelectedPO] = useState<POData | null>(null);
  const [selectedBill, setSelectedBill] = useState<BillData | null>(null);
  const navigate = useNavigate();
  
  const { data: vendors, isLoading: vendorsLoading } = useVendors();

  // Fetch POs for selected vendor
  const { data: purchaseOrders, isLoading: posLoading } = useQuery({
    queryKey: ["admin-preview-vendor-pos", selectedVendorId],
    queryFn: async () => {
      if (!selectedVendorId) return [];
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          id,
          number,
          project_name,
          status,
          subtotal,
          total,
          total_addendum_amount,
          billed_amount
        `)
        .eq("vendor_id", selectedVendorId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []) as POData[];
    },
    enabled: !!selectedVendorId,
  });

  // Fetch bills for selected vendor
  const { data: bills, isLoading: billsLoading } = useQuery({
    queryKey: ["admin-preview-vendor-bills", selectedVendorId],
    queryFn: async () => {
      if (!selectedVendorId) return [];
      const { data, error } = await supabase
        .from("vendor_bills")
        .select(`
          id,
          number,
          status,
          total,
          bill_date,
          submitted_at,
          purchase_orders(number)
        `)
        .eq("vendor_id", selectedVendorId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []).map(bill => ({
        id: bill.id,
        number: bill.number,
        status: bill.status,
        total: bill.total,
        bill_date: bill.bill_date,
        submitted_at: bill.submitted_at,
        po_number: (bill.purchase_orders as any)?.number || "N/A"
      })) as BillData[];
    },
    enabled: !!selectedVendorId,
  });

  const selectedVendor = vendors?.find(v => v.id === selectedVendorId);

  // Fetch activity logs for selected vendor
  const { data: activityLogs, isLoading: activityLoading } = useUserActivityLogs({
    userId: selectedVendor?.user_id || undefined,
    vendorId: selectedVendorId || undefined,
  });

  const isLoading = posLoading || billsLoading;

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

    // Revised total = total + addendum amount
    const totalContractValue = purchaseOrders.reduce(
      (sum, po) => sum + (po.total || 0) + (po.total_addendum_amount || 0),
      0
    );

    const billedToDate = purchaseOrders.reduce(
      (sum, po) => sum + (po.billed_amount ?? 0),
      0
    );

    const remainingToBill = totalContractValue - billedToDate;

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

  const poColumns: Column<POData>[] = useMemo(
    () => [
      { key: "number", header: "PO #" },
      { key: "project_name", header: "Project" },
      {
        key: "status",
        header: "Status",
        render: (po) => <StatusBadge status={po.status as any} />,
      },
      {
        key: "total",
        header: "Total",
        render: (po) => (
          <span className="font-medium">
            {formatCurrency((po.total || 0) + (po.total_addendum_amount || 0))}
          </span>
        ),
      },
      {
        key: "billed_amount",
        header: "Billed",
        render: (po) => (
          <span className="text-primary font-semibold">
            {formatCurrency(po.billed_amount || 0)}
          </span>
        ),
      },
    ],
    []
  );

  const billColumns: Column<BillData>[] = useMemo(
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

  const displayedPOs = showAllPOs ? purchaseOrders : purchaseOrders?.slice(0, 5);
  const displayedBills = showAllBills ? bills : bills?.slice(0, 5);

  return (
    <>
      <SEO
        title="Vendor Portal Preview"
        description="Preview what vendors see in their portal"
      />
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/vendors">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Eye className="h-6 w-6" />
              Vendor Portal Preview
            </h1>
            <p className="text-muted-foreground">
              View what vendors see when they log into their portal
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Vendor</CardTitle>
            <CardDescription>
              Choose a vendor to preview their portal experience
            </CardDescription>
          </CardHeader>
          <CardContent>
            {vendorsLoading ? (
              <Skeleton className="h-10 w-full max-w-md" />
            ) : (
              <>
                <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue placeholder="Select a vendor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors?.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        <div className="flex items-center gap-2">
                          {vendor.user_id ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span>{vendor.name}</span>
                          {vendor.email && <span className="text-muted-foreground">({vendor.email})</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" /> Has account
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-muted-foreground" /> No account
                  </span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {selectedVendorId && selectedVendor && (
          <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 space-y-6">
            <Alert className={selectedVendor.user_id ? "border-green-500/50" : "border-amber-500/50"}>
              <Eye className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-1">
                <span>
                  You are previewing the portal as <strong>{selectedVendor.name}</strong>.
                </span>
                {selectedVendor.user_id ? (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    This vendor has portal access ({selectedVendor.email})
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <XCircle className="h-3 w-3" />
                    This vendor has not created an account yet
                  </span>
                )}
              </AlertDescription>
            </Alert>

            {/* Vendor Dashboard Preview */}
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Dashboard</h2>
                  <p className="text-muted-foreground">
                    See your POs, billing progress, and submit bills.
                  </p>
                </div>
                {/* Admin Quick Action - Only this navigates away */}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/vendors/${selectedVendorId}`)}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  View Vendor Record (Admin)
                </Button>
              </div>

              {/* Stats - Now with inline toggle actions */}
              <div className="grid gap-3 sm:gap-6 grid-cols-2 md:grid-cols-4">
                <div 
                  className="cursor-pointer" 
                  onClick={() => setShowAllPOs(!showAllPOs)}
                >
                  <StatCard
                    title="Open POs"
                    value={isLoading ? "..." : stats.openPOs}
                    change={`Click to ${showAllPOs ? "collapse" : "expand"}`}
                    changeType="neutral"
                    icon={ClipboardList}
                  />
                </div>
                <StatCard
                  title="Contract Value"
                  value={isLoading ? "..." : formatCurrency(stats.totalContractValue)}
                  change={`Billed ${formatCurrency(stats.billedToDate)}`}
                  changeType="positive"
                  icon={DollarSign}
                />
                <div 
                  className="cursor-pointer" 
                  onClick={() => setShowAllBills(!showAllBills)}
                >
                  <StatCard
                    title="Remaining to Bill"
                    value={isLoading ? "..." : formatCurrency(stats.remainingToBill)}
                    change={`Click to ${showAllBills ? "collapse" : "expand"} bills`}
                    changeType="neutral"
                    icon={ListChecks}
                  />
                </div>
                <div 
                  className="cursor-pointer" 
                  onClick={() => setShowAllBills(!showAllBills)}
                >
                  <StatCard
                    title="Pending Bills"
                    value={isLoading ? "..." : stats.pendingBills}
                    change={stats.approvedBills > 0 ? `${stats.approvedBills} paid` : "No paid bills yet"}
                    changeType="neutral"
                    icon={FileText}
                  />
                </div>
              </div>

              {/* Recent POs + Bills - Self-contained with dialogs */}
              <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Purchase Orders</h3>
                    {(purchaseOrders?.length || 0) > 5 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowAllPOs(!showAllPOs)}
                      >
                        {showAllPOs ? "Show Less" : `View All (${purchaseOrders?.length})`}
                        {showAllPOs ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                      </Button>
                    )}
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-32" />
                  ) : purchaseOrders?.length === 0 ? (
                    <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                      No POs assigned to this vendor.
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <DataTable 
                        data={displayedPOs || []} 
                        columns={poColumns} 
                        onRowClick={(po) => setSelectedPO(po)}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Bills</h3>
                    {(bills?.length || 0) > 5 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowAllBills(!showAllBills)}
                      >
                        {showAllBills ? "Show Less" : `View All (${bills?.length})`}
                        {showAllBills ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                      </Button>
                    )}
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-32" />
                  ) : bills?.length === 0 ? (
                    <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                      No bills submitted by this vendor.
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <DataTable 
                        data={displayedBills || []} 
                        columns={billColumns} 
                        onRowClick={(bill) => setSelectedBill(bill)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Activity History */}
              <UserActivityHistory
                logs={activityLogs}
                isLoading={activityLoading}
                title="Activity History"
                description={`All actions by or related to ${selectedVendor.name}`}
                maxHeight="350px"
              />
            </div>
          </div>
        )}

        {!selectedVendorId && (
          <div className="text-center py-12 text-muted-foreground">
            Select a vendor above to preview their portal experience
          </div>
        )}
      </div>

      {/* Detail Dialogs */}
      <POPreviewDialog
        po={selectedPO}
        open={!!selectedPO}
        onClose={() => setSelectedPO(null)}
      />
      <BillPreviewDialog
        bill={selectedBill}
        open={!!selectedBill}
        onClose={() => setSelectedBill(null)}
      />
    </>
  );
}
