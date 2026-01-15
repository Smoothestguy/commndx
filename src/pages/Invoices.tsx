import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import {
  EnhancedDataTable,
  EnhancedColumn,
} from "@/components/shared/EnhancedDataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Eye,
  Receipt,
  Clock,
  CheckCircle,
  DollarSign,
  Wallet,
  TrendingUp,
  AlertCircle,
  CreditCard,
} from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { useInvoices } from "@/integrations/supabase/hooks/useInvoices";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { InvoiceCard } from "@/components/invoices/InvoiceCard";
import { InvoiceEmptyState } from "@/components/invoices/InvoiceEmptyState";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuickBooksConfig } from "@/integrations/supabase/hooks/useQuickBooks";
import { Invoice } from "@/integrations/supabase/hooks/useInvoices";
import { InvoiceStatCard } from "@/components/invoices/InvoiceStatCard";
import { BulkPaymentDialog } from "@/components/invoices/BulkPaymentDialog";
import { TablePagination } from "@/components/shared/TablePagination";

type CardFilter =
  | "all"
  | "paid"
  | "outstanding"
  | "overdue"
  | "partial"
  | "pending";

// Format large currency values as abbreviated (e.g., $4.9M)
const formatCompactCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 100000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
};

const Invoices = () => {
  const navigate = useNavigate();
  const {
    data: allInvoices = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useInvoices();
  const { data: customers } = useCustomers();
  const isMobile = useIsMobile();
  const { data: qbConfig } = useQuickBooksConfig();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<CardFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPaymentOpen, setBulkPaymentOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Count selected invoices with outstanding balance
  const selectedWithBalance = useMemo(() => {
    return allInvoices.filter(
      (inv) => selectedIds.has(inv.id) && (inv.remaining_amount || 0) > 0
    ).length;
  }, [allInvoices, selectedIds]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!allInvoices)
      return {
        total: 0,
        received: 0,
        outstanding: 0,
        overdue: 0,
        partial: 0,
        pending: 0,
      };

    return allInvoices.reduce(
      (acc, inv) => {
        acc.total += inv.total || 0;
        acc.received += inv.paid_amount || 0;
        acc.outstanding += inv.remaining_amount || 0;

        if (inv.status === "overdue") acc.overdue++;
        if (inv.status === "partially_paid") acc.partial++;
        if (inv.status === "sent" || inv.status === "draft") acc.pending++;

        return acc;
      },
      {
        total: 0,
        received: 0,
        outstanding: 0,
        overdue: 0,
        partial: 0,
        pending: 0,
      }
    );
  }, [allInvoices]);

  // Filter invoices based on active card filter
  const filteredInvoices = useMemo(() => {
    if (!allInvoices) return [];

    let filtered = allInvoices;

    // Apply card filter
    switch (activeFilter) {
      case "paid":
        filtered = filtered.filter((inv) => inv.status === "paid");
        break;
      case "outstanding":
        filtered = filtered.filter((inv) => (inv.remaining_amount || 0) > 0);
        break;
      case "overdue":
        filtered = filtered.filter((inv) => inv.status === "overdue");
        break;
      case "partial":
        filtered = filtered.filter((inv) => inv.status === "partially_paid");
        break;
      case "pending":
        filtered = filtered.filter(
          (inv) => inv.status === "sent" || inv.status === "draft"
        );
        break;
      default:
        break;
    }

    // Apply search filter
    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (inv) =>
          inv.number?.toLowerCase().includes(query) ||
          inv.customer_name?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allInvoices, activeFilter, search]);

  const hasActiveFilters = activeFilter !== "all" || !!search;

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
      render: (item) =>
        item.project_name || <span className="text-muted-foreground">-</span>,
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
      key: "paid_amount",
      header: "Paid",
      sortable: true,
      filterable: false,
      getValue: (item) => item.paid_amount || 0,
      render: (item) => (
        <span className="text-green-600 dark:text-green-400">
          $
          {(item.paid_amount || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: "remaining_amount",
      header: "Balance",
      sortable: true,
      filterable: false,
      getValue: (item) => item.remaining_amount || 0,
      render: (item) => (
        <span
          className={
            item.remaining_amount > 0
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground"
          }
        >
          $
          {(item.remaining_amount || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
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
        <div className="text-destructive">
          Error loading invoices: {error.message}
        </div>
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
          <div className="flex items-center gap-2">
            {/* Search in header - responsive width */}
            <div className="hidden sm:block w-48 md:w-64 lg:w-80">
              <SearchInput
                placeholder="Search invoices..."
                value={search}
                onChange={setSearch}
                className="h-9 bg-secondary border-border"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/invoices/new-from-time")}
              className="hidden md:flex"
            >
              <Clock className="mr-2 h-4 w-4" />
              From Time
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/invoices/new-from-time")}
              className="md:hidden"
            >
              <Clock className="h-4 w-4" />
            </Button>
            <Button variant="glow" size="sm" onClick={() => navigate("/invoices/new")}>
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">New Invoice</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        }
      >
        <PullToRefreshWrapper onRefresh={refetch} isRefreshing={isFetching}>
          {/* Mobile-only search */}
          <div className="sm:hidden mb-4">
            <SearchInput
              placeholder="Search invoices..."
              value={search}
              onChange={setSearch}
              className="bg-secondary border-border"
            />
          </div>

          {/* QuickBooks Auto-Sync Notice */}
          {qbConfig?.is_connected && (
            <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>
                  Auto-sync enabled: New invoices will automatically sync to
                  QuickBooks
                </span>
              </div>
            </div>
          )}

          {/* Clickable Stat Card Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4 mb-6">
            <InvoiceStatCard
              label="Total Invoiced"
              value={formatCompactCurrency(stats.total)}
              icon={DollarSign}
              isActive={activeFilter === "all"}
              onClick={() => setActiveFilter("all")}
            />
            <InvoiceStatCard
              label="Payment Received"
              value={formatCompactCurrency(stats.received)}
              icon={Wallet}
              variant="success"
              isActive={activeFilter === "paid"}
              onClick={() => setActiveFilter("paid")}
            />
            <InvoiceStatCard
              label="Outstanding Balance"
              value={formatCompactCurrency(stats.outstanding)}
              icon={TrendingUp}
              variant="warning"
              isActive={activeFilter === "outstanding"}
              onClick={() => setActiveFilter("outstanding")}
            />
            <InvoiceStatCard
              label="Pending"
              value={stats.pending.toString()}
              icon={Clock}
              isActive={activeFilter === "pending"}
              onClick={() => setActiveFilter("pending")}
            />
            <InvoiceStatCard
              label="Partial Payments"
              value={stats.partial.toString()}
              icon={CheckCircle}
              isActive={activeFilter === "partial"}
              onClick={() => setActiveFilter("partial")}
            />
            <InvoiceStatCard
              label="Overdue"
              value={stats.overdue.toString()}
              icon={AlertCircle}
              variant="danger"
              isActive={activeFilter === "overdue"}
              onClick={() => setActiveFilter("overdue")}
            />
          </div>

          {/* Selection Actions Bar */}
          {selectedIds.size > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>
                  {selectedIds.size} invoice(s) selected
                  {selectedWithBalance > 0 && (
                    <span className="text-muted-foreground ml-1">
                      ({selectedWithBalance} with outstanding balance)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear Selection
                </Button>
                <Button
                  size="sm"
                  onClick={() => setBulkPaymentOpen(true)}
                  disabled={selectedWithBalance === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Record Payments ({selectedWithBalance})
                </Button>
              </div>
            </div>
          )}

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
                  {filteredInvoices
                    .slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
                    .map((invoice, index) => (
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
                  data={filteredInvoices.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)}
                  columns={columns}
                  onRowClick={(item) => navigate(`/invoices/${item.id}`)}
                  selectable
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                />
              )}
              <TablePagination
                currentPage={currentPage}
                totalCount={filteredInvoices.length}
                rowsPerPage={rowsPerPage}
                onPageChange={setCurrentPage}
                onRowsPerPageChange={(size) => {
                  setRowsPerPage(size);
                  setCurrentPage(1);
                }}
                rowsPerPageOptions={[10, 20, 30, 40]}
              />
            </>
          )}
        </PullToRefreshWrapper>
      </PageLayout>

      {/* Bulk Payment Dialog */}
      <BulkPaymentDialog
        open={bulkPaymentOpen}
        onOpenChange={setBulkPaymentOpen}
        invoices={allInvoices}
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds(new Set())}
      />
    </>
  );
};

export default Invoices;
