import { useParams, useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Edit,
  Mail,
  Phone,
  Building2,
  MapPin,
  FolderOpen,
  FileText,
  Receipt,
  DollarSign,
  Activity,
  Loader2,
  ExternalLink,
  User,
} from "lucide-react";
import { useCustomers, useUpdateCustomer, Customer } from "@/integrations/supabase/hooks/useCustomers";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useEstimates } from "@/integrations/supabase/hooks/useEstimates";
import { useInvoices } from "@/integrations/supabase/hooks/useInvoices";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { getCustomerDisplayName, getCustomerSecondaryName } from "@/utils/customerDisplayName";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/20 text-blue-400",
  pending: "bg-yellow-500/20 text-yellow-400",
  approved: "bg-green-500/20 text-green-400",
  rejected: "bg-destructive/20 text-destructive",
  converted: "bg-primary/20 text-primary",
  expired: "bg-muted text-muted-foreground",
  paid: "bg-green-500/20 text-green-400",
  partial: "bg-yellow-500/20 text-yellow-400",
  overdue: "bg-destructive/20 text-destructive",
  active: "bg-green-500/20 text-green-400",
  completed: "bg-blue-500/20 text-blue-400",
  on_hold: "bg-yellow-500/20 text-yellow-400",
};

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const { data: customers, isLoading } = useCustomers();
  const { data: projects } = useProjects();
  const { data: estimates } = useEstimates();
  const { data: invoices } = useInvoices();
  const updateCustomer = useUpdateCustomer();
  
  const customer = customers?.find((c) => c.id === id);
  
  // Filter related data
  const customerProjects = projects?.filter((p) => p.customer_id === id) || [];
  const customerEstimates = estimates?.filter((e) => e.customer_id === id) || [];
  const customerInvoices = invoices?.filter((i) => i.customer_id === id) || [];
  
  // Calculate stats
  const totalProjects = customerProjects.length;
  const activeProjects = customerProjects.filter((p) => p.status === "active").length;
  const totalRevenue = customerInvoices.reduce((sum, i) => sum + (i.paid_amount || 0), 0);
  const outstandingBalance = customerInvoices.reduce((sum, i) => sum + (i.remaining_amount || 0), 0);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    jobsite_address: "",
    tax_exempt: false,
  });
  
  const handleEdit = () => {
    if (customer) {
      setFormData({
        name: customer.name,
        email: customer.email,
        phone: customer.phone || "",
        company: customer.company || "",
        address: customer.address || "",
        jobsite_address: customer.jobsite_address || "",
        tax_exempt: customer.tax_exempt || false,
      });
      setIsEditDialogOpen(true);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customer) {
      await updateCustomer.mutateAsync({
        id: customer.id,
        ...formData,
      });
      setIsEditDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <PageLayout title="Customer Details">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  if (!customer) {
    return (
      <PageLayout title="Customer Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">The requested customer could not be found.</p>
          <Button onClick={() => navigate("/customers")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Customers
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <>
      <SEO 
        title={`${getCustomerDisplayName(customer)} - Customer Details`}
        description={`View details for ${getCustomerDisplayName(customer)}`}
      />
      <PageLayout
        title=""
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/customers")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button variant="glow" onClick={handleEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        }
      >
        {/* Header Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-heading font-bold">{getCustomerDisplayName(customer)}</h1>
                  {customer.tax_exempt && (
                    <Badge variant="secondary">Tax Exempt</Badge>
                  )}
                </div>
                
                {getCustomerSecondaryName(customer) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{getCustomerSecondaryName(customer)}</span>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${customer.email}`} className="hover:text-primary">
                      {customer.email}
                    </a>
                  </div>
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${customer.phone}`} className="hover:text-primary">
                        {customer.phone}
                      </a>
                    </div>
                  )}
                </div>
                
                {customer.address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{customer.address}</span>
                  </div>
                )}
              </div>
              
              <div className="text-right text-sm text-muted-foreground">
                <p>Customer since</p>
                <p className="font-medium text-foreground">
                  {format(new Date(customer.created_at), "MMMM d, yyyy")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FolderOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalProjects}</p>
                  <p className="text-xs text-muted-foreground">Total Projects</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Activity className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeProjects}</p>
                  <p className="text-xs text-muted-foreground">Active Projects</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Receipt className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(outstandingBalance)}</p>
                  <p className="text-xs text-muted-foreground">Outstanding</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="projects" className="space-y-4">
          <TabsList>
            <TabsTrigger value="projects" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              Projects ({customerProjects.length})
            </TabsTrigger>
            <TabsTrigger value="estimates" className="gap-2">
              <FileText className="h-4 w-4" />
              Estimates ({customerEstimates.length})
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2">
              <Receipt className="h-4 w-4" />
              Invoices ({customerInvoices.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects">
            <Card>
              <CardHeader>
                <CardTitle>Projects</CardTitle>
              </CardHeader>
              <CardContent>
                {customerProjects.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No projects yet</p>
                ) : (
                  <div className="space-y-3">
                    {customerProjects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/projects/${project.id}`)}
                      >
                        <div>
                          <p className="font-medium">{project.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {project.description || "No description"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={cn(statusColors[project.status] || "bg-muted")}>
                            {project.status}
                          </Badge>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="estimates">
            <Card>
              <CardHeader>
                <CardTitle>Estimates</CardTitle>
              </CardHeader>
              <CardContent>
                {customerEstimates.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No estimates yet</p>
                ) : (
                  <div className="space-y-3">
                    {customerEstimates.map((estimate) => (
                      <div
                        key={estimate.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/estimates/${estimate.id}`)}
                      >
                        <div>
                          <p className="font-medium">{estimate.number}</p>
                          <p className="text-sm text-muted-foreground">
                            Valid until {format(new Date(estimate.valid_until), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{formatCurrency(estimate.total)}</span>
                          <Badge className={cn(statusColors[estimate.status] || "bg-muted")}>
                            {estimate.status}
                          </Badge>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                {customerInvoices.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No invoices yet</p>
                ) : (
                  <div className="space-y-3">
                    {customerInvoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                      >
                        <div>
                          <p className="font-medium">{invoice.number}</p>
                          <p className="text-sm text-muted-foreground">
                            Due {format(new Date(invoice.due_date), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(invoice.total)}</p>
                            {invoice.remaining_amount > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(invoice.remaining_amount)} due
                              </p>
                            )}
                          </div>
                          <Badge className={cn(statusColors[invoice.status] || "bg-muted")}>
                            {invoice.status}
                          </Badge>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">Edit Customer</DialogTitle>
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
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="tax-exempt">Tax Exempt</Label>
                  <p className="text-sm text-muted-foreground">
                    No tax will be applied to estimates
                  </p>
                </div>
                <Switch
                  id="tax-exempt"
                  checked={formData.tax_exempt}
                  onCheckedChange={(checked) => setFormData({ ...formData, tax_exempt: checked })}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="glow" disabled={updateCustomer.isPending}>
                  {updateCustomer.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageLayout>
    </>
  );
}
