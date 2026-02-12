import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SecureAvatar } from "@/components/ui/secure-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Eye,
  MoreHorizontal,
  Edit,
  Printer,
  AlertTriangle,
  Trash2,
  Building2,
  XSquare,
  RefreshCw,
  UserX,
  Briefcase,
  RotateCcw,
} from "lucide-react";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import {
  useDeletePersonnel,
  useToggleDoNotHire,
  useHardDeletePersonnel,
  useReactivatePersonnel,
} from "@/integrations/supabase/hooks/usePersonnel";
import { useQuickBooksConfig, useSyncPersonnelToQB } from "@/integrations/supabase/hooks/useQuickBooks";
import { ComplianceBadge } from "./ComplianceBadge";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobilePersonnelCard } from "./MobilePersonnelCard";
import { EnhancedDataTable, EnhancedColumn } from "@/components/shared/EnhancedDataTable";
import { TablePagination } from "@/components/shared/TablePagination";
import { PersonnelRolesDialog } from "./PersonnelRolesDialog";

type Personnel = Database["public"]["Tables"]["personnel"]["Row"];

interface PersonnelTableProps {
  personnel: Personnel[];
  totalCount: number;
  currentPage: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (size: number) => void;
  selectionMode: boolean;
  selectedIds: string[];
  onToggleSelection: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onPrintBadges: () => void;
}

