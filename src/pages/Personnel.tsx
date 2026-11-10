import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Upload,
  Download,
  CheckSquare,
  XSquare,
  Link,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageLayout } from "@/components/layout/PageLayout";
import { SEO } from "@/components/SEO";
import { PersonnelStats } from "@/components/personnel/PersonnelStats";
import { PersonnelFilters } from "@/components/personnel/PersonnelFilters";
import { PersonnelTable } from "@/components/personnel/PersonnelTable";
import { PersonnelEmptyState } from "@/components/personnel/PersonnelEmptyState";
import { PersonnelForm } from "@/components/personnel/PersonnelForm";
import { PersonnelImportDialog } from "@/components/personnel/PersonnelImportDialog";
import { InvitePersonnelDialog } from "@/components/personnel/InvitePersonnelDialog";
import { BulkBadgeGenerator } from "@/components/badges/BulkBadgeGenerator";
import { PendingRegistrations } from "@/components/personnel/PendingRegistrations";
import { usePersonnel } from "@/integrations/supabase/hooks/usePersonnel";
import { usePendingRegistrationsCount } from "@/integrations/supabase/hooks/usePersonnelRegistrations";
import { generateSampleCSV, downloadCSV } from "@/utils/csvPersonnelParser";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";
import { useSessionState } from "@/hooks/useSessionState";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { usePersonnelTags } from "@/hooks/usePersonnelTags";
import { TagFilter } from "@/components/personnel/PersonnelTags";
import { PersonnelBulkActions } from "@/components/personnel/PersonnelBulkActions";
import { BenchList } from "@/components/personnel/BenchList";
import { matchesAllTags, personnelSegment } from "@/lib/personnelSegment";

type Seg = "all" | "frg" | "agency" | "customer" | "bench";

