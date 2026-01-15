import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { EnhancedDataTable, EnhancedColumn } from "@/components/shared/EnhancedDataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2, FolderOpen, Loader2, Cloud, RefreshCw } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { CustomerCard } from "@/components/customers/CustomerCard";
import { CustomerStats } from "@/components/customers/CustomerStats";
import { CustomerEmptyState } from "@/components/customers/CustomerEmptyState";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCustomers, useAddCustomer, useUpdateCustomer, useDeleteCustomer, Customer } from "@/integrations/supabase/hooks/useCustomers";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useQuickBooksConfig, useImportCustomersFromQB, useExportCustomersToQB } from "@/integrations/supabase/hooks/useQuickBooks";
import { TablePagination } from "@/components/shared/TablePagination";

const Customers = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: customers, isLoading, error, refetch, isFetching } = useCustomers();
  const { data: projects } = useProjects();
  const addCustomer = useAddCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const isMobile = useIsMobile();
  
  // QuickBooks hooks
  const { data: qbConfig } = useQuickBooksConfig();
  const importCustomers = useImportCustomersFromQB();
  const exportCustomers = useExportCustomersToQB();
  
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    jobsite_address: "",
    customer_type: "commercial" as "residential" | "commercial" | "government" | "non_profit" | "other",
    notes: "",
    tax_exempt: false,
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const filteredCustomers = customers?.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.company && c.company.toLowerCase().includes(search.toLowerCase())) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  ) || [];

  // Calculate stats
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const total = customers?.length || 0;
  const withProjects = customers?.filter(
    (c) => projects?.some((p) => p.customer_id === c.id)
  ).length || 0;
  const newThisMonth = customers?.filter(
    (c) => new Date(c.created_at) >= firstDayOfMonth
  ).length || 0;
  const noProjects = total - withProjects;

  const columns: EnhancedColumn<Customer>[] = [
    { 
      key: "company", 
      header: "Company / Name", 
      sortable: true, 
      filterable: true,
      render: (item: Customer) => (
        <div className="flex flex-col">
          <span className="font-medium">{item.company || item.name}</span>
          {item.company && item.name && item.company !== item.name && (
            <span className="text-xs text-muted-foreground">{item.name}</span>
          )}
        </div>
      ),
    },
    { key: "email", header: "Email", sortable: true, filterable: true },
    { key: "phone", header: "Phone", sortable: true, filterable: true },
    {
      key: "projects",
      header: "Projects",
      sortable: false,
      filterable: false,
      render: (item: Customer) => {
        const projectCount = projects?.filter(p => p.customer_id === item.id).length || 0;
        return (
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {projectCount} {projectCount === 1 ? "project" : "projects"}
            </span>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      sortable: false,
      filterable: false,
      render: (item: Customer) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(item);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(item.id);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone || "",
      company: customer.company || "",
      address: customer.address || "",
      jobsite_address: customer.jobsite_address || "",
      customer_type: "commercial",
      notes: "",
      tax_exempt: customer.tax_exempt || false,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteCustomer.mutate(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingCustomer) {
      await updateCustomer.mutateAsync({
        id: editingCustomer.id,
        ...formData,
      });
    } else {
      await addCustomer.mutateAsync(formData);
    }

    setIsDialogOpen(false);
    setEditingCustomer(null);
    setFormData({ 
      name: "", 
      email: "", 
      phone: "", 
      company: "", 
      address: "", 
      jobsite_address: "",
      customer_type: "commercial",
      notes: "",
      tax_exempt: false,
    });
  };

  const openNewDialog = () => {
    setEditingCustomer(null);
    setFormData({ 
      name: "", 
      email: "", 
      phone: "", 
      company: "", 
      address: "", 
      jobsite_address: "",
      customer_type: "commercial",
      notes: "",
      tax_exempt: false,
    });
    setIsDialogOpen(true);
  };

  // Handle ?action=add query param to open dialog
  useEffect(() => {
    if (searchParams.get("action") === "add") {
      openNewDialog();
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <>
      <SEO 
        title="Customers"
        description="View and manage your customer database with Command X"
        keywords="customer management, customer database, customer contacts, CRM"
      />
      <PageLayout
      title="Customers"
      description="Manage your customers and their projects"
      actions={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="w-full sm:w-48 md:w-56 lg:w-64 order-2 sm:order-1">
            <SearchInput
              placeholder="Search customers..."
              value={search}
              onChange={setSearch}
              className="bg-secondary border-border"
            />
          </div>
          <Button variant="glow" onClick={openNewDialog} className="order-1 sm:order-2 shrink-0">
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        </div>
      }
    >
      <PullToRefreshWrapper onRefresh={refetch} isRefreshing={isFetching}>
        {/* Stats */}
        <CustomerStats
          total={total}
          withProjects={withProjects}
          newThisMonth={newThisMonth}
          noProjects={noProjects}
        />

        {/* QuickBooks Sync Section */}
        {qbConfig?.is_connected && (
          <div className="mb-6 p-3 md:p-4 rounded-lg border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Cloud className="h-5 w-5 text-green-500" />
                <p className="font-medium text-sm">QuickBooks Connected</p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => importCustomers.mutate()}
                  disabled={importCustomers.isPending || exportCustomers.isPending}
                >
                  {importCustomers.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Cloud className="h-4 w-4 mr-1" />
                  )}
                  Import
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => exportCustomers.mutate()}
                  disabled={importCustomers.isPending || exportCustomers.isPending}
                >
                  {exportCustomers.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Cloud className="h-4 w-4 mr-1" />
                  )}
                  Export
                </Button>
              </div>
            </div>
          </div>
        )}


        {/* Loading & Error States */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        {error && (
          <div className="text-center py-12 text-destructive">
            Error loading customers: {error.message}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredCustomers.length === 0 && (
          <CustomerEmptyState 
            onAddCustomer={openNewDialog} 
            isFiltered={!!search}
          />
        )}

        {/* Customers - Responsive Layout using CSS show/hide for instant switching */}
        {!isLoading && !error && filteredCustomers.length > 0 && (
          <>
            {/* Mobile Cards - hidden on md+ */}
            <div className="block md:hidden">
              <div className="grid gap-4">
                {filteredCustomers
                  .slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
                  .map((customer) => {
                    const projectCount = projects?.filter(p => p.customer_id === customer.id).length || 0;
                    return (
                      <CustomerCard
                        key={customer.id}
                        customer={customer}
                        projectCount={projectCount}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    );
                  })}
              </div>
            </div>
            {/* Desktop Table - hidden below md */}
            <div className="hidden md:block">
              <EnhancedDataTable 
                tableId="customers"
                data={filteredCustomers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)} 
                columns={columns}
                onRowClick={(customer) => navigate(`/customers/${customer.id}`)}
              />
            </div>
            {/* Pagination */}
            <TablePagination
              currentPage={currentPage}
              totalCount={filteredCustomers.length}
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

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingCustomer ? "Edit Customer" : "Add New Customer"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Contact Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  required
                  className="bg-secondary border-border"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-secondary border-border"
                />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-type">Customer Type</Label>
              <Select
                value={formData.customer_type}
                onValueChange={(value) => setFormData({ ...formData, customer_type: value as any })}
              >
                <SelectTrigger id="customer-type" className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="government">Government</SelectItem>
                  <SelectItem value="non_profit">Non-Profit</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-secondary border-border"
                rows={3}
              />
            </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Billing Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobsite_address">Jobsite / Delivery Address</Label>
              <Textarea
                id="jobsite_address"
                value={formData.jobsite_address}
                onChange={(e) => setFormData({ ...formData, jobsite_address: e.target.value })}
                className="bg-secondary border-border"
                rows={2}
                placeholder="Default delivery location for materials and equipment"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="tax-exempt">Tax Exempt</Label>
                <p className="text-sm text-muted-foreground">
                  No tax will be applied to estimates for this customer
                </p>
              </div>
              <Switch
                id="tax-exempt"
                checked={formData.tax_exempt}
                onCheckedChange={(checked) => setFormData({ ...formData, tax_exempt: checked })}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="glow">
                {editingCustomer ? "Save Changes" : "Add Customer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
    </>
  );
};

export default Customers;
