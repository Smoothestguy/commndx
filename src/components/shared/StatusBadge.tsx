import { cn } from "@/lib/utils";

type Status = 
  | "draft" 
  | "pending" 
  | "pending_approval"
  | "approved" 
  | "sent" 
  | "paid" 
  | "overdue" 
  | "active" 
  | "inactive"
  | "in-progress"
  | "on-hold"
  | "completed"
  | "acknowledged"
  | "cancelled"
  | "delayed";

const statusStyles: Record<Status, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-warning/10 text-warning border-warning/20",
  pending_approval: "bg-warning/10 text-warning border-warning/20",
  approved: "bg-success/10 text-success border-success/20",
  sent: "bg-primary/10 text-primary border-primary/20",
  paid: "bg-success/10 text-success border-success/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  active: "bg-success/10 text-success border-success/20",
  inactive: "bg-muted text-muted-foreground",
  "in-progress": "bg-primary/10 text-primary border-primary/20",
  "on-hold": "bg-warning/10 text-warning border-warning/20",
  completed: "bg-success/10 text-success border-success/20",
  acknowledged: "bg-primary/10 text-primary border-primary/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  delayed: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusLabels: Record<Status, string> = {
  draft: "Draft",
  pending: "Pending",
  pending_approval: "Pending Approval",
  approved: "Approved",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  active: "Active",
  inactive: "Inactive",
  "in-progress": "In Progress",
  "on-hold": "On Hold",
  completed: "Completed",
  acknowledged: "Acknowledged",
  cancelled: "Cancelled",
  delayed: "Delayed",
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusStyles[status],
        className
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
