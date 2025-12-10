import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Eye, Receipt, Clock, Cloud, CheckCircle } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { useInvoices } from "@/integrations/supabase/hooks/useInvoices";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { InvoiceCard } from "@/components/invoices/InvoiceCard";
import { InvoiceFilters } from "@/components/invoices/InvoiceFilters";
import { InvoiceEmptyState } from "@/components/invoices/InvoiceEmptyState";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuickBooksConfig } from "@/integrations/supabase/hooks/useQuickBooks";

const Invoices = () => {
  const navigate = useNavigate();
  const { data: allInvoices = [], isLoading, error, refetch, isFetching } = useInvoices();
  const isMobile = useIsMobile();
  const { data: qbConfig } = useQuickBooksConfig();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "sent" | "partially_paid" | "paid" | "overdue">("all");

  const filteredInvoices = allInvoices.filter((i) => {
    const matchesSearch = 
      i.number.toLowerCase().includes(search.toLowerCase()) ||
      i.customer_name.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || i.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const totalRevenue = allInvoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.total, 0);

  const pendingAmount = allInvoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + i.total, 0);

  const columns = [
    {
      key: "number",
      header: "Invoice #",
      render: (item: any) => (
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <span className="font-medium">{item.number}</span>
        </div>
      ),
    },
    { key: "customer_name", header: "Customer" },
    { key: "project_name", header: "Project" },
    {
      key: "status",
      header: "Status",
      render: (item: any) => <StatusBadge status={item.status} />,
    },
    {
      key: "total",
      header: "Amount",
      render: (item: any) => (
        <span className="font-semibold text-primary">
          ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    { 
      key: "due_date", 
      header: "Due Date",
      render: (item: any) => new Date(item.due_date).toLocaleDateString(),
    },
    {
      key: "paid_date",
      header: "Paid Date",
      render: (item: any) => item.paid_date ? new Date(item.paid_date).toLocaleDateString() : "-",
    },
    {
      key: "actions",
      header: "",
      render: (item: any) => (
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

  if (isLoading) {
    return (
      <PageLayout
        title="Invoices"
        description="Manage billing and track payments"
        actions={
          <Button variant="glow" onClick={() => navigate("/invoices/new")}>
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        }
      >
        <div>Loading invoices...</div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout
        title="Invoices"
        description="Manage billing and track payments"
        actions={
          <Button variant="glow" onClick={() => navigate("/invoices/new")}>
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        }
      >
        <div className="text-destructive">Error loading invoices: {error.message}</div>
      </PageLayout>
    );
  }

  return (
    <>
      <SEO 
        title="Invoices"
        description="Generate and track customer invoices with Command X"
        keywords="invoices, billing, payments, invoice tracking, accounts receivable"
      />
      <PageLayout
      title="Invoices"
      description="Manage billing and track payments"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/invoices/new-from-time")}>
            <Clock className="mr-2 h-4 w-4" />
            From Time
          </Button>
          <Button variant="glow" onClick={() => navigate("/invoices/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </div>
      }
    >
      <PullToRefreshWrapper onRefresh={refetch} isRefreshing={isFetching}>
        {/* QuickBooks Auto-Sync Notice */}
        {qbConfig?.is_connected && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>Auto-sync enabled: New invoices will automatically sync to QuickBooks</span>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-6 max-w-md">
          <SearchInput
            placeholder="Search invoices..."
            value={search}
            onChange={setSearch}
            className="bg-secondary border-border"
          />
        </div>

        {/* Filters */}
        <InvoiceFilters
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4 mb-6">
          <div className="glass rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-heading font-bold text-success">
              ${totalRevenue.toLocaleString()}
            </p>
          </div>
          <div className="glass rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-heading font-bold text-warning">
              ${pendingAmount.toLocaleString()}
            </p>
          </div>
          <div className="glass rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="text-2xl font-heading font-bold text-foreground">
              {allInvoices.filter((i) => i.status === "paid").length}
            </p>
          </div>
          <div className="glass rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Overdue</p>
            <p className="text-2xl font-heading font-bold text-destructive">
              {allInvoices.filter((i) => i.status === "overdue").length}
            </p>
          </div>
        </div>

        {/* Empty State */}
        {filteredInvoices.length === 0 && (
          <InvoiceEmptyState 
            onAddInvoice={() => navigate("/invoices/new")} 
            isFiltered={!!search || statusFilter !== "all"}
          />
        )}

        {/* Invoices - Responsive Layout */}
        {filteredInvoices.length > 0 && (
          <>
            {isMobile ? (
              <div className="grid gap-4">
                {filteredInvoices.map((invoice, index) => (
                  <InvoiceCard
                    key={invoice.id}
                    invoice={invoice}
                    onView={(id) => navigate(`/invoices/${id}`)}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <DataTable
                data={filteredInvoices}
                columns={columns}
                onRowClick={(item) => navigate(`/invoices/${item.id}`)}
              />
            )}
          </>
        )}
      </PullToRefreshWrapper>
    </PageLayout>
    </>
  );
};

export default Invoices;
