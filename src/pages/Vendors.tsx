import { useState } from "react";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, Trash2, Loader2, Tag, X } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useVendors,
  useAddVendor,
  useUpdateVendor,
  useDeleteVendor,
  useBatchDeleteVendors,
  useBatchUpdateVendorType,
  Vendor,
  VendorType,
} from "@/integrations/supabase/hooks/useVendors";

const vendorTypeColors: Record<string, string> = {
  contractor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  personnel: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  supplier: "bg-amber-500/10 text-amber-500 border-amber-500/20",
};

const Vendors = () => {
  const { data: vendors, isLoading, error, refetch, isFetching } = useVendors();
  const addVendor = useAddVendor();
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();
  const batchDeleteVendors = useBatchDeleteVendors();
  const batchUpdateVendorType = useBatchUpdateVendorType();
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | VendorType>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  // Batch selection state
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTypeChangeDialogOpen, setIsTypeChangeDialogOpen] = useState(false);
  const [targetType, setTargetType] = useState<VendorType>("supplier");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    specialty: "",
    status: "active" as "active" | "inactive",
    vendor_type: "supplier" as VendorType,
    insurance_expiry: "",
    license_number: "",
    w9_on_file: false,
  });

  const filteredVendors =
    vendors?.filter((v) => {
      const matchesSearch =
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        (v.specialty && v.specialty.toLowerCase().includes(search.toLowerCase())) ||
        (v.company && v.company.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus = statusFilter === "all" || v.status === statusFilter;
      const matchesType = typeFilter === "all" || v.vendor_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    }) || [];

  // Calculate stats
  const total = vendors?.length || 0;
  const active = vendors?.filter((v) => v.status === "active").length || 0;
  const inactive = vendors?.filter((v) => v.status === "inactive").length || 0;

  // Selection handlers
  const handleSelectVendor = (id: string) => {
    setSelectedVendors((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedVendors.length === filteredVendors.length) {
      setSelectedVendors([]);
    } else {
      setSelectedVendors(filteredVendors.map((v) => v.id));
    }
  };

  const handleBatchDelete = async () => {
    await batchDeleteVendors.mutateAsync(selectedVendors);
    setSelectedVendors([]);
    setIsDeleteDialogOpen(false);
  };

  const handleBatchTypeChange = async () => {
    await batchUpdateVendorType.mutateAsync({ ids: selectedVendors, vendor_type: targetType });
    setSelectedVendors([]);
    setIsTypeChangeDialogOpen(false);
  };

  const columns = [
    {
      key: "select",
      header: (
        <Checkbox
          checked={filteredVendors.length > 0 && selectedVendors.length === filteredVendors.length}
          onCheckedChange={handleSelectAll}
        />
      ),
      render: (item: Vendor) => (
        <Checkbox
          checked={selectedVendors.includes(item.id)}
          onCheckedChange={() => handleSelectVendor(item.id)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      className: "w-10",
    },
    { key: "name", header: "Vendor Name" },
    { key: "company", header: "Company" },
    { key: "specialty", header: "Specialty" },
    {
      key: "vendor_type",
      header: "Type",
      render: (item: Vendor) => (
        <Badge variant="outline" className={vendorTypeColors[item.vendor_type]}>
          {item.vendor_type}
        </Badge>
      ),
    },
    { key: "email", header: "Email" },
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
      vendor_type: vendor.vendor_type,
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
      vendor_type: "supplier",
      insurance_expiry: "",
      license_number: "",
      w9_on_file: false,
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
      vendor_type: "supplier",
      insurance_expiry: "",
      license_number: "",
      w9_on_file: false,
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
          <VendorStats total={total} active={active} inactive={inactive} />

          {/* Search */}
          <div className="mb-6 max-w-md">
            <SearchInput
              placeholder="Search vendors..."
              value={search}
              onChange={setSearch}
              className="bg-secondary border-border"
            />
          </div>

          {/* Filters */}
          <VendorFilters
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
          />

          {/* Loading & Error States */}
          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-destructive">Error loading vendors: {error.message}</div>
          )}

          {/* Empty State */}
          {!isLoading && !error && filteredVendors.length === 0 && (
            <VendorEmptyState
              onAddVendor={openNewDialog}
              isFiltered={!!search || statusFilter !== "all" || typeFilter !== "all"}
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
                      isSelected={selectedVendors.includes(vendor.id)}
                      onSelect={handleSelectVendor}
                    />
                  ))}
                </div>
              ) : (
                <DataTable data={filteredVendors} columns={columns} />
              )}
            </>
          )}
        </PullToRefreshWrapper>

        {/* Bulk Actions Toolbar */}
        {selectedVendors.length > 0 && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg shadow-lg p-4 flex items-center gap-4 z-50 animate-fade-in">
            <span className="text-sm font-medium">{selectedVendors.length} vendor(s) selected</span>
            <Button variant="outline" size="sm" onClick={() => setIsTypeChangeDialogOpen(true)}>
              <Tag className="h-4 w-4 mr-2" />
              Change Type
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedVendors([])}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedVendors.length} Vendor(s)?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. These vendors will be permanently deleted from your
                system.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBatchDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Type Change Dialog */}
        <Dialog open={isTypeChangeDialogOpen} onOpenChange={setIsTypeChangeDialogOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-heading">Change Vendor Type</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="targetType" className="mb-2 block">
                Select new type for {selectedVendors.length} vendor(s)
              </Label>
              <Select value={targetType} onValueChange={(v: VendorType) => setTargetType(v)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contractor">Contractor</SelectItem>
                  <SelectItem value="personnel">Personnel</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsTypeChangeDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="glow" onClick={handleBatchTypeChange}>
                Apply to {selectedVendors.length} Vendors
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                  <Label htmlFor="vendor_type">Vendor Type</Label>
                  <Select
                    value={formData.vendor_type}
                    onValueChange={(value: VendorType) =>
                      setFormData({ ...formData, vendor_type: value })
                    }
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contractor">Contractor</SelectItem>
                      <SelectItem value="personnel">Personnel</SelectItem>
                      <SelectItem value="supplier">Supplier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
