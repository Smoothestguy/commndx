import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Project } from "@/integrations/supabase/hooks/useProjects";

interface Customer {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  email?: string;
}

interface ProjectFormData {
  name: string;
  customer_id: string;
  status: "active" | "completed" | "on-hold";
  start_date: string;
  end_date: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  customer_po: string;
  poc_name: string;
  poc_phone: string;
  poc_email: string;
  use_customer_address: boolean;
}

interface ProjectFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: ProjectFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProjectFormData>>;
  customers: Customer[] | undefined;
  editingProject: Project | null;
  isSubmitting: boolean;
}

export const ProjectFormDialog = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  customers,
  editingProject,
  isSubmitting,
}: ProjectFormDialogProps) => {
  const selectedCustomer = customers?.find((c) => c.id === formData.customer_id);

  // Auto-fill address from customer when checkbox is checked
  useEffect(() => {
    if (formData.use_customer_address && selectedCustomer) {
      setFormData((prev) => ({
        ...prev,
        address: selectedCustomer.address || "",
        city: selectedCustomer.city || "",
        state: selectedCustomer.state || "",
        zip: selectedCustomer.zip || "",
      }));
    }
  }, [formData.use_customer_address, selectedCustomer, setFormData]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle className="font-heading">
            {editingProject ? "Edit Project" : "Add New Project"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-6">
          <form id="project-form" onSubmit={onSubmit} className="space-y-6 pb-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Basic Information</h4>
              
              <div className="space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="bg-secondary border-border"
                  placeholder="Enter project name"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer *</Label>
                  <Select
                    value={formData.customer_id}
                    onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                    required
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_po">Customer PO #</Label>
                  <Input
                    id="customer_po"
                    value={formData.customer_po}
                    onChange={(e) => setFormData({ ...formData, customer_po: e.target.value })}
                    className="bg-secondary border-border"
                    placeholder="Customer reference number"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Project Address */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground">Project Address</h4>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="use_customer_address"
                    checked={formData.use_customer_address}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, use_customer_address: checked as boolean })
                    }
                    disabled={!formData.customer_id}
                  />
                  <Label htmlFor="use_customer_address" className="text-sm cursor-pointer">
                    Same as customer
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="bg-secondary border-border"
                  placeholder="123 Main St"
                  disabled={formData.use_customer_address}
                />
              </div>

              <div className="grid gap-4 grid-cols-6">
                <div className="col-span-3 space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="bg-secondary border-border"
                    placeholder="City"
                    disabled={formData.use_customer_address}
                  />
                </div>
                <div className="col-span-1 space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="bg-secondary border-border"
                    placeholder="TX"
                    maxLength={2}
                    disabled={formData.use_customer_address}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                    className="bg-secondary border-border"
                    placeholder="12345"
                    disabled={formData.use_customer_address}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Point of Contact */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Point of Contact</h4>
              
              <div className="space-y-2">
                <Label htmlFor="poc_name">Contact Name</Label>
                <Input
                  id="poc_name"
                  value={formData.poc_name}
                  onChange={(e) => setFormData({ ...formData, poc_name: e.target.value })}
                  className="bg-secondary border-border"
                  placeholder="John Smith"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="poc_phone">Contact Phone</Label>
                  <Input
                    id="poc_phone"
                    type="tel"
                    value={formData.poc_phone}
                    onChange={(e) => setFormData({ ...formData, poc_phone: e.target.value })}
                    className="bg-secondary border-border"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="poc_email">Contact Email</Label>
                  <Input
                    id="poc_email"
                    type="email"
                    value={formData.poc_email}
                    onChange={(e) => setFormData({ ...formData, poc_email: e.target.value })}
                    className="bg-secondary border-border"
                    placeholder="john@example.com"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Schedule */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Schedule</h4>
              
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: "active" | "completed" | "on-hold") =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on-hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Description */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
              
              <div className="space-y-2">
                <Label htmlFor="description">Project Scope / Notes</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-secondary border-border min-h-[100px]"
                  placeholder="Enter project description, scope of work, or notes..."
                />
              </div>
            </div>
          </form>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="project-form" disabled={isSubmitting}>
            {editingProject ? "Update Project" : "Add Project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const initialProjectFormData: ProjectFormData = {
  name: "",
  customer_id: "",
  status: "active",
  start_date: "",
  end_date: "",
  description: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  customer_po: "",
  poc_name: "",
  poc_phone: "",
  poc_email: "",
  use_customer_address: false,
};

export type { ProjectFormData };
