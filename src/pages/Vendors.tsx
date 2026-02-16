import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { EnhancedDataTable, EnhancedColumn } from "@/components/shared/EnhancedDataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Loader2, Tag, X, ChevronDown, ChevronUp, MapPin, DollarSign, RefreshCw, Send } from "lucide-react";
import { SendVendorOnboardingDialog } from "@/components/vendors/SendVendorOnboardingDialog";
import { SendOnboardingSearchDialog } from "@/components/vendors/SendOnboardingSearchDialog";
import { AddVendorChoiceDialog } from "@/components/vendors/AddVendorChoiceDialog";
import { SendOnboardingInviteDialog } from "@/components/vendors/SendOnboardingInviteDialog";
import { SearchInput } from "@/components/ui/search-input";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { VendorCard } from "@/components/vendors/VendorCard";
import { VendorStats } from "@/components/vendors/VendorStats";
import { VendorFilters } from "@/components/vendors/VendorFilters";
import { VendorEmptyState } from "@/components/vendors/VendorEmptyState";
import { TablePagination } from "@/components/shared/TablePagination";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { useExpenseCategories } from "@/integrations/supabase/hooks/useExpenseCategories";
import { useQuickBooksConfig, useSyncSingleVendor, useImportVendorsFromQB, useQuickBooksVendorMappings } from "@/integrations/supabase/hooks/useQuickBooks";
import { QuickBooksSyncBadge } from "@/components/quickbooks/QuickBooksSyncBadge";
import type { Database } from "@/integrations/supabase/types";

type Personnel = Database["public"]["Tables"]["personnel"]["Row"];

const vendorTypeColors: Record<string, string> = {
  contractor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  personnel: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  supplier: "bg-amber-500/10 text-amber-500 border-amber-500/20",
};

const PAYMENT_TERMS_OPTIONS = [
  { value: "due_on_receipt", label: "Due on Receipt" },
  { value: "net_15", label: "Net 15" },
  { value: "net_30", label: "Net 30" },
  { value: "net_45", label: "Net 45" },
  { value: "net_60", label: "Net 60" },
];

interface VendorFormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  specialty: string;
  status: "active" | "inactive";
  vendor_type: VendorType;
  insurance_expiry: string;
  license_number: string;
  w9_on_file: boolean;
  // Address fields
  address: string;
  city: string;
  state: string;
  zip: string;
  // Tax fields
  tax_id: string;
  track_1099: boolean;
  // Billing fields
  billing_rate: string;
  payment_terms: string;
  account_number: string;
  // Accounting fields
  default_expense_category_id: string;
  opening_balance: string;
  // Notes
  notes: string;
}

const initialFormData: VendorFormData = {
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
  address: "",
  city: "",
  state: "",
  zip: "",
  tax_id: "",
  track_1099: false,
  billing_rate: "",
  payment_terms: "",
  account_number: "",
  default_expense_category_id: "",
  opening_balance: "",
  notes: "",
};

