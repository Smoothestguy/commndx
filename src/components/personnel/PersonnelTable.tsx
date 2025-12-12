import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
} from "lucide-react";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import {
  useDeletePersonnel,
  useToggleDoNotHire,
} from "@/integrations/supabase/hooks/usePersonnel";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Personnel = Database["public"]["Tables"]["personnel"]["Row"];

interface PersonnelTableProps {
  personnel: Personnel[];
  selectionMode: boolean;
  selectedIds: string[];
  onToggleSelection: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onPrintBadges: () => void;
}

export function PersonnelTable({
  personnel,
  selectionMode,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onPrintBadges,
}: PersonnelTableProps) {
  const navigate = useNavigate();
  const { data: vendors } = useVendors();
  const deletePersonnel = useDeletePersonnel();
  const toggleDoNotHire = useToggleDoNotHire();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<Personnel | null>(null);

  const getVendor = (vendorId: string | null) => {
    if (!vendorId) return null;
    return vendors?.find((v) => v.id === vendorId);
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

  const allSelected =
    personnel.length > 0 && selectedIds.length === personnel.length;
  const someSelected =
    selectedIds.length > 0 && selectedIds.length < personnel.length;

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

      {/* Table with horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="min-w-[600px] sm:min-w-0 px-4 sm:px-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {selectionMode && (
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={allSelected}
                        ref={(ref) => {
                          if (ref) {
                            (ref as any).indeterminate = someSelected;
                          }
                        }}
                        onCheckedChange={() => {
                          if (allSelected) {
                            onClearSelection();
                          } else {
                            onSelectAll();
                          }
                        }}
                      />
                    </TableHead>
                  )}
                  <TableHead className="w-[50px] sm:w-[60px]">Action</TableHead>
                  <TableHead className="w-[40px] sm:w-[50px]"></TableHead>
                  <TableHead className="min-w-[100px]">Name</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Personnel #
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    E-Verify
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Location
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Vendor</TableHead>
                  <TableHead className="hidden md:table-cell">Rate</TableHead>
                  <TableHead className="w-[40px] sm:w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {personnel.map((person) => {
                  const vendor = getVendor(person.vendor_id);
                  return (
                    <TableRow
                      key={person.id}
                      className="cursor-pointer hover:bg-muted/50 active:bg-muted/70"
                      onClick={() => {
                        if (!selectionMode) {
                          navigate(`/personnel/${person.id}`);
                        }
                      }}
                    >
                      {selectionMode && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.includes(person.id)}
                            onCheckedChange={() => onToggleSelection(person.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 sm:h-9 sm:w-9"
                          onClick={() => navigate(`/personnel/${person.id}`)}
                        >
                          <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                          <AvatarImage src={person.photo_url || ""} />
                          <AvatarFallback className="text-[10px] sm:text-xs">
                            {person.first_name[0]}
                            {person.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium text-xs sm:text-sm">
                        {person.first_name} {person.last_name}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-xs sm:text-sm">
                        {person.personnel_number}
                      </TableCell>
                      <TableCell>{getStatusBadge(person.status)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {getEVerifyBadge(person.everify_status)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs sm:text-sm">
                        {person.phone || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground max-w-[200px] truncate text-xs sm:text-sm">
                        {person.email || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-xs sm:text-sm">
                        {person.city && person.state
                          ? `${person.city}, ${person.state}`
                          : "—"}
                      </TableCell>
                      <TableCell
                        className="hidden md:table-cell"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {vendor ? (
                          <Link
                            to={`/vendors/${vendor.id}`}
                            className="text-primary hover:underline flex items-center gap-1 text-xs sm:text-sm"
                          >
                            <Building2 className="h-3 w-3 shrink-0" />
                            <span className="max-w-[80px] sm:max-w-[100px] truncate">
                              {vendor.name}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs sm:text-sm">
                        {(person.hourly_rate ?? 0) > 0 ? (
                          <span className="font-medium">
                            ${person.hourly_rate}/hr
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 sm:h-9 sm:w-9"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                navigate(`/personnel/${person.id}`)
                              }
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
                              onClick={() => {
                                onToggleSelection(person.id);
                                onPrintBadges();
                              }}
                            >
                              <Printer className="mr-2 h-4 w-4" />
                              Print Badge
                            </DropdownMenuItem>
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
                              onClick={() => {
                                setPersonToDelete(person);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Deactivate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
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
    </div>
  );
}
