import { Building2, Mail, Phone, Edit, Trash2, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Vendor } from "@/integrations/supabase/hooks/useVendors";

interface VendorCardProps {
  vendor: Vendor;
  onEdit: (vendor: Vendor) => void;
  onDelete: (id: string) => void;
  index: number;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

const vendorTypeColors: Record<string, string> = {
  contractor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  personnel: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  supplier: "bg-amber-500/10 text-amber-500 border-amber-500/20",
};

export const VendorCard = ({ vendor, onEdit, onDelete, index, isSelected, onSelect }: VendorCardProps) => {
  const navigate = useNavigate();
  const borderColor = vendor.status === "active" ? "border-l-success" : "border-l-muted";

  return (
    <div
      className={`glass rounded-xl p-4 hover:shadow-lg transition-all duration-300 animate-fade-in border-l-4 ${borderColor} cursor-pointer ${isSelected ? "ring-2 ring-primary" : ""}`}
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={() => navigate(`/vendors/${vendor.id}`)}
    >
      <div className="flex items-start gap-3">
        {onSelect && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect(vendor.id)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-heading font-semibold text-lg text-foreground mb-2">
                {vendor.name}
              </h3>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={vendor.status} />
                <Badge variant="outline" className={vendorTypeColors[vendor.vendor_type]}>
                  {vendor.vendor_type}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 sm:h-8 sm:w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(vendor);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 sm:h-8 sm:w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(vendor.id);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>

          <div className="space-y-2 mb-3">
            {vendor.company && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{vendor.company}</span>
              </div>
            )}
            {vendor.specialty && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Tag className="h-4 w-4" />
                <span>{vendor.specialty}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="truncate">{vendor.email}</span>
            </div>
            {vendor.phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{vendor.phone}</span>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
