import { Card, CardContent } from "@/components/ui/card";
import { SecureAvatar } from "@/components/ui/secure-avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Phone, MapPin, AlertTriangle, Building2, Eye, Edit } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { ComplianceBadge } from "./ComplianceBadge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Database } from "@/integrations/supabase/types";

type Personnel = Database["public"]["Tables"]["personnel"]["Row"];

interface PersonnelCardProps {
  personnel: Personnel;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

export const PersonnelCard = ({
  personnel,
  selectionMode = false,
  isSelected = false,
  onSelect,
}: PersonnelCardProps) => {
  const navigate = useNavigate();
  const { data: vendors } = useVendors();
  
  // Find the vendor for this personnel
  const vendor = vendors?.find((v) => v.id === (personnel as any).vendor_id);

  const handleClick = () => {
    if (selectionMode && onSelect) {
      onSelect(personnel.id);
    } else if (!selectionMode) {
      navigate(`/personnel/${personnel.id}`);
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
            Do Not Hire
          </Badge>
        );
    }
  };

  const getEVerifyBadge = () => {
    switch (personnel.everify_status) {
      case "verified":
        return <Badge className="bg-green-600">Verified</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "expired":
        return <Badge variant="outline">Expired</Badge>;
      case "not_required":
        return <Badge variant="outline">Not Required</Badge>;
    }
  };

  const cardContent = (
    <Card
      className={`hover:shadow-md transition-all cursor-pointer ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
      onClick={handleClick}
    >
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          {selectionMode && (
            <div className="pt-1" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect?.(personnel.id)}
              />
            </div>
          )}
          <SecureAvatar
            bucket="personnel-photos"
            photoUrl={personnel.photo_url}
            className="h-12 w-12 sm:h-16 sm:w-16 flex-shrink-0"
            fallback={
              <span className="text-base sm:text-lg">
                {personnel.first_name[0]}
                {personnel.last_name[0]}
              </span>
            }
            alt={`${personnel.first_name} ${personnel.last_name}`}
          />

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base sm:text-lg truncate">
                    {personnel.first_name} {personnel.last_name}
                  </h3>
                  <ComplianceBadge personnel={personnel} compact />
                </div>
                <p className="text-sm text-muted-foreground">{personnel.personnel_number}</p>
              </div>
              <div className="flex flex-wrap gap-1 sm:gap-2 flex-shrink-0">
                {getStatusBadge()}
                {getEVerifyBadge()}
              </div>
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              {personnel.email && (
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{personnel.email}</span>
                </div>
              )}
              {personnel.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span>{personnel.phone}</span>
                </div>
              )}
              {personnel.city && personnel.state && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span>{personnel.city}, {personnel.state}</span>
                </div>
              )}
              {vendor && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 flex-shrink-0" />
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
              <div className="text-sm font-medium">
                Rate: ${personnel.hourly_rate}/hr
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Only wrap in context menu when not in selection mode
  if (selectionMode) {
    return cardContent;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {cardContent}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => navigate(`/personnel/${personnel.id}`)}>
          <Eye className="mr-2 h-4 w-4" />
          View Details
        </ContextMenuItem>
        <ContextMenuItem onClick={() => navigate(`/personnel/${personnel.id}?edit=true`)}>
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