export function PersonnelTable({
  personnel,
  totalCount,
  currentPage,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  selectionMode,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onPrintBadges,
}: PersonnelTableProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: vendors } = useVendors();
  const { data: qbConfig } = useQuickBooksConfig();
  const deletePersonnel = useDeletePersonnel();
  const toggleDoNotHire = useToggleDoNotHire();
  const hardDeletePersonnel = useHardDeletePersonnel();
  const syncPersonnelToQB = useSyncPersonnelToQB();
  const reactivatePersonnel = useReactivatePersonnel();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<Personnel | null>(null);
  const [hardDeleteDialogOpen, setHardDeleteDialogOpen] = useState(false);
  const [personToHardDelete, setPersonToHardDelete] = useState<Personnel | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [rolesDialogPerson, setRolesDialogPerson] = useState<Personnel | null>(null);

  const getVendor = (vendorId: string | null) => {
    if (!vendorId) return null;
    return vendors?.find((v) => v.id === vendorId);
  };

  const handlePrintSingleBadge = (id: string) => {
    onToggleSelection(id);
    onPrintBadges();
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Active</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      case "do_not_hire":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            DNH
          </Badge>
        );
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getEVerifyBadge = (everifyStatus: string | null) => {
    switch (everifyStatus) {
      case "verified":
        return (
          <Badge className="bg-green-600 hover:bg-green-600/90">Verified</Badge>
        );
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "expired":
        return <Badge variant="outline">Expired</Badge>;
      case "not_required":
        return <Badge variant="outline">N/A</Badge>;
      default:
        return <Badge variant="outline">—</Badge>;
    }
  };

  const handleDelete = async () => {
    if (!personToDelete) return;
    try {
      await deletePersonnel.mutateAsync(personToDelete.id);
      toast.success("Personnel deactivated successfully");
      setDeleteDialogOpen(false);
      setPersonToDelete(null);
    } catch (error) {
      toast.error("Failed to deactivate personnel");
    }
  };

  const handleToggleDNH = async (person: Personnel) => {
    try {
      await toggleDoNotHire.mutateAsync({
        id: person.id,
        currentStatus: person.status || "active",
      });
      toast.success(
        person.status === "do_not_hire"
          ? "Personnel removed from Do Not Hire list"
          : "Personnel added to Do Not Hire list"
      );
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleHardDelete = async () => {
    if (!personToHardDelete) return;
    try {
      await hardDeletePersonnel.mutateAsync(personToHardDelete.id);
      setHardDeleteDialogOpen(false);
      setPersonToHardDelete(null);
    } catch (error) {
      // Error handling is in the hook
    }
  };

  const allSelected =
    personnel.length > 0 && selectedIds.length === personnel.length;
  const someSelected =
    selectedIds.length > 0 && selectedIds.length < personnel.length;

  // Define columns for EnhancedDataTable
  const columns: EnhancedColumn<Personnel>[] = [
    ...(selectionMode ? [{
      key: "select",
      header: "",
      sortable: false,
      filterable: false,
      render: (person: Personnel) => (
        <Checkbox
          checked={selectedIds.includes(person.id)}
          onCheckedChange={() => onToggleSelection(person.id)}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        />
      ),
    }] : []),
    {
      key: "action",
      header: "Action",
      sortable: false,
      filterable: false,
      render: (person: Personnel) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/personnel/${person.id}`);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Personnel</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to deactivate {person.first_name} {person.last_name}? 
                  This will set their status to inactive. Time entries and other data will be preserved.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setPersonToDelete(person);
                    handleDelete();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
    {
      key: "avatar",
      header: "",
      sortable: false,
      filterable: false,
      render: (person: Personnel) => (
        <SecureAvatar
          bucket="personnel-photos"
          photoUrl={person.photo_url}
          className="h-8 w-8"
          fallback={
            <span className="text-xs">
              {person.first_name[0]}
              {person.last_name[0]}
            </span>
          }
          alt={`${person.first_name} ${person.last_name}`}
        />
      ),
    },
    {
      key: "name",
      header: "Name",
      sortable: true,
      filterable: true,
      getValue: (person) => `${person.first_name} ${person.last_name}`,
      render: (person: Personnel) => (
        <div className="flex items-center gap-1.5">
          <Link
            to={`/personnel/${person.id}`}
            className="text-primary hover:underline font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            {person.first_name} {person.last_name}
          </Link>
          <ComplianceBadge personnel={person} compact />
          {(person as any).portal_required === false && (
            <Badge variant="outline" className="gap-1 text-xs">
              <UserX className="h-3 w-3" />
              Temp
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "personnel_number",
      header: "Personnel #",
      sortable: true,
      filterable: true,
      getValue: (person) => person.personnel_number || "",
      render: (person: Personnel) => (
        <span className="text-muted-foreground text-sm">
          {person.personnel_number}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      getValue: (person) => person.status || "active",
      render: (person: Personnel) => getStatusBadge(person.status),
    },
    {
      key: "everify_status",
      header: "E-Verify",
      sortable: true,
      filterable: true,
      getValue: (person) => person.everify_status || "",
      render: (person: Personnel) => getEVerifyBadge(person.everify_status),
    },
    {
      key: "phone",
      header: "Phone",
      sortable: true,
      filterable: true,
      getValue: (person) => person.phone || "",
      render: (person: Personnel) => (
        <span className="text-muted-foreground text-sm">
          {person.phone || "—"}
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      filterable: true,
      getValue: (person) => person.email || "",
      render: (person: Personnel) => (
        <span className="text-muted-foreground max-w-[200px] truncate text-sm">
          {person.email || "—"}
        </span>
      ),
    },
    {
      key: "location",
      header: "Location",
      sortable: true,
      filterable: true,
      getValue: (person) => 
        person.city && person.state ? `${person.city}, ${person.state}` : "",
      render: (person: Personnel) => (
        <span className="text-muted-foreground text-sm">
          {person.city && person.state
            ? `${person.city}, ${person.state}`
            : "—"}
        </span>
      ),
    },
    {
      key: "vendor",
      header: "Vendor",
      sortable: true,
      filterable: true,
      getValue: (person) => getVendor(person.vendor_id)?.name || "",
      render: (person: Personnel) => {
        const vendor = getVendor(person.vendor_id);
        return vendor ? (
          <Link
            to={`/vendors/${vendor.id}`}
            className="text-primary hover:underline flex items-center gap-1 text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="max-w-[100px] truncate">
              {vendor.name}
            </span>
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "rate",
      header: "Rate",
      sortable: true,
      filterable: false,
      getValue: (person) => person.hourly_rate || 0,
      render: (person: Personnel) => (
        (person.hourly_rate ?? 0) > 0 ? (
          <span className="font-medium text-sm">
            ${person.hourly_rate}/hr
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      ),
    },
    {
      key: "actions",
      header: "",
      sortable: false,
      filterable: false,
      render: (person: Personnel) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => navigate(`/personnel/${person.id}`)}
            >
              <Eye className="mr-2 h-4 w-4" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                navigate(`/personnel/${person.id}?edit=true`)
              }
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handlePrintSingleBadge(person.id)}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print Badge
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setRolesDialogPerson(person);
              }}
            >
              <Briefcase className="mr-2 h-4 w-4" />
              Manage Roles
            </DropdownMenuItem>
            {qbConfig?.is_connected && (
              <DropdownMenuItem
                onClick={async (e) => {
                  e.stopPropagation();
                  setSyncingId(person.id);
                  try {
                    await syncPersonnelToQB.mutateAsync(person.id);
                    toast.success(`${person.first_name} ${person.last_name} synced to QuickBooks`);
                  } catch {
                    // Error handled in hook
                  } finally {
                    setSyncingId(null);
                  }
                }}
                disabled={syncingId === person.id}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${syncingId === person.id ? 'animate-spin' : ''}`} />
                {syncingId === person.id ? "Syncing..." : "Sync to QuickBooks"}
              </DropdownMenuItem>
            )}
            {person.status !== "active" && (
              <DropdownMenuItem
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await reactivatePersonnel.mutateAsync(person.id);
                  } catch {
                    // Error handled in hook
                  }
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reactivate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleToggleDNH(person)}
              className={
                person.status === "do_not_hire"
                  ? ""
                  : "text-destructive"
              }
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              {person.status === "do_not_hire"
                ? "Remove from DNH"
                : "Mark DNH"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setPersonToDelete(person);
                setDeleteDialogOpen(true);
              }}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Deactivate
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setPersonToHardDelete(person);
                setHardDeleteDialogOpen(true);
              }}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Permanently
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ] as EnhancedColumn<Personnel>[];

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Bulk Action Bar */}
      {selectionMode && selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 bg-muted rounded-lg">
          <span className="text-xs sm:text-sm font-medium">
            {selectedIds.length} selected
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={onPrintBadges}
              className="min-h-[36px] sm:min-h-[32px] text-xs sm:text-sm flex-1 sm:flex-none"
            >
              <Printer className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              Print Badges
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onClearSelection}
              className="min-h-[36px] sm:min-h-[32px] text-xs sm:text-sm flex-1 sm:flex-none"
            >
              <XSquare className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Mobile/Tablet Cards - hidden on desktop (1180px+) */}
      <div className="block min-[1180px]:hidden">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {personnel.map((person) => (
            <MobilePersonnelCard
              key={person.id}
              personnel={person}
              selectionMode={selectionMode}
              isSelected={selectedIds.includes(person.id)}
              onSelect={onToggleSelection}
              onPrintBadge={handlePrintSingleBadge}
            />
          ))}
        </div>
      </div>

      {/* Desktop Table - hidden below 1180px */}
      <div className="hidden min-[1180px]:block">
        <EnhancedDataTable
          tableId="personnel"
          data={personnel}
          columns={columns}
          onRowClick={(person) => {
            if (!selectionMode) {
              navigate(`/personnel/${person.id}`);
            }
          }}
        />
      </div>

      {/* Pagination */}
      <TablePagination
        currentPage={currentPage}
        totalCount={totalCount}
        rowsPerPage={rowsPerPage}
        onPageChange={onPageChange}
        onRowsPerPageChange={onRowsPerPageChange}
        rowsPerPageOptions={[10, 20, 30, 40]}
      />

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Personnel</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{" "}
              <strong>
                {personToDelete?.first_name} {personToDelete?.last_name}
              </strong>
              ? This will mark them as inactive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Confirmation Dialog */}
      <AlertDialog open={hardDeleteDialogOpen} onOpenChange={setHardDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Permanently Delete Personnel
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Are you sure you want to <strong>permanently delete</strong>{" "}
                <strong>
                  {personToHardDelete?.first_name} {personToHardDelete?.last_name}
                </strong>
                ?
                <br /><br />
                This will also delete:
                <ul className="list-disc list-inside mt-2 text-muted-foreground">
                  <li>Emergency contacts</li>
                  <li>Certifications</li>
                  <li>Languages</li>
                  <li>Capabilities</li>
                  <li>Onboarding tokens</li>
                </ul>
                <br />
                <strong className="text-destructive">This action cannot be undone.</strong>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleHardDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={hardDeletePersonnel.isPending}
            >
              {hardDeletePersonnel.isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage Roles Dialog */}
      {rolesDialogPerson && (
        <PersonnelRolesDialog
          open={!!rolesDialogPerson}
          onOpenChange={(open) => !open && setRolesDialogPerson(null)}
          personnelId={rolesDialogPerson.id}
          personnelName={`${rolesDialogPerson.first_name} ${rolesDialogPerson.last_name}`}
        />
      )}
    </div>
  );
}
