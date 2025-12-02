import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";

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

interface TimeTrackingTableProps {
  entries: TimeEntryWithDetails[];
  onEdit: (entry: TimeEntryWithDetails) => void;
}

export function TimeTrackingTable({ entries, onEdit }: TimeTrackingTableProps) {
  const columns = [
    {
      key: "entry_date",
      header: "Date",
      render: (entry: TimeEntryWithDetails) => format(new Date(entry.entry_date), "MMM dd, yyyy"),
      className: "w-[120px]",
    },
    {
      key: "personnel",
      header: "Personnel",
      render: (entry: TimeEntryWithDetails) => {
        const profile = entry.profiles;
        if (profile?.first_name && profile?.last_name) {
          return `${profile.first_name} ${profile.last_name}`;
        }
        return profile?.email || "Unknown";
      },
      className: "min-w-[150px]",
    },
    {
      key: "project",
      header: "Project",
      render: (entry: TimeEntryWithDetails) => entry.projects?.name || "Unknown",
      className: "min-w-[150px]",
    },
    {
      key: "customer",
      header: "Customer",
      render: (entry: TimeEntryWithDetails) => entry.projects?.customers?.name || "-",
      className: "min-w-[150px]",
    },
    {
      key: "hours",
      header: "Hours",
      render: (entry: TimeEntryWithDetails) => Number(entry.hours).toFixed(2),
      className: "w-[80px] text-right",
    },
    {
      key: "cost",
      header: "Cost",
      render: (entry: TimeEntryWithDetails) => {
        const hourlyRate = entry.profiles?.hourly_rate || 0;
        const cost = Number(entry.hours) * Number(hourlyRate);
        return `$${cost.toFixed(2)}`;
      },
      className: "w-[100px] text-right",
    },
    {
      key: "status",
      header: "Status",
      render: (entry: TimeEntryWithDetails) => {
        const status = entry.status || "pending";
        // Map time entry statuses to StatusBadge statuses
        const statusMap: Record<string, Status> = {
          pending: "pending",
          invoiced: "paid",
          approved: "approved",
        };
        const mappedStatus = statusMap[status] || "pending";
        return <StatusBadge status={mappedStatus} />;
      },
      className: "w-[100px]",
    },
    {
      key: "description",
      header: "Notes",
      render: (entry: TimeEntryWithDetails) => (
        <div className="max-w-[200px] truncate" title={entry.description || ""}>
          {entry.description || "-"}
        </div>
      ),
      className: "min-w-[150px]",
    },
    {
      key: "actions",
      header: "",
      render: (entry: TimeEntryWithDetails) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(entry)}
          className="h-8 w-8"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      ),
      className: "w-[50px]",
    },
  ];

  return <DataTable data={entries} columns={columns} />;
}
