import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Check, 
  X, 
  Lock,
  Info,
  Eye,
  Pencil,
  Trash2,
  FileCheck,
  Send,
  FileOutput,
  Receipt,
  DollarSign,
  Percent
} from "lucide-react";
import { AccessLevel, ChangeOrderPermissions } from "@/hooks/useChangeOrderPermissions";

interface PermissionSummaryCardProps {
  permissions: ChangeOrderPermissions;
  documentType?: string;
  status?: string;
}

const accessLevelConfig: Record<AccessLevel, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Shield }> = {
  read_only: { label: "Read Only", variant: "secondary", icon: Eye },
  edit: { label: "Edit Access", variant: "default", icon: Pencil },
  full_admin: { label: "Full Admin", variant: "default", icon: ShieldCheck },
};

interface ActionItem {
  label: string;
  allowed: boolean;
  icon: typeof Check;
  reason?: string;
}

export function PermissionSummaryCard({ permissions, documentType = "Change Order", status }: PermissionSummaryCardProps) {
  const { accessLevel, loading } = permissions;

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="h-4 w-4 animate-pulse" />
            <span>Loading permissions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const config = accessLevelConfig[accessLevel];
  const AccessIcon = config.icon;

  const actions: ActionItem[] = [
    { label: "View details", allowed: permissions.canView, icon: Eye },
    { label: "Edit details", allowed: permissions.canEdit, icon: Pencil, reason: !permissions.canEdit ? (status !== 'draft' ? "Only draft change orders can be edited" : "Insufficient permissions") : undefined },
    { label: "Delete", allowed: permissions.canDelete, icon: Trash2, reason: !permissions.canDelete ? (status !== 'draft' ? "Only draft change orders can be deleted" : "Insufficient permissions") : undefined },
    { label: "Submit for approval", allowed: permissions.canSubmitForApproval, icon: Send, reason: !permissions.canSubmitForApproval ? "Requires edit permission on draft" : undefined },
    { label: "Approve/Reject", allowed: permissions.canApprove, icon: FileCheck, reason: !permissions.canApprove ? "Admin or manager role required" : undefined },
    { label: "Convert to PO", allowed: permissions.canConvertToPO, icon: FileOutput, reason: !permissions.canConvertToPO ? "Requires approved change order" : undefined },
    { label: "Create Invoice", allowed: permissions.canCreateInvoice, icon: Receipt, reason: !permissions.canCreateInvoice ? "Requires approved change order" : undefined },
  ];

  const fieldAccess: ActionItem[] = [
    { label: "View/Edit line items", allowed: permissions.canEditLineItems, icon: Pencil },
    { label: "View/Edit pricing", allowed: permissions.canEditPricing, icon: DollarSign },
    { label: "View vendor costs", allowed: permissions.canViewCosts, icon: DollarSign, reason: !permissions.canViewCosts ? "Sensitive data permission required" : undefined },
    { label: "View profit margins", allowed: permissions.canViewMargins, icon: Percent, reason: !permissions.canViewMargins ? "Sensitive data permission required" : undefined },
    { label: "Change status", allowed: permissions.canEditStatus, icon: FileCheck, reason: !permissions.canEditStatus ? "Admin or manager role required" : undefined },
  ];

  const allowedActions = actions.filter(a => a.allowed).length;
  const totalActions = actions.length;

  return (
    <Card className="border-border/50 bg-muted/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Your Permissions
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={config.variant} className="flex items-center gap-1">
              <AccessIcon className="h-3 w-3" />
              {config.label}
            </Badge>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Permission Details
                  </DialogTitle>
                  <DialogDescription>
                    Your access rights for this {documentType}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Access Level</h4>
                    <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
                      <AccessIcon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      {accessLevel === 'full_admin' && "You have complete control over this document."}
                      {accessLevel === 'edit' && "You can modify this document while it's in draft status."}
                      {accessLevel === 'read_only' && "You can view but not modify this document."}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Available Actions ({allowedActions}/{totalActions})</h4>
                    <div className="space-y-1">
                      {actions.map((action) => (
                        <div key={action.label} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {action.allowed ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className={!action.allowed ? "text-muted-foreground" : ""}>{action.label}</span>
                          </div>
                          {!action.allowed && action.reason && (
                            <span className="text-xs text-muted-foreground">{action.reason}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Field Access</h4>
                    <div className="space-y-1">
                      {fieldAccess.map((field) => (
                        <div key={field.label} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {field.allowed ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className={!field.allowed ? "text-muted-foreground" : ""}>{field.label}</span>
                          </div>
                          {!field.allowed && field.reason && (
                            <span className="text-xs text-muted-foreground">{field.reason}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground border-t pt-3">
                    Contact your administrator to request additional permissions.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <div className="flex items-center gap-1">
            {permissions.canEdit ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className={!permissions.canEdit ? "text-muted-foreground" : ""}>Edit</span>
          </div>
          <div className="flex items-center gap-1">
            {permissions.canDelete ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className={!permissions.canDelete ? "text-muted-foreground" : ""}>Delete</span>
          </div>
          <div className="flex items-center gap-1">
            {permissions.canApprove ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className={!permissions.canApprove ? "text-muted-foreground" : ""}>Approve</span>
          </div>
          <div className="flex items-center gap-1">
            {permissions.canViewCosts ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className={!permissions.canViewCosts ? "text-muted-foreground" : ""}>Costs</span>
          </div>
          <div className="flex items-center gap-1">
            {permissions.canViewMargins ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className={!permissions.canViewMargins ? "text-muted-foreground" : ""}>Margins</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
