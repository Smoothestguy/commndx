import { SEO } from "@/components/SEO";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VendorPortalLayout } from "@/components/vendor-portal/VendorPortalLayout";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import { FileText } from "lucide-react";
import { formatLocalDate } from "@/lib/dateUtils";
import {
  useVendorBills,
  VendorBill,
} from "@/integrations/supabase/hooks/useVendorPortal";

export default function VendorBillsList() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");

  const { data: bills, isLoading } = useVendorBills();

  const filteredBills = useMemo(() => {
    if (!bills) return [];
    if (!search) return bills;
    
    const searchLower = search.toLowerCase();
    return bills.filter(
      (bill) =>
        bill.number.toLowerCase().includes(searchLower) ||
        bill.po_number.toLowerCase().includes(searchLower)
    );
  }, [bills, search]);

  const columns: Column<VendorBill>[] = useMemo(
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
      {
        key: "bill_date",
        header: "Bill Date",
        render: (bill) => (
          <span>{formatLocalDate(bill.bill_date, "MMM d, yyyy")}</span>
        ),
      },
      {
        key: "submitted_at",
        header: "Submitted",
        render: (bill) => (
          <span>
            {bill.submitted_at
              ? formatLocalDate(bill.submitted_at, "MMM d, yyyy")
              : "—"}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <>
      <SEO
        title="My Bills"
        description="View all your submitted bills."
      />
      <VendorPortalLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">My Bills</h1>
              <p className="text-muted-foreground">View all your submitted bills and their status.</p>
            </div>
            <Button onClick={() => navigate("/vendor/bills/new")}>
              <FileText className="h-4 w-4 mr-2" />
              New Bill
            </Button>
          </div>

          <div className="max-w-sm">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search bills..."
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading bills...
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "No bills match your search." : "You haven't submitted any bills yet."}
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {filteredBills.map((bill) => (
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
                      {formatLocalDate(bill.bill_date, "MMM d, yyyy")}
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
              data={filteredBills}
              columns={columns}
              onRowClick={(bill) => navigate(`/vendor/bills/${bill.id}`)}
            />
          )}
        </div>
      </VendorPortalLayout>
    </>
  );
}
