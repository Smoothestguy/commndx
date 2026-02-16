import { CheckCircle, Clock, XCircle, Send, FileText, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ApprovalTimelineProps {
  changeOrderId: string;
  status: string;
  sentForApprovalAt: string | null;
  fieldSupervisorSignedAt: string | null;
  customerPmSignedAt: string | null;
  workAuthorized: boolean;
  customerWoNumber: string | null;
}

interface ApprovalLogEntry {
  id: string;
  action: string;
  actor_name: string | null;
  actor_email: string | null;
  notes: string | null;
  created_at: string;
}

export function ChangeOrderApprovalTimeline({
  changeOrderId,
  status,
  sentForApprovalAt,
  fieldSupervisorSignedAt,
  customerPmSignedAt,
  workAuthorized,
  customerWoNumber,
}: ApprovalTimelineProps) {
  const { data: logs } = useQuery({
    queryKey: ["co_approval_log", changeOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("change_order_approval_log")
        .select("*")
        .eq("change_order_id", changeOrderId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ApprovalLogEntry[];
    },
    enabled: !!changeOrderId,
  });

  const steps = [
    {
      label: "Submitted for Approval",
      completed: !!sentForApprovalAt,
      active: status === "pending_field_supervisor",
      date: sentForApprovalAt,
      icon: Send,
    },
    {
      label: "Field Supervisor Signed",
      completed: !!fieldSupervisorSignedAt,
      active: status === "pending_field_supervisor",
      date: fieldSupervisorSignedAt,
      icon: CheckCircle,
    },
    {
      label: "Customer PM Signed",
      completed: !!customerPmSignedAt,
      active: status === "pending_customer_pm",
      date: customerPmSignedAt,
      icon: CheckCircle,
    },
    {
      label: "Work Order Received",
      completed: workAuthorized,
      active: status === "approved_pending_wo",
      date: null,
      icon: Upload,
      extra: customerWoNumber ? `WO #${customerWoNumber}` : undefined,
    },
    {
      label: "Work Authorized",
      completed: workAuthorized,
      active: false,
      date: null,
      icon: FileText,
    },
  ];

  const isRejected = status === "rejected";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Approval Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isRejected && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-lg mb-4">
            <XCircle className="h-5 w-5" />
            <span className="font-medium">This change order has been rejected</span>
          </div>
        )}

        {!sentForApprovalAt && !isRejected && (
          <p className="text-sm text-muted-foreground">Not yet submitted for approval.</p>
        )}

        {(sentForApprovalAt || isRejected) && (
          <div className="space-y-4">
            {steps.map((step, i) => {
              const StepIcon = step.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className={`mt-0.5 ${step.completed ? "text-green-600" : step.active ? "text-amber-500" : "text-muted-foreground/30"}`}>
                    <StepIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${step.completed ? "text-foreground" : step.active ? "text-amber-600" : "text-muted-foreground/50"}`}>
                      {step.label}
                      {step.active && !step.completed && " — Waiting..."}
                    </p>
                    {step.date && (
                      <p className="text-xs text-muted-foreground">{format(new Date(step.date), "MMM d, yyyy 'at' h:mm a")}</p>
                    )}
                    {step.extra && <p className="text-xs text-muted-foreground">{step.extra}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Audit log */}
        {logs && logs.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Activity Log</h4>
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="text-xs">
                  <span className="text-muted-foreground">{format(new Date(log.created_at), "MMM d, h:mm a")}</span>
                  {" — "}
                  <span className="font-medium">{log.actor_name || log.actor_email || "System"}</span>
                  {" — "}
                  <span>{log.action.replace(/_/g, " ")}</span>
                  {log.notes && <span className="text-muted-foreground"> — {log.notes}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
