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
import { Eye, FileText, DollarSign, ClipboardList, ListChecks, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

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
              <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Select a vendor..." />
                </SelectTrigger>
                <SelectContent>
                  {vendors?.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name} {vendor.email ? `(${vendor.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {selectedVendorId && selectedVendor && (
          <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 space-y-6">
            <Alert>
              <Eye className="h-4 w-4" />
              <AlertDescription>
                You are previewing the portal as <strong>{selectedVendor.name}</strong>. 
                This is what the vendor sees when they log in.
              </AlertDescription>
            </Alert>

            {/* Vendor Dashboard Preview */}
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">Dashboard</h2>
                <p className="text-muted-foreground">
                  See your POs, billing progress, and submit bills.
                </p>
              </div>

              {/* Stats */}
              <div className="grid gap-3 sm:gap-6 grid-cols-2 md:grid-cols-4">
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
                  change="Based on approved POs/COs"
                  changeType="neutral"
                  icon={ListChecks}
                />
                <StatCard
                  title="Pending Bills"
                  value={isLoading ? "..." : stats.pendingBills}
                  change={stats.approvedBills > 0 ? `${stats.approvedBills} paid` : "No paid bills yet"}
                  changeType="neutral"
                  icon={FileText}
                />
              </div>

              {/* Recent POs + Bills */}
              <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="font-semibold">Purchase Orders</h3>
                  {isLoading ? (
                    <Skeleton className="h-32" />
                  ) : purchaseOrders?.length === 0 ? (
                    <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                      No POs assigned to this vendor.
                    </div>
                  ) : (
                    <DataTable data={purchaseOrders?.slice(0, 5) || []} columns={poColumns} />
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Bills</h3>
                  {isLoading ? (
                    <Skeleton className="h-32" />
                  ) : bills?.length === 0 ? (
                    <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                      No bills submitted by this vendor.
                    </div>
                  ) : (
                    <DataTable data={bills?.slice(0, 5) || []} columns={billColumns} />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!selectedVendorId && (
          <div className="text-center py-12 text-muted-foreground">
            Select a vendor above to preview their portal experience
          </div>
        )}
      </div>
    </>
  );
}
