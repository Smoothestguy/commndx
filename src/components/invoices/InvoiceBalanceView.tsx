import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DollarSign, Receipt, TrendingUp, AlertCircle, Eye } from "lucide-react";
import { Invoice } from "@/integrations/supabase/hooks/useInvoices";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { EnhancedDataTable, EnhancedColumn } from "@/components/shared/EnhancedDataTable";
import { useIsMobile } from "@/hooks/use-mobile";

interface InvoiceBalanceViewProps {
  invoices: Invoice[];
}

export const InvoiceBalanceView = ({ invoices }: InvoiceBalanceViewProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const summaryStats = useMemo(() => {
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.remaining_amount || inv.total - (inv.paid_amount || 0)), 0);
    const partiallyPaidCount = invoices.filter(inv => 
      inv.paid_amount > 0 && inv.paid_amount < inv.total
    ).length;
    const withBalanceCount = invoices.filter(inv => 
      (inv.remaining_amount || inv.total - (inv.paid_amount || 0)) > 0
    ).length;

    return {
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      partiallyPaidCount,
      withBalanceCount,
    };
  }, [invoices]);

  // Sort by remaining balance (highest first)
  const sortedInvoices = useMemo(() => {
    return [...invoices].sort((a, b) => {
      const balanceA = a.remaining_amount || (a.total - (a.paid_amount || 0));
      const balanceB = b.remaining_amount || (b.total - (b.paid_amount || 0));
      return balanceB - balanceA;
    });
  }, [invoices]);

  const columns: EnhancedColumn<Invoice>[] = [
    {
      key: "number",
      header: "Invoice #",
      sortable: true,
      filterable: true,
      getValue: (item) => item.number,
      render: (item) => (
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <Link
            to={`/invoices/${item.id}`}
            className="font-medium text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {item.number}
          </Link>
        </div>
      ),
    },
    {
      key: "customer_name",
      header: "Customer",
      sortable: true,
      filterable: true,
      getValue: (item) => item.customer_name,
      render: (item) => (
        <Link
          to={`/customers/${item.customer_id}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {item.customer_name}
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      getValue: (item) => item.status as string,
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: "total",
      header: "Total",
      sortable: true,
      filterable: false,
      getValue: (item) => item.total,
      render: (item) => (
        <span className="font-medium">
          ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "paid_amount",
      header: "Paid",
      sortable: true,
      filterable: false,
      getValue: (item) => item.paid_amount || 0,
      render: (item) => (
        <span className="text-success">
          ${(item.paid_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "remaining_amount",
      header: "Balance",
      sortable: true,
      filterable: false,
      getValue: (item) => item.remaining_amount || (item.total - (item.paid_amount || 0)),
      render: (item) => {
        const balance = item.remaining_amount || (item.total - (item.paid_amount || 0));
        return (
          <span className={balance > 0 ? "font-semibold text-warning" : "text-muted-foreground"}>
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      key: "due_date",
      header: "Due Date",
      sortable: true,
      filterable: false,
      getValue: (item) => item.due_date,
      render: (item) => {
        const isOverdue = new Date(item.due_date) < new Date() && item.status !== "paid";
        return (
          <span className={isOverdue ? "text-destructive" : ""}>
            {new Date(item.due_date).toLocaleDateString()}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      sortable: false,
      filterable: false,
      render: (item) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/invoices/${item.id}`);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="glass rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <p className="text-sm text-muted-foreground">Total Invoiced</p>
          </div>
          <p className="text-2xl font-heading font-bold text-foreground">
            ${summaryStats.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="glass rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-success" />
            <p className="text-sm text-muted-foreground">Total Received</p>
          </div>
          <p className="text-2xl font-heading font-bold text-success">
            ${summaryStats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="glass rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-warning" />
            <p className="text-sm text-muted-foreground">Outstanding</p>
          </div>
          <p className="text-2xl font-heading font-bold text-warning">
            ${summaryStats.totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="glass rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">With Balance</p>
          </div>
          <p className="text-2xl font-heading font-bold text-foreground">
            {summaryStats.withBalanceCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {summaryStats.partiallyPaidCount} partially paid
          </p>
        </div>
      </div>

      {/* Balance Table */}
      {sortedInvoices.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No invoices found</p>
        </div>
      ) : isMobile ? (
        <div className="space-y-3">
          {sortedInvoices.map((invoice) => {
            const balance = invoice.remaining_amount || (invoice.total - (invoice.paid_amount || 0));
            return (
              <div
                key={invoice.id}
                className="glass rounded-lg p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => navigate(`/invoices/${invoice.id}`)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-primary">{invoice.number}</p>
                    <p className="text-sm text-muted-foreground">{invoice.customer_name}</p>
                  </div>
                  <StatusBadge status={invoice.status} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-medium">${invoice.total.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Paid</p>
                    <p className="text-success">${(invoice.paid_amount || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Balance</p>
                    <p className={balance > 0 ? "font-semibold text-warning" : "text-muted-foreground"}>
                      ${balance.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EnhancedDataTable
          tableId="invoice-balances"
          data={sortedInvoices}
          columns={columns}
          onRowClick={(item) => navigate(`/invoices/${item.id}`)}
        />
      )}
    </div>
  );
};
