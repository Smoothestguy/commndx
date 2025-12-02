import { useState } from "react";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Star, Loader2 } from "lucide-react";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { VendorCard } from "@/components/vendors/VendorCard";
import { VendorStats } from "@/components/vendors/VendorStats";
import { VendorFilters } from "@/components/vendors/VendorFilters";
import { VendorEmptyState } from "@/components/vendors/VendorEmptyState";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVendors, useAddVendor, useUpdateVendor, useDeleteVendor, Vendor } from "@/integrations/supabase/hooks/useVendors";

const Vendors = () => {
  const { data: vendors, isLoading, error, refetch, isFetching } = useVendors();
  const addVendor = useAddVendor();
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();
  const isMobile = useIsMobile();
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    specialty: "",
    status: "active" as "active" | "inactive",
    insurance_expiry: "",
    license_number: "",
    w9_on_file: false,
  });

  const filteredVendors = vendors?.filter((v) => {
    const matchesSearch = 
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.specialty && v.specialty.toLowerCase().includes(search.toLowerCase())) ||
      (v.company && v.company.toLowerCase().includes(search.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || v.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  // Calculate stats
  const total = vendors?.length || 0;
  const active = vendors?.filter((v) => v.status === "active").length || 0;
  const inactive = vendors?.filter((v) => v.status === "inactive").length || 0;
  const averageRating = vendors?.length
    ? vendors.reduce((sum, v) => sum + (v.rating || 0), 0) / vendors.filter(v => v.rating).length
    : 0;

  const columns = [
    { key: "name", header: "Vendor Name" },
    { key: "company", header: "Company" },
    { key: "specialty", header: "Specialty" },
    { key: "email", header: "Email" },
    {
      key: "rating",
      header: "Rating",
      render: (item: Vendor) => (
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 fill-warning text-warning" />
          <span className="font-medium">{item.rating ? item.rating.toFixed(1) : 'N/A'}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: Vendor) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      header: "",
      render: (item: Vendor) => (
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

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      email: vendor.email,
      phone: vendor.phone || "",
      company: vendor.company || "",
      specialty: vendor.specialty || "",
      status: vendor.status,
      insurance_expiry: vendor.insurance_expiry || "",
      license_number: vendor.license_number || "",
      w9_on_file: vendor.w9_on_file,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteVendor.mutate(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingVendor) {
      await updateVendor.mutateAsync({
        id: editingVendor.id,
        ...formData,
        insurance_expiry: formData.insurance_expiry || null,
        license_number: formData.license_number || null,
      });
    } else {
      await addVendor.mutateAsync({
        ...formData,
        rating: null,
        insurance_expiry: formData.insurance_expiry || null,
        license_number: formData.license_number || null,
      });
    }

    setIsDialogOpen(false);
    setEditingVendor(null);
    setFormData({ 
      name: "", 
      email: "", 
      phone: "", 
      company: "", 
      specialty: "", 
      status: "active", 
      insurance_expiry: "", 
      license_number: "", 
      w9_on_file: false 
    });
  };

  const openNewDialog = () => {
    setEditingVendor(null);
    setFormData({ 
      name: "", 
      email: "", 
      phone: "", 
      company: "", 
      specialty: "", 
      status: "active", 
      insurance_expiry: "", 
      license_number: "", 
      w9_on_file: false 
    });
    setIsDialogOpen(true);
  };

  return (
    <>
      <SEO 
        title="Vendors"
        description="Manage your vendor relationships and contacts with Command X"
        keywords="vendor management, vendor contacts, supplier management, vendor profiles"
      />
      <PageLayout
      title="Vendors"
      description="Manage your vendor profiles and work orders"
      actions={
        <Button variant="glow" onClick={openNewDialog}>
          <Plus className="h-4 w-4" />
          Add Vendor
        </Button>
      }
    >
      <PullToRefreshWrapper onRefresh={refetch} isRefreshing={isFetching}>
        {/* Stats */}
        <VendorStats
          total={total}
          active={active}
          inactive={inactive}
          averageRating={averageRating}
        />

        {/* Search */}
        <div className="mb-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>

        {/* Filters */}
        <VendorFilters
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />

        {/* Loading & Error States */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        {error && (
          <div className="text-center py-12 text-destructive">
            Error loading vendors: {error.message}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredVendors.length === 0 && (
          <VendorEmptyState 
            onAddVendor={openNewDialog} 
            isFiltered={!!search || statusFilter !== "all"}
          />
        )}

        {/* Vendors - Responsive Layout */}
        {!isLoading && !error && filteredVendors.length > 0 && (
          <>
            {isMobile ? (
              <div className="grid gap-4">
                {filteredVendors.map((vendor, index) => (
                  <VendorCard
                    key={vendor.id}
                    vendor={vendor}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <DataTable data={filteredVendors} columns={columns} />
            )}
          </>
        )}
      </PullToRefreshWrapper>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingVendor ? "Edit Vendor" : "Add New Vendor"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Vendor Name</Label>
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
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="specialty">Specialty</Label>
                <Input
                  id="specialty"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  placeholder="e.g., Electrical, Plumbing"
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: "active" | "inactive") =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="glow">
                {editingVendor ? "Save Changes" : "Add Vendor"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
    </>
  );
};

export default Vendors;
