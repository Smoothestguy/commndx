import { useState } from "react";
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

const Personnel = () => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [everifyStatus, setEverifyStatus] = useState("all");
  const [vendorId, setVendorId] = useState("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [bulkBadgeDialogOpen, setBulkBadgeDialogOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { isAdmin, isManager } = useUserRole();
  const { data: pendingCount } = usePendingRegistrationsCount();
  const canManage = isAdmin || isManager;

  const registrationUrl = `${window.location.origin}/personnel/register`;

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
    if (personnel) {
      setSelectedIds(personnel.map((p) => p.id));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedIds([]);
  };

  const handleExitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds([]);
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

        <div className="flex flex-col gap-3 sm:gap-4 w-full max-w-full">
          <PersonnelFilters
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            everifyStatus={everifyStatus}
            onEverifyStatusChange={setEverifyStatus}
            vendorId={vendorId}
            onVendorChange={setVendorId}
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2 w-full max-w-full">
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
                  className="col-span-2 sm:col-span-1 min-h-[44px] sm:min-h-[40px] text-xs sm:text-sm"
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
                className="col-span-2 sm:col-span-1 min-h-[44px] sm:min-h-[40px] text-xs sm:text-sm"
              >
                <XSquare className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                Exit Selection
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8 sm:py-12">
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
          </div>
        ) : personnel && personnel.length > 0 ? (
          <PersonnelTable
            personnel={personnel}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelection={handleToggleSelection}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            onPrintBadges={handlePrintBadges}
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
