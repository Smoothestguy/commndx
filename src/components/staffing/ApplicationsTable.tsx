import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, CheckCircle, XCircle, User } from "lucide-react";
import { EnhancedDataTable, EnhancedColumn } from "@/components/shared/EnhancedDataTable";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileApplicationCard } from "./MobileApplicationCard";
import type { Application } from "@/integrations/supabase/hooks/useStaffingApplications";

const statusColors: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  reviewing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

// Helper to extract profile picture from application answers
function getProfilePicture(answers: Record<string, unknown> | null | undefined): string | null {
  if (!answers) return null;
  for (const value of Object.values(answers)) {
    if (typeof value === "string" && value.startsWith("data:image")) {
      return value;
    }
  }
  return null;
}

interface ApplicationsTableProps {
  applications: Application[];
  isLoading: boolean;
  onViewApplication: (app: Application) => void;
  onApprove: (app: Application) => void;
  onReject: (app: Application) => void;
}

export function ApplicationsTable({
  applications,
  isLoading,
  onViewApplication,
  onApprove,
  onReject,
}: ApplicationsTableProps) {
  const isMobile = useIsMobile();

  const columns: EnhancedColumn<Application>[] = [
    {
      key: "action",
      header: "",
      sortable: false,
      filterable: false,
      render: (app: Application) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={(e) => {
            e.stopPropagation();
            onViewApplication(app);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
    {
      key: "applicant",
      header: "Applicant",
      sortable: true,
      filterable: true,
      getValue: (app) => `${app.applicants?.first_name || ""} ${app.applicants?.last_name || ""}`,
      render: (app: Application) => {
        const profilePic = getProfilePicture(app.answers as Record<string, unknown>);
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={profilePic || undefined} alt="Profile" />
              <AvatarFallback className="text-xs">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">
                {app.applicants?.first_name} {app.applicants?.last_name}
              </p>
              <p className="text-sm text-muted-foreground">{app.applicants?.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "position",
      header: "Position",
      sortable: true,
      filterable: true,
      getValue: (app) => app.job_postings?.project_task_orders?.title || "",
      render: (app: Application) => (
        <div>
          <p className="font-medium">
            {app.job_postings?.project_task_orders?.title}
          </p>
          <p className="text-sm text-muted-foreground">
            {app.job_postings?.project_task_orders?.projects?.name}
          </p>
        </div>
      ),
    },
    {
      key: "submitted",
      header: "Submitted",
      sortable: true,
      filterable: false,
      getValue: (app) => app.created_at,
      render: (app: Application) => (
        <span className="text-muted-foreground text-sm">
          {format(new Date(app.created_at), "MMM d, yyyy")}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      getValue: (app) => app.status,
      render: (app: Application) => (
        <Badge className={statusColors[app.status]}>
          {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      sortable: false,
      filterable: false,
      render: (app: Application) => (
        app.status === "submitted" ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={(e) => {
                e.stopPropagation();
                onApprove(app);
              }}
              title="Approve"
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                onReject(app);
              }}
              title="Reject"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        ) : null
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading applications...
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No applications found
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {applications.map((app) => (
          <MobileApplicationCard
            key={app.id}
            application={app}
            onView={onViewApplication}
            onApprove={onApprove}
            onReject={onReject}
          />
        ))}
      </div>
    );
  }

  return (
    <EnhancedDataTable
      tableId="applications"
      data={applications}
      columns={columns}
      onRowClick={onViewApplication}
    />
  );
}
