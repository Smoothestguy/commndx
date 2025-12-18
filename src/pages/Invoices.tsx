import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { EnhancedDataTable, EnhancedColumn } from "@/components/shared/EnhancedDataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Receipt, Clock, CheckCircle } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { useInvoices } from "@/integrations/supabase/hooks/useInvoices";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { InvoiceCard } from "@/components/invoices/InvoiceCard";
import { InvoiceEmptyState } from "@/components/invoices/InvoiceEmptyState";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuickBooksConfig } from "@/integrations/supabase/hooks/useQuickBooks";
import { Invoice } from "@/integrations/supabase/hooks/useInvoices";

const Invoices = () => {
  const navigate = useNavigate();
  const { data: allInvoices = [], isLoading, error, refetch, isFetching } = useInvoices();
  const { data: customers } = useCustomers();
  const isMobile = useIsMobile();
  const { data: qbConfig } = useQuickBooksConfig();
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredInvoices = useMemo(() => {
    return allInvoices.filter((i) => {
      const matchesSearch = 
        i.number.toLowerCase().includes(search.toLowerCase()) ||
        i.customer_name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || i.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [allInvoices, search, statusFilter]);

  const hasActiveFilters = statusFilter !== "all" || !!search;

  const totalRevenue = allInvoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.total, 0);

  const pendingAmount = allInvoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + i.total, 0);

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
      key: "project_name", 
      header: "Project",
      sortable: true,
      filterable: true,
      getValue: (item) => item.project_name || "",
      render: (item) => item.project_name || <span className="text-muted-foreground">-</span>,
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
      header: "Amount",
      sortable: true,
      filterable: false,
      getValue: (item) => item.total,
      render: (item) => (
        <span className="font-semibold text-primary">
          ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    { 
      key: "due_date", 
      header: "Due Date",
      sortable: true,
      filterable: false,
      getValue: (item) => item.due_date,
      render: (item) => new Date(item.due_date).toLocaleDateString(),
    },
    {
      key: "paid_date",
      header: "Paid Date",
      sortable: true,
      filterable: false,
      getValue: (item) => item.paid_date || "",
      render: (item) => item.paid_date ? new Date(item.paid_date).toLocaleDateString() : "-",
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

          {/* Search & Filter Controls */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 max-w-md">
                <SearchInput
                  placeholder="Search invoices..."
                  value={search}
                  onChange={setSearch}
                  className="bg-secondary border-border"
                />
              </div>
            </div>
          </div>

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
              isFiltered={hasActiveFilters}
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
                <EnhancedDataTable
                  tableId="invoices"
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
