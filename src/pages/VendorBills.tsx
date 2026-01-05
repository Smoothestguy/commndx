import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Plus, Lightbulb, FileText, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { useVendorBills, VendorBillFilters as FilterType } from "@/integrations/supabase/hooks/useVendorBills";
import { VendorBillEmptyState } from "@/components/vendor-bills/VendorBillEmptyState";
import { VendorBillStatCard } from "@/components/vendor-bills/VendorBillStatCard";
import { VendorBillFilters } from "@/components/vendor-bills/VendorBillFilters";
import { VendorBillTable } from "@/components/vendor-bills/VendorBillTable";
import { SmartVendorBillDialog } from "@/components/vendor-bills/SmartVendorBillDialog";

type CardFilter = "all" | "open" | "paid" | "overdue";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export default function VendorBills() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterType>({});
  const [smartDialogOpen, setSmartDialogOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<CardFilter>("all");

  const { data: bills, isLoading } = useVendorBills(filters);

  const stats = useMemo(() => {
    if (!bills || bills.length === 0) {
      return { totalBills: 0, totalAmount: 0, openCount: 0, openAmount: 0, paidCount: 0, paidAmount: 0, overdueCount: 0 };
    }

    const now = new Date();
    let totalAmount = 0;
    let openCount = 0;
    let openAmount = 0;
    let paidCount = 0;
    let paidAmount = 0;
    let overdueCount = 0;

    bills.forEach((bill) => {
      totalAmount += bill.total;
      
      if (bill.status === "paid") {
        paidCount++;
        paidAmount += bill.total;
      } else if (bill.status === "open" || bill.status === "partially_paid") {
        openCount++;
        openAmount += bill.remaining_amount;
        
        if (new Date(bill.due_date) < now) {
          overdueCount++;
        }
      }
    });

    return { totalBills: bills.length, totalAmount, openCount, openAmount, paidCount, paidAmount, overdueCount };
  }, [bills]);

  const filteredBills = useMemo(() => {
    let filtered = bills || [];
    const now = new Date();

    switch (activeFilter) {
      case "open":
        filtered = filtered.filter(b => b.status === "open" || b.status === "partially_paid");
        break;
      case "paid":
        filtered = filtered.filter(b => b.status === "paid");
        break;
      case "overdue":
        filtered = filtered.filter(b => 
          new Date(b.due_date) < now && 
          b.status !== "paid" && b.status !== "void"
        );
        break;
    }

    return filtered.filter(bill =>
      bill.number.toLowerCase().includes(search.toLowerCase()) ||
      bill.vendor_name.toLowerCase().includes(search.toLowerCase())
    );
  }, [bills, activeFilter, search]);

  return (
    <PageLayout title="Vendor Bills" description="Track bills from vendors and suppliers">
      <div className="w-full max-w-full overflow-hidden space-y-6">
        <div className="w-full max-w-full overflow-hidden flex flex-col sm:flex-row gap-4 justify-between">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search bills..."
            className="w-full sm:w-80"
          />
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={() => setSmartDialogOpen(true)}>
              <Lightbulb className="h-4 w-4 mr-1" />
              Smart Create
            </Button>
            <Button onClick={() => navigate("/vendor-bills/new")}>
              <Plus className="h-4 w-4 mr-1" />
              New Bill
            </Button>
          </div>
        </div>

        <VendorBillFilters filters={filters} onFiltersChange={setFilters} />

        {bills && bills.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <VendorBillStatCard
              label="Total Bills"
              value={stats.totalBills}
              subValue={formatCurrency(stats.totalAmount)}
              icon={FileText}
              isActive={activeFilter === "all"}
              onClick={() => setActiveFilter("all")}
            />
            <VendorBillStatCard
              label="Open Balance"
              value={stats.openCount}
              subValue={formatCurrency(stats.openAmount)}
              icon={Clock}
              variant="warning"
              isActive={activeFilter === "open"}
              onClick={() => setActiveFilter("open")}
            />
            <VendorBillStatCard
              label="Paid"
              value={stats.paidCount}
              subValue={formatCurrency(stats.paidAmount)}
              icon={CheckCircle}
              variant="success"
              isActive={activeFilter === "paid"}
              onClick={() => setActiveFilter("paid")}
            />
            <VendorBillStatCard
              label="Overdue"
              value={stats.overdueCount}
              subValue={stats.overdueCount > 0 ? "Needs attention" : "None"}
              icon={AlertTriangle}
              variant="danger"
              isActive={activeFilter === "overdue"}
              onClick={() => setActiveFilter("overdue")}
            />
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : filteredBills.length === 0 ? (
          <VendorBillEmptyState />
        ) : (
          <VendorBillTable bills={filteredBills} />
        )}
      </div>

      <SmartVendorBillDialog open={smartDialogOpen} onOpenChange={setSmartDialogOpen} />
    </PageLayout>
  );
}
