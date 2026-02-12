import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { SecureAvatar } from "@/components/ui/secure-avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
  Mail,
  Phone,
  MapPin,
  AlertTriangle,
  Building2,
  MoreVertical,
  Eye,
  Edit,
  Printer,
  Trash2,
  UserX,
  RotateCcw,
} from "lucide-react";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import {
  useDeletePersonnel,
  useToggleDoNotHire,
  useReactivatePersonnel,
} from "@/integrations/supabase/hooks/usePersonnel";
import { ComplianceBadge } from "./ComplianceBadge";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Personnel = Database["public"]["Tables"]["personnel"]["Row"];

interface MobilePersonnelCardProps {
  personnel: Personnel;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onPrintBadge?: (id: string) => void;
}

export const MobilePersonnelCard = ({
  personnel,
  selectionMode = false,
  isSelected = false,
  onSelect,
  onPrintBadge,
}: MobilePersonnelCardProps) => {
  const navigate = useNavigate();
  const { data: vendors } = useVendors();
  const deletePersonnel = useDeletePersonnel();
  const toggleDoNotHire = useToggleDoNotHire();
  const reactivatePersonnel = useReactivatePersonnel();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const vendor = vendors?.find((v) => v.id === personnel.vendor_id);

  const handleClick = () => {
    if (selectionMode && onSelect) {
      onSelect(personnel.id);
    } else if (!selectionMode) {
      navigate(`/personnel/${personnel.id}`);
    }
  };

  const handleDelete = async () => {
    try {
      await deletePersonnel.mutateAsync(personnel.id);
      toast.success("Personnel deactivated successfully");
      setDeleteDialogOpen(false);
    } catch (error) {
      toast.error("Failed to deactivate personnel");
    }
  };

  const handleToggleDNH = async () => {
    try {
      await toggleDoNotHire.mutateAsync({
        id: personnel.id,
        currentStatus: personnel.status || "active",
      });
      toast.success(
        personnel.status === "do_not_hire"
          ? "Personnel removed from Do Not Hire list"
          : "Personnel added to Do Not Hire list"
      );
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const getStatusBadge = () => {
    switch (personnel.status) {
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

  const getEVerifyBadge = () => {
    switch (personnel.everify_status) {
      case "verified":
        return <Badge className="bg-green-600 hover:bg-green-600/90">Verified</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "expired":
        return <Badge variant="outline">Expired</Badge>;
      case "not_required":
        return <Badge variant="outline">N/A</Badge>;
      default:
        return null;
    }
  };

  const cardContent = (
    <Card
      className={`hover:shadow-md transition-all cursor-pointer active:bg-muted/50 ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {selectionMode && (
            <div className="pt-1" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect?.(personnel.id)}
                className="h-5 w-5"
              />
            </div>
          )}
          <SecureAvatar
            bucket="personnel-photos"
            photoUrl={personnel.photo_url}
            className="h-12 w-12 flex-shrink-0"
            fallback={
              <span className="text-sm">
                {personnel.first_name[0]}
                {personnel.last_name[0]}
              </span>
            }
            alt={`${personnel.first_name} ${personnel.last_name}`}
          />

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-sm truncate">
                    {personnel.first_name} {personnel.last_name}
                  </h3>
                  <ComplianceBadge personnel={personnel} compact />
                </div>
                <p className="text-xs text-muted-foreground">
                  {personnel.personnel_number}
                </p>
              </div>
              <div
                className="flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => navigate(`/personnel/${personnel.id}`)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        navigate(`/personnel/${personnel.id}?edit=true`)
                      }
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onPrintBadge?.(personnel.id)}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print Badge
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {personnel.status !== "active" && (
                      <DropdownMenuItem
                        onClick={async () => {
                          try {
                            await reactivatePersonnel.mutateAsync(personnel.id);
                          } catch {
                            // Error handled in hook
                          }
                        }}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reactivate
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={handleToggleDNH}
                      className={
                        personnel.status === "do_not_hire"
                          ? ""
                          : "text-destructive"
                      }
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      {personnel.status === "do_not_hire"
                        ? "Remove from DNH"
                        : "Mark DNH"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteDialogOpen(true)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Deactivate
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {getStatusBadge()}
              {getEVerifyBadge()}
              {personnel.portal_required === false && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <UserX className="h-3 w-3" />
                  Temp
                </Badge>
              )}
            </div>

            <div className="space-y-1 text-xs text-muted-foreground">
              {personnel.email && (
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{personnel.email}</span>
                </div>
              )}
              {personnel.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{personnel.phone}</span>
                </div>
              )}
              {personnel.city && personnel.state && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    {personnel.city}, {personnel.state}
                  </span>
                </div>
              )}
              {vendor && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                  <Link
                    to={`/vendors/${vendor.id}`}
                    className="text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {vendor.name}
                  </Link>
                </div>
              )}
            </div>

            {(personnel.hourly_rate ?? 0) > 0 && (
              <div className="text-xs font-medium">
                Rate: ${personnel.hourly_rate}/hr
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const contextMenuContent = (
    <ContextMenuContent className="w-48">
      <ContextMenuItem onClick={() => navigate(`/personnel/${personnel.id}`)}>
        <Eye className="mr-2 h-4 w-4" />
        View
      </ContextMenuItem>
      <ContextMenuItem onClick={() => navigate(`/personnel/${personnel.id}?edit=true`)}>
        <Edit className="mr-2 h-4 w-4" />
        Edit
      </ContextMenuItem>
      <ContextMenuItem onClick={() => onPrintBadge?.(personnel.id)}>
        <Printer className="mr-2 h-4 w-4" />
        Print Badge
      </ContextMenuItem>
      <ContextMenuSeparator />
      {personnel.status !== "active" && (
        <ContextMenuItem
          onClick={async () => {
            try {
              await reactivatePersonnel.mutateAsync(personnel.id);
            } catch {
              // Error handled in hook
            }
          }}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reactivate
        </ContextMenuItem>
      )}
      <ContextMenuItem
        onClick={handleToggleDNH}
        className={personnel.status === "do_not_hire" ? "" : "text-destructive focus:text-destructive"}
      >
        <AlertTriangle className="mr-2 h-4 w-4" />
        {personnel.status === "do_not_hire" ? "Remove from DNH" : "Mark DNH"}
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => setDeleteDialogOpen(true)}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Deactivate
      </ContextMenuItem>
    </ContextMenuContent>
  );

  return (
    <>
      {selectionMode ? (
        cardContent
      ) : (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            {cardContent}
          </ContextMenuTrigger>
          {contextMenuContent}
        </ContextMenu>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Personnel</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{" "}
              <strong>
                {personnel.first_name} {personnel.last_name}
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
    </>
  );
};
