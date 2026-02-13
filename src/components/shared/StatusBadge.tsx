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
  | "delayed"
  | "partially_billed"
  | "fully_billed"
  | "closed"
  | "open"
  | "partially_paid"
  | "void";

// Badge styles (outlined/subtle)
const badgeStyles: Record<Status, string> = {
  draft: "bg-muted text-muted-foreground border-muted-foreground/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  pending_approval: "bg-warning/10 text-warning border-warning/20",
  approved: "bg-success/10 text-success border-success/20",
  sent: "bg-primary/10 text-primary border-primary/20",
  paid: "bg-success/10 text-success border-success/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  active: "bg-success/10 text-success border-success/20",
  inactive: "bg-muted text-muted-foreground border-muted-foreground/20",
  "in-progress": "bg-primary/10 text-primary border-primary/20",
  "on-hold": "bg-warning/10 text-warning border-warning/20",
  completed: "bg-success/10 text-success border-success/20",
  acknowledged: "bg-primary/10 text-primary border-primary/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  delayed: "bg-destructive/10 text-destructive border-destructive/20",
  partially_billed: "bg-warning/10 text-warning border-warning/20",
  fully_billed: "bg-success/10 text-success border-success/20",
  closed: "bg-muted text-muted-foreground border-muted-foreground/20",
  open: "bg-primary/10 text-primary border-primary/20",
  partially_paid: "bg-warning/10 text-warning border-warning/20",
  void: "bg-destructive/10 text-destructive border-destructive/20",
};

// Cell styles (solid background for table cells)
const cellStyles: Record<Status, string> = {
  draft: "bg-muted-foreground text-white",
  pending: "bg-warning text-white",
  pending_approval: "bg-warning text-white",
  approved: "bg-success text-white",
  sent: "bg-primary text-white",
  paid: "bg-success text-white",
  overdue: "bg-destructive text-white",
  active: "bg-success text-white",
  inactive: "bg-muted-foreground text-white",
  "in-progress": "bg-primary text-white",
  "on-hold": "bg-warning text-white",
  completed: "bg-success text-white",
  acknowledged: "bg-primary text-white",
  cancelled: "bg-destructive text-white",
  delayed: "bg-destructive text-white",
  partially_billed: "bg-warning text-white",
  fully_billed: "bg-success text-white",
  closed: "bg-muted-foreground text-white",
  open: "bg-primary text-white",
  partially_paid: "bg-warning text-white",
  void: "bg-destructive text-white",
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
  partially_billed: "Partially Billed",
  fully_billed: "Fully Billed",
  closed: "Closed",
  open: "Open",
  partially_paid: "Partially Paid",
  void: "Void",
};

interface StatusBadgeProps {
  status: Status;
  variant?: 'badge' | 'cell';
  className?: string;
}

export function StatusBadge({ status, variant = 'badge', className }: StatusBadgeProps) {
  if (variant === 'cell') {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded",
          cellStyles[status],
          className
        )}
      >
        {statusLabels[status]}
      </div>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        badgeStyles[status],
        className
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
