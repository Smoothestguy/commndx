import { useMemo } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, CheckCircle, XCircle, User } from "lucide-react";
import { EnhancedDataTable, EnhancedColumn } from "@/components/shared/EnhancedDataTable";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileApplicationCard } from "./MobileApplicationCard";
import type { Application } from "@/integrations/supabase/hooks/useStaffingApplications";
import { useApplicationFormTemplates, FormField } from "@/integrations/supabase/hooks/useApplicationFormTemplates";

const statusColors: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  reviewing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

// Helper to extract profile picture from application answers using field type info
function getProfilePicture(
  answers: Record<string, unknown> | null | undefined,
  fieldTypeMap: Record<string, { label: string; type: string }>
): string | null {
  if (!answers) return null;
  
  // First pass: look for file type fields with images (excludes signatures)
  for (const [fieldId, value] of Object.entries(answers)) {
    const fieldInfo = fieldTypeMap[fieldId];
    if (
      fieldInfo?.type === "file" &&
      typeof value === "string" &&
      (value.startsWith("data:image") || value.startsWith("http"))
    ) {
      return value;
    }
  }

  // Fallback: if no field metadata, look for first image that's not from a signature field
  for (const [fieldId, value] of Object.entries(answers)) {
    const fieldInfo = fieldTypeMap[fieldId];
    // Skip if we know it's a signature
    if (fieldInfo?.type === "signature") continue;

    if (
      typeof value === "string" &&
      (value.startsWith("data:image") || value.startsWith("http"))
    ) {
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
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

export function ApplicationsTable({
  applications,
  isLoading,
  onViewApplication,
  onApprove,
  onReject,
  selectable = false,
  selectedIds,
  onSelectionChange,
}: ApplicationsTableProps) {
  const isMobile = useIsMobile();
  const { data: formTemplates } = useApplicationFormTemplates();

  // Build a map of form template id -> field type map for quick lookup
  const templateFieldMaps = useMemo(() => {
    const maps: Record<string, Record<string, { label: string; type: string }>> = {};
    if (formTemplates) {
      formTemplates.forEach((template) => {
        const fieldMap: Record<string, { label: string; type: string }> = {};
        template.fields?.forEach((field: FormField) => {
          fieldMap[field.id] = { label: field.label, type: field.type };
        });
        maps[template.id] = fieldMap;
      });
    }
    return maps;
  }, [formTemplates]);

  // Helper to get field type map for an application
  const getFieldTypeMap = (app: Application): Record<string, { label: string; type: string }> => {
    const templateId = app.job_postings?.form_template_id;
    return templateId ? templateFieldMaps[templateId] || {} : {};
  };

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
          const fieldTypeMap = getFieldTypeMap(app);
          const profilePic = app.applicants?.photo_url || getProfilePicture(app.answers as Record<string, unknown>, fieldTypeMap);
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
        {applications.map((app) => {
          const fieldTypeMap = getFieldTypeMap(app);
          return (
            <MobileApplicationCard
              key={app.id}
              application={app}
              onView={onViewApplication}
              onApprove={onApprove}
              onReject={onReject}
              fieldTypeMap={fieldTypeMap}
            />
          );
        })}
      </div>
    );
  }

  return (
    <EnhancedDataTable
      tableId="applications"
      data={applications}
      columns={columns}
      onRowClick={onViewApplication}
      selectable={selectable}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
    />
  );
}