const Personnel = () => {
  const [search, setSearch] = useSessionState("personnel:search", "");
  const [status, setStatus] = useSessionState("personnel:status", "active");
  const [everifyStatus, setEverifyStatus] = useSessionState("personnel:everify", "all");
  const [vendorId, setVendorId] = useSessionState("personnel:vendor", "all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [bulkBadgeDialogOpen, setBulkBadgeDialogOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useSessionState("personnel:selMode", true);
  const [selectedIds, setSelectedIds] = useSessionState<string[]>("personnel:selected", []);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [seg, setSeg] = useSessionState<Seg>("personnel:seg", "all");
  const [customerId, setCustomerId] = useSessionState("personnel:customer", "all");
  const [tagFilter, setTagFilter] = useSessionState<string[]>("personnel:tags", []);

  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, isManager } = useUserRole();
  const { data: pendingCount } = usePendingRegistrationsCount();
  const canManage = isAdmin || isManager;
  // Sidebar "Bench" link deep-links into the bench segment.
  const urlSegment = searchParams.get("segment");
  useEffect(() => { if (urlSegment === "bench") setSeg("bench"); }, [urlSegment]); // eslint-disable-line react-hooks/exhaustive-deps

  const registrationUrl = `${window.location.origin}/personnel/register`;

  // Auto-open add dialog when action=add query param is present
  useEffect(() => {
    if (searchParams.get("action") === "add") {
      setAddDialogOpen(true);
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleCopyRegistrationLink = () => {
    navigator.clipboard.writeText(registrationUrl);
    toast.success("Registration link copied to clipboard");
  };

  const handleDownloadTemplate = () => {
    const csv = generateSampleCSV();
    downloadCSV(csv, "personnel-import-template.csv");
    toast.success("Template downloaded");
  };

  const handleToggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(visible.map((p) => p.id));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedIds([]);
    toast.info("Selection mode enabled - tap personnel to select");
  };

  const handleExitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds([]);
    toast.info("Selection mode disabled");
  };

  const handlePrintBadges = () => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one person");
      return;
    }
    setBulkBadgeDialogOpen(true);
  };

  const filters = {
    search,
    status: status === "all" ? undefined : status,
    everifyStatus: everifyStatus === "all" ? undefined : everifyStatus,
    vendorId: vendorId === "all" ? undefined : vendorId,
  };

  const { data: personnel, isLoading } = usePersonnel(filters);
  const { data: tagData } = usePersonnelTags();
  const { data: customers = [] } = useCustomers();
  const { data: vendorList = [] } = useVendors();
  const customerName = (id: string) => customers.find((c) => c.id === id)?.name;
  const vendorName = (id: string) => vendorList.find((v) => v.id === id)?.name;
  const tagged = useMemo(() => (personnel ?? []).filter((p) => matchesAllTags(tagData?.byPerson[p.id], tagFilter)), [personnel, tagData, tagFilter]);
  const counts = useMemo(() => {
    const c = { all: tagged.length, frg: 0, agency: 0, customer: 0, bench: 0 };
    for (const p of tagged) { c[personnelSegment(p)]++; if (p.on_bench) c.bench++; }
    return c;
  }, [tagged]);
  const visible = useMemo(() => tagged.filter((p) =>
    seg === "all" ? true : seg === "bench" ? p.on_bench : personnelSegment(p) === seg
  ).filter((p) => seg !== "customer" || customerId === "all" || p.employer_customer_id === customerId)
   .sort((a, b) => seg === "agency" || seg === "customer"
      ? (customerName(a.employer_customer_id ?? "") ?? vendorName(a.vendor_id ?? "") ?? "").localeCompare(customerName(b.employer_customer_id ?? "") ?? vendorName(b.vendor_id ?? "") ?? "")
      : 0), [tagged, seg, customerId, customers, vendorList]);
  useEffect(() => { setCurrentPage(1); }, [seg, customerId, tagFilter.length]);
  const selectedPeople = (personnel ?? []).filter((p) => selectedIds.includes(p.id));
  const worksFor = (p: { id: string }) => {
    const r = (personnel ?? []).find((x) => x.id === p.id);
    if (!r) return "";
    return r.employer_customer_id ? `${customerName(r.employer_customer_id) ?? "Customer"} (customer, non-billable)` : r.vendor_id ? vendorName(r.vendor_id) ?? "Agency" : "FRG";
  };
  const bulk = canManage ? <PersonnelBulkActions people={selectedPeople} worksFor={worksFor} tagsByPerson={tagData?.byPerson} /> : null;

  return (
    <PageLayout title="Personnel Management">
      <SEO
        title="Personnel Management"
        description="Manage your workforce with complete personnel profiles, I-9 compliance, E-Verify tracking, and certifications"
      />

      <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden">
        <PersonnelStats />

        {/* Pending Registrations */}
        {canManage && <PendingRegistrations />}


        <Tabs value={seg} onValueChange={(v) => { setSeg(v as Seg); if (searchParams.get("segment") && v !== "bench") { const n = new URLSearchParams(searchParams); n.delete("segment"); setSearchParams(n, { replace: true }); } if (v === "agency" || v === "customer") setVendorId("all"); }}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">All <Badge variant="secondary" className="ml-1.5">{counts.all}</Badge></TabsTrigger>
            <TabsTrigger value="frg">FRG Workforce <Badge variant="secondary" className="ml-1.5">{counts.frg}</Badge></TabsTrigger>
            <TabsTrigger value="agency">Agency <Badge variant="secondary" className="ml-1.5">{counts.agency}</Badge></TabsTrigger>
            <TabsTrigger value="customer">Customer personnel <Badge variant="secondary" className="ml-1.5">{counts.customer}</Badge></TabsTrigger>
            <TabsTrigger value="bench">Bench <Badge variant="secondary" className="ml-1.5">{counts.bench}</Badge></TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search input */}
        <SearchInput
          placeholder="Search personnel..."
          value={search}
          onChange={setSearch}
          className="w-full min-h-[44px] sm:min-h-[40px]"
        />

        {/* Filters and action buttons on the same row */}
        <div className="flex flex-wrap items-center gap-2 w-full max-w-full">
          {selectionMode && (
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              Selection Mode Active
            </Badge>
          )}
          <PersonnelFilters
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            everifyStatus={everifyStatus}
            onEverifyStatusChange={setEverifyStatus}
            vendorId={vendorId}
            onVendorChange={setVendorId}
            inline
          />
          <TagFilter value={tagFilter} onChange={setTagFilter} />
          {seg === "customer" && (
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="h-9 w-56" aria-label="Customer"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All customers</SelectItem>
                {customers.filter((c) => (personnel ?? []).some((p) => p.employer_customer_id === c.id)).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {!selectionMode ? (
            <>
              <Button
                variant="outline"
                onClick={handleEnterSelectionMode}
                className="min-h-[44px] sm:min-h-[40px] text-xs sm:text-sm"
              >
                <CheckSquare className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                Select
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="min-h-[44px] sm:min-h-[40px] text-xs sm:text-sm"
                  >
                    <Upload className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                    Import
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Import from CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadTemplate}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Template
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyRegistrationLink}>
                    <Link className="mr-2 h-4 w-4" />
                    Copy Registration Link
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                onClick={() => setInviteDialogOpen(true)}
                className="min-h-[44px] sm:min-h-[40px] text-xs sm:text-sm"
              >
                <Mail className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                Invite
              </Button>
              <Button
                onClick={() => setAddDialogOpen(true)}
                className="min-h-[44px] sm:min-h-[40px] text-xs sm:text-sm"
              >
                <Plus className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                Add Personnel
                {pendingCount > 0 && (
                  <Badge variant="secondary" className="ml-1.5 sm:ml-2">
                    {pendingCount}
                  </Badge>
                )}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={handleExitSelectionMode}
              className="min-h-[44px] sm:min-h-[40px] text-xs sm:text-sm"
            >
              <XSquare className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              Exit Selection
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8 sm:py-12">
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
          </div>
        ) : seg === "bench" ? (
          <div className="space-y-2">
            {selectedIds.length > 0 && bulk && <div className="flex flex-wrap items-center gap-2 p-3 bg-muted rounded-lg"><span className="text-sm font-medium">{selectedIds.length} selected</span>{bulk}<Button size="sm" variant="ghost" onClick={handleClearSelection}>Clear</Button></div>}
            <BenchList people={visible} tagsByPerson={tagData?.byPerson} canEdit={canManage}
              selected={new Set(selectedIds)} onToggle={handleToggleSelection}
              onToggleAll={(ids) => setSelectedIds((prev) => ids.every((i) => prev.includes(i)) ? prev.filter((i) => !ids.includes(i)) : [...new Set([...prev, ...ids])])} />
          </div>
        ) : visible.length > 0 ? (
          <PersonnelTable
            personnel={visible}
            totalCount={visible.length}
            currentPage={currentPage}
            rowsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={(size) => {
              setRowsPerPage(size);
              setCurrentPage(1);
            }}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelection={handleToggleSelection}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            onPrintBadges={handlePrintBadges}
            tagsByPerson={tagData?.byPerson}
            customerName={customerName}
            bulkActions={bulk}
          />
        ) : (
          <PersonnelEmptyState onAddClick={() => setAddDialogOpen(true)} />
        )}
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              Add New Personnel
            </DialogTitle>
          </DialogHeader>
          <PersonnelForm
            onSuccess={() => setAddDialogOpen(false)}
            onCancel={() => setAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <PersonnelImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />

      <BulkBadgeGenerator
        open={bulkBadgeDialogOpen}
        onOpenChange={setBulkBadgeDialogOpen}
        preselectedIds={selectedIds}
      />

      <InvitePersonnelDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />
    </PageLayout>
  );
};

export default Personnel;
