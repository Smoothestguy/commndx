import { Building2, Mail, Phone, FolderOpen, Edit, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Customer } from "@/integrations/supabase/hooks/useCustomers";
import { getCustomerDisplayName, getCustomerSecondaryName } from "@/utils/customerDisplayName";

interface CustomerCardProps {
  customer: Customer;
  projectCount: number;
  onEdit: (customer: Customer) => void;
  onDelete: (id: string) => void;
  index?: number; // Made optional - no longer used for staggered animations
}

export const CustomerCard = ({
  customer,
  projectCount,
  onEdit,
  onDelete,
}: CustomerCardProps) => {
  const displayName = getCustomerDisplayName(customer);
  const contactName = getCustomerSecondaryName(customer);

  return (
    <div
      className="glass rounded-xl p-4 hover:shadow-lg transition-all duration-300 animate-fade-in border-l-4 border-l-primary/50"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-heading font-semibold text-lg text-foreground">
              {displayName}
            </h3>
            {customer.tax_exempt && (
              <Badge variant="secondary" className="text-xs">
                Tax Exempt
              </Badge>
            )}
          </div>
          {contactName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <User className="h-4 w-4" />
              <span>{contactName}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(customer);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(customer.id);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span className="truncate">{customer.email}</span>
        </div>
        {customer.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{customer.phone}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-border/50">
        <FolderOpen className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">
          {projectCount} {projectCount === 1 ? "project" : "projects"}
        </span>
      </div>
    </div>
  );
};