const Vendors = () => {
  const navigate = useNavigate();
  const { data: vendors, isLoading: vendorsLoading, error: vendorsError, refetch: refetchVendors, isFetching: vendorsFetching } = useVendors();
  const { data: personnelData, isLoading: personnelLoading, error: personnelError, refetch: refetchPersonnel, isFetching: personnelFetching } = usePersonnel();
  const { data: expenseCategories } = useExpenseCategories("vendor");
  
  const addVendor = useAddVendor();
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();
  const batchDeleteVendors = useBatchDeleteVendors();
  const batchUpdateVendorType = useBatchUpdateVendorType();
  const { data: qbConfig } = useQuickBooksConfig();
  const syncVendorToQB = useSyncSingleVendor();
  const importVendorsFromQB = useImportVendorsFromQB();
  const { data: vendorMappings } = useQuickBooksVendorMappings();
  const isMobile = useIsMobile();

  // Create a map for quick lookup of vendor sync status
  const vendorSyncStatusMap = new Map(
    vendorMappings?.map((m) => [m.vendor_id, m.sync_status as 'synced' | 'pending' | 'error']) || []
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | VendorType>("all");
  const [sortBy, setSortBy] = useState<"name" | "company" | "vendor_type">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isOnboardingDialogOpen, setIsOnboardingDialogOpen] = useState(false);
  const [onboardingVendor, setOnboardingVendor] = useState<Vendor | null>(null);
  const [additionalInfoOpen, setAdditionalInfoOpen] = useState(false);
  const [isSendOnboardingSearchOpen, setIsSendOnboardingSearchOpen] = useState(false);
  const [isChoiceDialogOpen, setIsChoiceDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  // Batch selection state
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTypeChangeDialogOpen, setIsTypeChangeDialogOpen] = useState(false);
  const [targetType, setTargetType] = useState<VendorType>("supplier");

  const [formData, setFormData] = useState<VendorFormData>(initialFormData);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, typeFilter]);

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
      const phoneSearch = search.replace(/\D/g, ''); // Strip non-digits for phone matching
      const matchesSearch =
        fullName.includes(search.toLowerCase()) ||
        p.email.toLowerCase().includes(search.toLowerCase()) ||
        (p.phone && phoneSearch.length > 0 && p.phone.includes(phoneSearch));

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
        
      const searchLower = search.toLowerCase();
      const phoneSearch = search.replace(/\D/g, ''); // Strip non-digits for phone matching
      const matchesSearch =
        v.name.toLowerCase().includes(searchLower) ||
        v.email.toLowerCase().includes(searchLower) ||
        (v.phone && phoneSearch.length > 0 && v.phone.includes(phoneSearch)) ||
        (v.specialty && v.specialty.toLowerCase().includes(searchLower)) ||
        (v.company && v.company.toLowerCase().includes(searchLower)) ||
        (v.account_number && v.account_number.toLowerCase().includes(searchLower)) ||
        (v.tax_id && v.tax_id.toLowerCase().includes(searchLower));

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

  // Vendor columns for EnhancedDataTable
  const vendorColumns: EnhancedColumn<Vendor>[] = [
    {
      key: "select",
      header: "",
      sortable: false,
      filterable: false,
      render: (item) => (
        <Checkbox
          checked={selectedVendors.includes(item.id)}
          onCheckedChange={() => handleSelectVendor(item.id)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    { 
      key: "name", 
      header: "Vendor Name",
      sortable: true,
      filterable: true,
      getValue: (item) => item.name,
      render: (item) => (
        <Link 
          to={`/vendors/${item.id}`}
          className="text-primary hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {item.name}
        </Link>
      ),
    },
    { 
      key: "company", 
      header: "Company",
      sortable: true,
      filterable: true,
      getValue: (item) => item.company || "",
    },
    { 
      key: "specialty", 
      header: "Specialty",
      sortable: true,
      filterable: true,
      getValue: (item) => item.specialty || "",
    },
    {
      key: "vendor_type",
      header: "Type",
      sortable: true,
      filterable: true,
      getValue: (item) => item.vendor_type,
      render: (item) => (
        <Badge variant="outline" className={vendorTypeColors[item.vendor_type]}>
          {item.vendor_type}
        </Badge>
      ),
    },
    { 
      key: "email", 
      header: "Email",
      sortable: true,
      filterable: true,
      getValue: (item) => item.email,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      getValue: (item) => item.status,
      render: (item) => <StatusBadge status={item.status} />,
    },
    // Only show QB Status column if QuickBooks is connected
    ...(qbConfig?.is_connected ? [{
      key: "qb_status" as const,
      header: "QB Status",
      sortable: false,
      filterable: false,
      render: (item: Vendor) => {
        const syncStatus = vendorSyncStatusMap.get(item.id);
        if (!syncStatus) {
          return <QuickBooksSyncBadge status="not_synced" size="sm" />;
        }
        return <QuickBooksSyncBadge status={syncStatus} size="sm" />;
      },
    }] : []),
    {
      key: "actions",
      header: "",
      sortable: false,
      filterable: false,
      render: (item) => (
        <div className="flex items-center gap-2">
          {item.onboarding_status !== "completed" && (
            <Button
              variant="ghost"
              size="icon"
              title={item.onboarding_status === "invited" ? "Resend Onboarding" : "Send Onboarding"}
              onClick={(e) => {
                e.stopPropagation();
                setOnboardingVendor(item);
                setIsOnboardingDialogOpen(true);
              }}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
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

  // Personnel columns for EnhancedDataTable
  const personnelColumns: EnhancedColumn<Personnel>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      filterable: true,
      getValue: (item) => `${item.first_name} ${item.last_name}`,
      render: (item) => (
        <Link
          to={`/personnel/${item.id}`}
          className="text-primary hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {item.first_name} {item.last_name}
        </Link>
      ),
    },
    { 
      key: "personnel_number", 
      header: "ID",
      sortable: true,
      filterable: true,
      getValue: (item) => item.personnel_number || "",
    },
    { 
      key: "email", 
      header: "Email",
      sortable: true,
      filterable: true,
      getValue: (item) => item.email,
    },
    { 
      key: "phone", 
      header: "Phone",
      sortable: true,
      filterable: true,
      getValue: (item) => item.phone || "",
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      getValue: (item) => item.status || "active",
      render: (item) => {
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
      sortable: true,
      filterable: true,
      getValue: (item) => item.everify_status || "pending",
      render: (item) => {
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
      sortable: false,
      filterable: false,
      render: (item) => (
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
      address: vendor.address || "",
      city: vendor.city || "",
      state: vendor.state || "",
      zip: vendor.zip || "",
      tax_id: vendor.tax_id || "",
      track_1099: vendor.track_1099 || false,
      billing_rate: vendor.billing_rate?.toString() || "",
      payment_terms: vendor.payment_terms || "",
      account_number: vendor.account_number || "",
      default_expense_category_id: vendor.default_expense_category_id || "",
      opening_balance: vendor.opening_balance?.toString() || "",
      notes: vendor.notes || "",
    });
    // Open additional info if any of those fields have values
    const hasAdditionalInfo = vendor.tax_id || vendor.track_1099 || vendor.billing_rate ||
      vendor.payment_terms || vendor.account_number || vendor.default_expense_category_id ||
      vendor.opening_balance || vendor.notes;
    setAdditionalInfoOpen(!!hasAdditionalInfo);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteVendor.mutate(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const vendorData = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone || null,
      company: formData.company || null,
      specialty: formData.specialty || null,
      status: formData.status,
      vendor_type: formData.vendor_type,
      insurance_expiry: formData.insurance_expiry || null,
      license_number: formData.license_number || null,
      w9_on_file: formData.w9_on_file,
      address: formData.address || null,
      city: formData.city || null,
      state: formData.state || null,
      zip: formData.zip || null,
      tax_id: formData.tax_id || null,
      track_1099: formData.track_1099,
      billing_rate: formData.billing_rate ? parseFloat(formData.billing_rate) : null,
      payment_terms: formData.payment_terms || null,
      account_number: formData.account_number || null,
      default_expense_category_id: formData.default_expense_category_id || null,
      opening_balance: formData.opening_balance ? parseFloat(formData.opening_balance) : null,
      notes: formData.notes || null,
    };

    if (editingVendor) {
      await updateVendor.mutateAsync({
        id: editingVendor.id,
        ...vendorData,
      });
    } else {
      const newVendor = await addVendor.mutateAsync({
        ...vendorData,
        rating: null,
        user_id: null,
        onboarding_status: null,
        onboarding_completed_at: null,
        bank_name: null,
        bank_account_type: null,
        bank_routing_number: null,
        bank_account_number: null,
        w9_signature: null,
        w9_signed_at: null,
        vendor_agreement_signature: null,
        vendor_agreement_signed_at: null,
        citizenship_status: null,
        immigration_status: null,
        itin: null,
        business_type: null,
        contact_name: null,
        contact_title: null,
        years_in_business: null,
        website: null,
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
    setFormData(initialFormData);
    setAdditionalInfoOpen(false);
  };

  const openNewDialog = () => {
    setEditingVendor(null);
    setFormData(initialFormData);
    setAdditionalInfoOpen(false);
    setIsDialogOpen(true);
  };

  const handleAddVendorClick = () => {
    setIsChoiceDialogOpen(true);
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
            <div className="flex items-center gap-2">
              {qbConfig?.is_connected && (
                <Button
                  variant="outline"
                  onClick={() => importVendorsFromQB.mutate(undefined)}
                  disabled={importVendorsFromQB.isPending}
                >
                  {importVendorsFromQB.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {importVendorsFromQB.isPending ? "Syncing..." : "Sync from QuickBooks"}
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsSendOnboardingSearchOpen(true)}>
                <Send className="h-4 w-4" />
                Send Onboarding
              </Button>
              <Button variant="glow" onClick={handleAddVendorClick}>
                <Plus className="h-4 w-4" />
                Add Vendor
              </Button>
            </div>
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

          {/* Search & Filters - Combined Row */}
          <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <div className="w-full sm:w-48 md:w-56 lg:w-64 shrink-0">
              <SearchInput
                placeholder={isPersonnelView ? "Search personnel..." : "Search vendors..."}
                value={search}
                onChange={setSearch}
                className="bg-secondary border-border"
              />
            </div>
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
          </div>

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
                  {filteredPersonnel
                    .slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
                    .map((person) => (
                      <PersonnelCard
                        key={person.id}
                        personnel={person}
                      />
                    ))}
                </div>
              ) : (
                <EnhancedDataTable
                  tableId="vendors-personnel"
                  data={filteredPersonnel.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)}
                  columns={personnelColumns}
                  onRowClick={(person) => navigate(`/personnel/${person.id}`)}
                />
              )}
              <TablePagination
                currentPage={currentPage}
                totalCount={filteredPersonnel.length}
                rowsPerPage={rowsPerPage}
                onPageChange={setCurrentPage}
                onRowsPerPageChange={(size) => {
                  setRowsPerPage(size);
                  setCurrentPage(1);
                }}
              />
            </>
          )}

          {/* Vendors View */}
          {!isLoading && !error && !isPersonnelView && filteredVendors.length > 0 && (
            <>
              {isMobile ? (
                <div className="grid gap-4">
                  {filteredVendors
                    .slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
                    .map((vendor, index) => (
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
                <EnhancedDataTable
                  tableId="vendors"
                  data={filteredVendors.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)} 
                  columns={vendorColumns} 
                  onRowClick={(vendor) => navigate(`/vendors/${vendor.id}`)}
                />
              )}
              <TablePagination
                currentPage={currentPage}
                totalCount={filteredVendors.length}
                rowsPerPage={rowsPerPage}
                onPageChange={setCurrentPage}
                onRowsPerPageChange={(size) => {
                  setRowsPerPage(size);
                  setCurrentPage(1);
                }}
              />
            </>
          )}
        </PullToRefreshWrapper>

        {/* Bulk Actions Toolbar - Only show for vendors, not personnel */}
        {!isPersonnelView && selectedVendors.length > 0 && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg shadow-lg p-4 flex items-center gap-4 z-40 animate-fade-in">
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
          <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">
                {editingVendor ? "Edit Vendor" : "Add New Vendor"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Vendor Name *</Label>
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
                    <Label htmlFor="email">Email *</Label>
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
              </div>

              {/* Address Section */}
              <div className="space-y-4 border-t border-border pt-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  Address
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Street Address</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="123 Main St"
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        placeholder="TX"
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zip">ZIP</Label>
                      <Input
                        id="zip"
                        value={formData.zip}
                        onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                        className="bg-secondary border-border"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Info Section (Collapsible) */}
              <Collapsible open={additionalInfoOpen} onOpenChange={setAdditionalInfoOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" className="w-full justify-between border-t border-border rounded-none pt-4">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <DollarSign className="h-4 w-4" />
                      Additional Info
                    </span>
                    {additionalInfoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-6 pt-4">
                  {/* Taxes */}
                  <div className="space-y-4">
                    <Label className="text-xs uppercase text-muted-foreground tracking-wider">Taxes</Label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="tax_id">Tax ID / SSN</Label>
                        <Input
                          id="tax_id"
                          value={formData.tax_id}
                          onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                          placeholder="XX-XXXXXXX"
                          className="bg-secondary border-border"
                        />
                      </div>
                      <div className="flex items-center space-x-2 pt-6">
                        <Checkbox
                          id="track_1099"
                          checked={formData.track_1099}
                          onCheckedChange={(checked) => setFormData({ ...formData, track_1099: !!checked })}
                        />
                        <Label htmlFor="track_1099" className="cursor-pointer">Track payments for 1099</Label>
                      </div>
                    </div>
                  </div>

                  {/* Expense Rates */}
                  <div className="space-y-4">
                    <Label className="text-xs uppercase text-muted-foreground tracking-wider">Expense Rates</Label>
                    <div className="space-y-2">
                      <Label htmlFor="billing_rate">Billing Rate (/hr)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          id="billing_rate"
                          type="number"
                          step="0.01"
                          value={formData.billing_rate}
                          onChange={(e) => setFormData({ ...formData, billing_rate: e.target.value })}
                          className="bg-secondary border-border pl-7"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Payments */}
                  <div className="space-y-4">
                    <Label className="text-xs uppercase text-muted-foreground tracking-wider">Payments</Label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="payment_terms">Terms</Label>
                        <Select
                          value={formData.payment_terms}
                          onValueChange={(value) => setFormData({ ...formData, payment_terms: value })}
                        >
                          <SelectTrigger className="bg-secondary border-border">
                            <SelectValue placeholder="Select terms" />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_TERMS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="account_number">Account No.</Label>
                        <Input
                          id="account_number"
                          value={formData.account_number}
                          onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                          className="bg-secondary border-border"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Accounting */}
                  <div className="space-y-4">
                    <Label className="text-xs uppercase text-muted-foreground tracking-wider">Accounting</Label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="default_expense_category_id">Default Expense Category</Label>
                        <Select
                          value={formData.default_expense_category_id}
                          onValueChange={(value) => setFormData({ ...formData, default_expense_category_id: value })}
                        >
                          <SelectTrigger className="bg-secondary border-border">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {expenseCategories?.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="opening_balance">Opening Balance</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input
                            id="opening_balance"
                            type="number"
                            step="0.01"
                            value={formData.opening_balance}
                            onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                            className="bg-secondary border-border pl-7"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Additional notes about this vendor..."
                      className="bg-secondary border-border min-h-[80px]"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
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

        <SendOnboardingSearchDialog
          open={isSendOnboardingSearchOpen}
          onOpenChange={setIsSendOnboardingSearchOpen}
          vendors={vendors || []}
        />

        {onboardingVendor && (
          <SendVendorOnboardingDialog
            open={isOnboardingDialogOpen}
            onOpenChange={(open) => {
              setIsOnboardingDialogOpen(open);
              if (!open) setOnboardingVendor(null);
            }}
            vendorId={onboardingVendor.id}
            vendorName={onboardingVendor.name}
            vendorEmail={onboardingVendor.email}
          />
        )}

        <AddVendorChoiceDialog
          open={isChoiceDialogOpen}
          onOpenChange={setIsChoiceDialogOpen}
          onManualEntry={openNewDialog}
          onSendInvite={() => setIsInviteDialogOpen(true)}
        />

        <SendOnboardingInviteDialog
          open={isInviteDialogOpen}
          onOpenChange={setIsInviteDialogOpen}
        />
      </PageLayout>
    </>
  );
};

export default Vendors;
