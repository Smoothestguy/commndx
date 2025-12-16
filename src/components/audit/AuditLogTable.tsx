import { useState } from "react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { AuditLog } from "@/integrations/supabase/hooks/useAuditLogs";
import { Skeleton } from "@/components/ui/skeleton";

interface AuditLogTableProps {
  logs: AuditLog[];
  isLoading: boolean;
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-500/10 text-green-600 border-green-500/20",
  update: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  delete: "bg-red-500/10 text-red-600 border-red-500/20",
  view: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  approve: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  reject: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  send: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  sign_in: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  sign_out: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  sign_up: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  payment: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  sync: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  upload: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  download: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20",
  invite: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  status_change: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  complete: "bg-lime-500/10 text-lime-600 border-lime-500/20",
};

const formatActionType = (action: string) => {
  return action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

const formatResourceType = (resource: string) => {
  return resource.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

const AuditLogRow = ({ log }: { log: AuditLog }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChanges = log.changes_before || log.changes_after;

  return (
    <>
      <TableRow className="group">
        <TableCell className="w-[4%]">
          {hasChanges ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <div className="w-6" />
          )}
        </TableCell>
        <TableCell className="w-[14%] whitespace-nowrap">
          <div className="flex flex-col">
            <span className="text-sm">
              {format(new Date(log.created_at), "MMM d, yyyy")}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(log.created_at), "h:mm:ss a")}
            </span>
          </div>
        </TableCell>
        <TableCell className="w-[22%]">
          <span className="text-sm truncate block">{log.user_email}</span>
        </TableCell>
        <TableCell className="w-[12%]">
          <Badge
            variant="outline"
            className={ACTION_COLORS[log.action_type] || ""}
          >
            {formatActionType(log.action_type)}
          </Badge>
        </TableCell>
        <TableCell className="w-[14%]">
          <span className="text-sm">
            {formatResourceType(log.resource_type)}
          </span>
        </TableCell>
        <TableCell className="w-[20%]">
          {log.resource_number ? (
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
              {log.resource_number}
            </code>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell className="w-[14%]">
          {log.success ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
        </TableCell>
      </TableRow>
      {hasChanges && isOpen && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={7} className="py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4">
              {log.changes_before &&
                Object.keys(log.changes_before).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                      Before
                    </h4>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48">
                      {JSON.stringify(log.changes_before, null, 2)}
                    </pre>
                  </div>
                )}
              {log.changes_after &&
                Object.keys(log.changes_after).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                      After
                    </h4>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48">
                      {JSON.stringify(log.changes_after, null, 2)}
                    </pre>
                  </div>
                )}
              {log.error_message && (
                <div className="md:col-span-2">
                  <h4 className="text-sm font-medium mb-2 text-red-500">
                    Error
                  </h4>
                  <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                    {log.error_message}
                  </p>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export const AuditLogTable = ({ logs, isLoading }: AuditLogTableProps) => {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No audit logs found</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[4%]"></TableHead>
            <TableHead className="w-[14%]">Timestamp</TableHead>
            <TableHead className="w-[22%]">User</TableHead>
            <TableHead className="w-[12%]">Action</TableHead>
            <TableHead className="w-[14%]">Resource</TableHead>
            <TableHead className="w-[20%]">Reference</TableHead>
            <TableHead className="w-[14%]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <AuditLogRow key={log.id} log={log} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
