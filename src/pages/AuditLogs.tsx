import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { AuditLogFilters } from "@/components/audit/AuditLogFilters";
import { AuditLogTable } from "@/components/audit/AuditLogTable";
import { useAuditLogs } from "@/integrations/supabase/hooks/useAuditLogs";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissionCheck } from "@/hooks/usePermissionCheck";
import { supabase } from "@/integrations/supabase/client";

const AuditLogs = () => {
  const navigate = useNavigate();
  const { isAdmin, isManager, loading: roleLoading } = useUserRole();
  const { canView, loading: permLoading } = usePermissionCheck('audit_logs');
  const [filters, setFilters] = useState({
    userEmail: "",
    actionType: "",
    resourceType: "",
    startDate: "",
    endDate: "",
    search: "",
  });

  const queryFilters = {
    userEmail: filters.userEmail || undefined,
    actionType: filters.actionType && filters.actionType !== "all" ? filters.actionType : undefined,
    resourceType: filters.resourceType && filters.resourceType !== "all" ? filters.resourceType : undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    search: filters.search || undefined,
  };

  const { data: logs = [], isLoading, refetch } = useAuditLogs(queryFilters, 500);

  // Redirect if not admin/manager and no permission
  useEffect(() => {
    if (roleLoading || permLoading) return;
    
    const hasAccess = isAdmin || isManager || canView;
    if (!hasAccess) {
      navigate("/");
    }
  }, [isAdmin, isManager, canView, roleLoading, permLoading, navigate]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("audit_logs_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_logs",
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const handleExport = () => {
    const csvContent = [
      ["Timestamp", "User Email", "Action", "Resource Type", "Resource #", "Success", "Error"],
      ...logs.map((log) => [
        log.created_at,
        log.user_email,
        log.action_type,
        log.resource_type,
        log.resource_number || "",
        log.success ? "Yes" : "No",
        log.error_message || "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (roleLoading || permLoading) {
    return null;
  }

  return (
    <PageLayout
      title="Audit Logs"
      description="Track all user activity and system changes"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {logs.length} log entries
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <AuditLogFilters filters={filters} onFiltersChange={setFilters} />

        <AuditLogTable logs={logs} isLoading={isLoading} />
      </div>
    </PageLayout>
  );
};

export default AuditLogs;
