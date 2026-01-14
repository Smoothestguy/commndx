import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { 
  History, 
  LogIn, 
  LogOut, 
  Plus, 
  Pencil, 
  Trash2, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Send, 
  Upload, 
  Download,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  User
} from "lucide-react";
import type { AuditLog } from "@/integrations/supabase/hooks/useAuditLogs";
import { useState } from "react";

interface UserActivityHistoryProps {
  logs: AuditLog[] | undefined;
  isLoading: boolean;
  title?: string;
  description?: string;
  maxHeight?: string;
}

const actionConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  sign_in: { icon: LogIn, color: "bg-green-500/10 text-green-600 border-green-500/20", label: "Sign In" },
  sign_out: { icon: LogOut, color: "bg-gray-500/10 text-gray-600 border-gray-500/20", label: "Sign Out" },
  sign_up: { icon: User, color: "bg-blue-500/10 text-blue-600 border-blue-500/20", label: "Sign Up" },
  create: { icon: Plus, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "Created" },
  update: { icon: Pencil, color: "bg-amber-500/10 text-amber-600 border-amber-500/20", label: "Updated" },
  delete: { icon: Trash2, color: "bg-red-500/10 text-red-600 border-red-500/20", label: "Deleted" },
  view: { icon: Eye, color: "bg-slate-500/10 text-slate-600 border-slate-500/20", label: "Viewed" },
  approve: { icon: CheckCircle, color: "bg-green-500/10 text-green-600 border-green-500/20", label: "Approved" },
  reject: { icon: XCircle, color: "bg-red-500/10 text-red-600 border-red-500/20", label: "Rejected" },
  send: { icon: Send, color: "bg-blue-500/10 text-blue-600 border-blue-500/20", label: "Sent" },
  upload: { icon: Upload, color: "bg-purple-500/10 text-purple-600 border-purple-500/20", label: "Uploaded" },
  download: { icon: Download, color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20", label: "Downloaded" },
  payment: { icon: FileText, color: "bg-green-500/10 text-green-600 border-green-500/20", label: "Payment" },
  status_change: { icon: Clock, color: "bg-orange-500/10 text-orange-600 border-orange-500/20", label: "Status Changed" },
};

const resourceLabels: Record<string, string> = {
  estimate: "Estimate",
  invoice: "Invoice",
  purchase_order: "Purchase Order",
  job_order: "Job Order",
  change_order: "Change Order",
  vendor_bill: "Vendor Bill",
  personnel: "Personnel",
  vendor: "Vendor",
  project: "Project",
  customer: "Customer",
  auth: "Authentication",
  user: "User",
  permission: "Permission",
  file: "File",
  quickbooks: "QuickBooks",
  tm_ticket: "T&M Ticket",
  time_entry: "Time Entry",
};

export function UserActivityHistory({
  logs,
  isLoading,
  title = "Activity History",
  description = "Complete history of actions",
  maxHeight = "400px",
}: UserActivityHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getActionConfig = (actionType: string) => {
    return actionConfig[actionType] || { 
      icon: History, 
      color: "bg-muted text-muted-foreground border-border", 
      label: actionType 
    };
  };

  const getResourceLabel = (resourceType: string) => {
    return resourceLabels[resourceType] || resourceType;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  {title}
                  {logs && logs.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {logs.length}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            {!logs || logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No activity recorded yet</p>
              </div>
            ) : (
              <ScrollArea className="pr-4" style={{ maxHeight }}>
                <div className="space-y-3">
                  {logs.map((log) => {
                    const config = getActionConfig(log.action_type);
                    const Icon = config.icon;

                    return (
                      <div
                        key={log.id}
                        className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${config.color}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={config.color}>
                              {config.label}
                            </Badge>
                            <Badge variant="secondary">
                              {getResourceLabel(log.resource_type)}
                            </Badge>
                            {log.resource_number && (
                              <span className="text-sm font-mono text-muted-foreground">
                                #{log.resource_number}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                          {log.user_email && (
                            <p className="text-xs text-muted-foreground">
                              by {log.user_email}
                            </p>
                          )}
                          {!log.success && log.error_message && (
                            <p className="text-xs text-destructive mt-1">
                              Error: {log.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
