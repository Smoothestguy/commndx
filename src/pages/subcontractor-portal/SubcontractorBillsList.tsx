import { SEO } from "@/components/SEO";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubcontractorPortalLayout } from "@/components/subcontractor-portal/SubcontractorPortalLayout";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/utils";
import { formatLocalDate } from "@/lib/dateUtils";
import { FileText, Search } from "lucide-react";
import {
  useSubcontractorBills,
  SubcontractorBill,
} from "@/integrations/supabase/hooks/useSubcontractorPortal";

export default function SubcontractorBillsList() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");

  const { data: bills, isLoading } = useSubcontractorBills();

  const filteredBills = useMemo(() => {
    if (!bills) return [];
    if (!search) return bills;
    
    const lower = search.toLowerCase();
    return bills.filter(
      (bill) =>
        bill.number.toLowerCase().includes(lower) ||
        bill.po_number.toLowerCase().includes(lower)
    );
  }, [bills, search]);

  const columns: Column<SubcontractorBill>[] = useMemo(
    () => [
      { key: "number", header: "Bill #" },
      { key: "po_number", header: "PO #" },
      {
        key: "bill_date",
        header: "Date",
        render: (bill) => formatLocalDate(bill.bill_date, "MMM d, yyyy"),
      },
      {
        key: "status",
        header: "Status",
        render: (bill) => <StatusBadge status={bill.status as any} />,
      },
      {
        key: "total",
        header: "Amount",
        render: (bill) => formatCurrency(bill.total),
      },
      {
        key: "paid_amount",
        header: "Paid",
        render: (bill) => formatCurrency(bill.paid_amount || 0),
      },
      {
        key: "remaining_amount",
        header: "Remaining",
        render: (bill) => (
          <span className={bill.remaining_amount > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
            {formatCurrency(bill.remaining_amount || 0)}
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
        description="View all your submitted bills and payment status."
      />
      <SubcontractorPortalLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">My Bills</h1>
              <p className="text-muted-foreground">View all your submitted bills and track payments.</p>
            </div>
            <Button onClick={() => navigate("/subcontractor/bills/new")}>
              <FileText className="h-4 w-4 mr-2" />
              {!isMobile && "New Bill"}
            </Button>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
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
                  onClick={() => navigate(`/subcontractor/bills/${bill.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-medium text-foreground">{bill.number}</span>
                      <p className="text-sm text-muted-foreground">PO: {bill.po_number}</p>
                    </div>
                    <StatusBadge status={bill.status as any} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Total</p>
                      <p className="font-medium">{formatCurrency(bill.total)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Paid</p>
                      <p className="font-medium">{formatCurrency(bill.paid_amount || 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Due</p>
                      <p className={bill.remaining_amount > 0 ? "font-medium text-destructive" : "font-medium"}>
                        {formatCurrency(bill.remaining_amount || 0)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <DataTable
              data={filteredBills}
              columns={columns}
              onRowClick={(bill) => navigate(`/subcontractor/bills/${bill.id}`)}
            />
          )}
        </div>
      </SubcontractorPortalLayout>
    </>
  );
}
