import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { PersonnelCard } from "@/components/personnel/PersonnelCard";
import { PersonnelStats } from "@/components/personnel/PersonnelStats";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
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
import { usePersonnel } from "@/integrations/supabase/hooks/usePersonnel";
import { useQuickBooksConfig, useSyncSingleVendor } from "@/integrations/supabase/hooks/useQuickBooks";
import type { Database } from "@/integrations/supabase/types";

type Personnel = Database["public"]["Tables"]["personnel"]["Row"];

const vendorTypeColors: Record<string, string> = {
  contractor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  personnel: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  supplier: "bg-amber-500/10 text-amber-500 border-amber-500/20",
};

const Vendors = () => {
  const navigate = useNavigate();
  const { data: vendors, isLoading: vendorsLoading, error: vendorsError, refetch: refetchVendors, isFetching: vendorsFetching } = useVendors();
  const { data: personnelData, isLoading: personnelLoading, error: personnelError, refetch: refetchPersonnel, isFetching: personnelFetching } = usePersonnel();
  
  const addVendor = useAddVendor();
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();
  const batchDeleteVendors = useBatchDeleteVendors();
  const batchUpdateVendorType = useBatchUpdateVendorType();
  const { data: qbConfig } = useQuickBooksConfig();
  const syncVendorToQB = useSyncSingleVendor();
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | VendorType>("all");
  const [sortBy, setSortBy] = useState<"name" | "company" | "vendor_type">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
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

  // Check if we're showing personnel data
  const isPersonnelView = typeFilter === "personnel";
  const isLoading = isPersonnelView ? personnelLoading : vendorsLoading;
  const error = isPersonnelView ? personnelError : vendorsError;
  const isFetching = isPersonnelView ? personnelFetching : vendorsFetching;
  const refetch = isPersonnelView ? refetchPersonnel : refetchVendors;

  // Filter personnel data
  const filteredPersonnel = personnelData
    ?.filter((p) => {
      const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
      const matchesSearch =
        fullName.includes(search.toLowerCase()) ||
        p.email.toLowerCase().includes(search.toLowerCase()) ||
        (p.phone && p.phone.includes(search));

      const matchesStatus = statusFilter === "all" || p.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const aName = `${a.first_name} ${a.last_name}`.toLowerCase();
      const bName = `${b.first_name} ${b.last_name}`.toLowerCase();
      const comparison = aName.localeCompare(bName);
      return sortOrder === "asc" ? comparison : -comparison;
    }) || [];

  // Filter vendors (exclude personnel type when in "all" view since we show them separately)
  const filteredVendors =
    vendors
      ?.filter((v) => {
        // When showing "all", exclude personnel type vendors (they're in personnel table)
        if (typeFilter === "all" && v.vendor_type === "personnel") {
          return false;
        }
        
        const matchesSearch =
          v.name.toLowerCase().includes(search.toLowerCase()) ||
          (v.specialty && v.specialty.toLowerCase().includes(search.toLowerCase())) ||
          (v.company && v.company.toLowerCase().includes(search.toLowerCase()));

        const matchesStatus = statusFilter === "all" || v.status === statusFilter;
        const matchesType = typeFilter === "all" || v.vendor_type === typeFilter;

        return matchesSearch && matchesStatus && matchesType;
      })
      .sort((a, b) => {
        const aVal = (a[sortBy] || "").toLowerCase();
        const bVal = (b[sortBy] || "").toLowerCase();
        const comparison = aVal.localeCompare(bVal);
        return sortOrder === "asc" ? comparison : -comparison;
      }) || [];

  // Calculate stats - exclude personnel type vendors
  const vendorsExcludingPersonnelType = vendors?.filter((v) => v.vendor_type !== "personnel") || [];
  const total = vendorsExcludingPersonnelType.length;
  const active = vendorsExcludingPersonnelType.filter((v) => v.status === "active").length;
  const inactive = vendorsExcludingPersonnelType.filter((v) => v.status === "inactive").length;

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

  // Vendor columns for DataTable
  const vendorColumns = [
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

  // Personnel columns for DataTable
  const personnelColumns = [
    {
      key: "name",
      header: "Name",
      render: (item: Personnel) => `${item.first_name} ${item.last_name}`,
    },
    { key: "personnel_number", header: "ID" },
    { key: "email", header: "Email" },
    { key: "phone", header: "Phone" },
    {
      key: "status",
      header: "Status",
      render: (item: Personnel) => {
        const status = item.status;
        if (status === "do_not_hire") {
          return <Badge variant="destructive">Do Not Hire</Badge>;
        }
        return <StatusBadge status={status === "inactive" ? "inactive" : "active"} />;
      },
    },
    {
      key: "everify_status",
      header: "E-Verify",
      render: (item: Personnel) => {
        const status = item.everify_status;
        const colors: Record<string, string> = {
          verified: "bg-green-600 text-white",
          pending: "bg-secondary text-secondary-foreground",
          rejected: "bg-destructive text-destructive-foreground",
          expired: "border-border text-muted-foreground",
          not_required: "border-border text-muted-foreground",
        };
        return (
          <Badge variant="outline" className={colors[status || "pending"]}>
            {status || "pending"}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      header: "",
      render: (item: Personnel) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/personnel/${item.id}`);
          }}
        >
          <Edit className="h-4 w-4" />
        </Button>
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
      const newVendor = await addVendor.mutateAsync({
        ...formData,
        rating: null,
        insurance_expiry: formData.insurance_expiry || null,
        license_number: formData.license_number || null,
      });

      // Auto-sync to QuickBooks if connected
      if (qbConfig?.is_connected && newVendor?.id) {
        try {
          await syncVendorToQB.mutateAsync(newVendor.id);
          toast.success("Vendor synced to QuickBooks");
        } catch (error) {
          console.error("QuickBooks sync failed:", error);
          toast.warning("Vendor created but QuickBooks sync failed. You can sync manually later.");
        }
      }
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
        title={isPersonnelView ? "Personnel" : "Vendors"}
        description={isPersonnelView ? "View your workforce and personnel records" : "Manage your vendor profiles and work orders"}
        actions={
          !isPersonnelView && (
            <Button variant="glow" onClick={openNewDialog}>
              <Plus className="h-4 w-4" />
              Add Vendor
            </Button>
          )
        }
      >
        <PullToRefreshWrapper onRefresh={refetch} isRefreshing={isFetching}>
          {/* Stats - Show personnel stats or vendor stats based on filter */}
          {isPersonnelView ? (
            <PersonnelStats />
          ) : (
            <VendorStats total={total} active={active} inactive={inactive} />
          )}

          {/* Search */}
          <div className="mb-6 max-w-md">
            <SearchInput
              placeholder={isPersonnelView ? "Search personnel..." : "Search vendors..."}
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
            sortBy={sortBy}
            onSortByChange={setSortBy}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
          />

          {/* Loading & Error States */}
          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-destructive">
              Error loading {isPersonnelView ? "personnel" : "vendors"}: {error.message}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && (isPersonnelView ? filteredPersonnel.length === 0 : filteredVendors.length === 0) && (
            <VendorEmptyState
              onAddVendor={isPersonnelView ? () => navigate("/personnel") : openNewDialog}
              isFiltered={!!search || statusFilter !== "all" || typeFilter !== "all"}
            />
          )}

          {/* Personnel View */}
          {!isLoading && !error && isPersonnelView && filteredPersonnel.length > 0 && (
            <>
              {isMobile ? (
                <div className="grid gap-4">
                  {filteredPersonnel.map((person) => (
                    <PersonnelCard
                      key={person.id}
                      personnel={person}
                    />
                  ))}
                </div>
              ) : (
                <DataTable
                  data={filteredPersonnel}
                  columns={personnelColumns}
                  onRowClick={(person) => navigate(`/personnel/${person.id}`)}
                />
              )}
            </>
          )}

          {/* Vendors View */}
          {!isLoading && !error && !isPersonnelView && filteredVendors.length > 0 && (
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
                <DataTable data={filteredVendors} columns={vendorColumns} />
              )}
            </>
          )}
        </PullToRefreshWrapper>

        {/* Bulk Actions Toolbar - Only show for vendors, not personnel */}
        {!isPersonnelView && selectedVendors.length > 0 && (
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
