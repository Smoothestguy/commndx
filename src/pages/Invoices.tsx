import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { DataTable, Column } from "@/components/shared/DataTable";
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
import { EnhancedFilters, FilterOption } from "@/components/shared/EnhancedFilters";
import { ColumnCustomizer, useColumnVisibility, ColumnConfig } from "@/components/shared/ColumnCustomizer";

const statusOptions: FilterOption[] = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

const sortOptions = [
  { value: "number", label: "Invoice #" },
  { value: "customer_name", label: "Customer" },
  { value: "total", label: "Amount" },
  { value: "created_at", label: "Created Date" },
  { value: "due_date", label: "Due Date" },
];

const columnConfigs: ColumnConfig[] = [
  { key: "number", label: "Invoice #" },
  { key: "customer_name", label: "Customer" },
  { key: "project_name", label: "Project" },
  { key: "status", label: "Status" },
  { key: "total", label: "Amount" },
  { key: "due_date", label: "Due Date" },
  { key: "paid_date", label: "Paid Date" },
  { key: "actions", label: "Actions" },
];

const Invoices = () => {
  const navigate = useNavigate();
  const { data: allInvoices = [], isLoading, error, refetch, isFetching } = useInvoices();
  const { data: customers } = useCustomers();
  const isMobile = useIsMobile();
  const { data: qbConfig } = useQuickBooksConfig();
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { visibleColumns, setVisibleColumns, isColumnVisible } = useColumnVisibility(
    columnConfigs,
    "invoices"
  );

  // Build customer filter options
  const customerOptions: FilterOption[] = [
    { value: "all", label: "All Customers" },
    ...(customers?.map((c) => ({ value: c.id, label: c.name })) || []),
  ];

  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = allInvoices.filter((i) => {
      const matchesSearch = 
        i.number.toLowerCase().includes(search.toLowerCase()) ||
        i.customer_name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || i.status === statusFilter;
      const matchesCustomer = customerFilter === "all" || i.customer_id === customerFilter;
      
      let matchesDate = true;
      if (dateFrom) {
        matchesDate = matchesDate && new Date(i.created_at) >= new Date(dateFrom);
      }
      if (dateTo) {
        matchesDate = matchesDate && new Date(i.created_at) <= new Date(dateTo);
      }
      
      return matchesSearch && matchesStatus && matchesCustomer && matchesDate;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "number") {
        comparison = a.number.localeCompare(b.number);
      } else if (sortBy === "customer_name") {
        comparison = a.customer_name.localeCompare(b.customer_name);
      } else if (sortBy === "total") {
        comparison = a.total - b.total;
      } else if (sortBy === "created_at") {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === "due_date") {
        comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [allInvoices, search, statusFilter, customerFilter, dateFrom, dateTo, sortBy, sortOrder]);

  const hasActiveFilters = statusFilter !== "all" || customerFilter !== "all" || !!dateFrom || !!dateTo || !!search;

  const totalRevenue = allInvoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.total, 0);

  const pendingAmount = allInvoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + i.total, 0);

  const allColumns: Column<any>[] = [
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

  const columns = allColumns.filter((col) => isColumnVisible(col.key as string));

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
              {!isMobile && (
                <div className="flex items-center gap-2">
                  <EnhancedFilters
                    statusOptions={statusOptions}
                    statusValue={statusFilter}
                    onStatusChange={setStatusFilter}
                    entityFilters={[
                      {
                        label: "Customer",
                        options: customerOptions,
                        value: customerFilter,
                        onChange: setCustomerFilter,
                      },
                    ]}
                    showDateRange
                    dateFromValue={dateFrom}
                    dateToValue={dateTo}
                    onDateFromChange={setDateFrom}
                    onDateToChange={setDateTo}
                    sortOptions={sortOptions}
                    sortValue={sortBy}
                    onSortChange={setSortBy}
                    sortOrderValue={sortOrder}
                    onSortOrderChange={setSortOrder}
                  />
                  <ColumnCustomizer
                    columns={columnConfigs}
                    visibleColumns={visibleColumns}
                    onVisibleColumnsChange={setVisibleColumns}
                    storageKey="invoices"
                  />
                </div>
              )}
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
          {filteredAndSortedInvoices.length === 0 && (
            <InvoiceEmptyState 
              onAddInvoice={() => navigate("/invoices/new")} 
              isFiltered={hasActiveFilters}
            />
          )}

          {/* Invoices - Responsive Layout */}
          {filteredAndSortedInvoices.length > 0 && (
            <>
              {isMobile ? (
                <div className="grid gap-4">
                  {filteredAndSortedInvoices.map((invoice, index) => (
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
                  data={filteredAndSortedInvoices}
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
