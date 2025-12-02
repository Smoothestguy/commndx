import { useState } from "react";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, FolderOpen, Loader2 } from "lucide-react";
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

const Customers = () => {
  const { data: customers, isLoading, error, refetch, isFetching } = useCustomers();
  const { data: projects } = useProjects();
  const addCustomer = useAddCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const isMobile = useIsMobile();
  
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    customer_type: "commercial" as "residential" | "commercial" | "government" | "non_profit" | "other",
    notes: "",
    tax_exempt: false,
  });

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

  const columns = [
    { key: "name", header: "Contact Name" },
    { key: "company", header: "Company" },
    { key: "email", header: "Email" },
    { key: "phone", header: "Phone" },
    {
      key: "projects",
      header: "Projects",
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
      customer_type: "commercial",
      notes: "",
      tax_exempt: false,
    });
    setIsDialogOpen(true);
  };

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
        <Button variant="glow" onClick={openNewDialog}>
          <Plus className="h-4 w-4" />
          Add Customer
        </Button>
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

        {/* Search */}
        <div className="mb-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>

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

        {/* Customers - Responsive Layout */}
        {!isLoading && !error && filteredCustomers.length > 0 && (
          <>
            {isMobile ? (
              <div className="grid gap-4">
                {filteredCustomers.map((customer, index) => {
                  const projectCount = projects?.filter(p => p.customer_id === customer.id).length || 0;
                  return (
                    <CustomerCard
                      key={customer.id}
                      customer={customer}
                      projectCount={projectCount}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      index={index}
                    />
                  );
                })}
              </div>
            ) : (
              <DataTable data={filteredCustomers} columns={columns} />
            )}
          </>
        )}
      </PullToRefreshWrapper>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border">
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
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="bg-secondary border-border"
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
