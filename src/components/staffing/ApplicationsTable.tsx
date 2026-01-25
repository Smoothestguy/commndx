import { useMemo } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SecureAvatar } from "@/components/ui/secure-avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, CheckCircle, XCircle, User, Trash2, Undo2, Circle, CheckCircle2 } from "lucide-react";
import { EnhancedDataTable, EnhancedColumn } from "@/components/shared/EnhancedDataTable";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileApplicationCard } from "./MobileApplicationCard";
import type { Application } from "@/integrations/supabase/hooks/useStaffingApplications";
import { useApplicationFormTemplates, FormField } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { cn } from "@/lib/utils";
import { getCityWithFallback, getStateWithFallback } from "@/lib/locationUtils";

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
  onRevokeApproval?: (app: Application) => void;
  onReverseApproval?: (app: Application) => void;
  onToggleContacted?: (app: Application) => void;
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
  onRevokeApproval,
  onReverseApproval,
  onToggleContacted,
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
            <SecureAvatar
              bucket="application-files"
              photoUrl={profilePic}
              className="h-9 w-9"
              fallback={<User className="h-4 w-4" />}
              alt="Profile"
            />
            <p className="font-medium">
              {app.applicants?.first_name} {app.applicants?.last_name}
            </p>
          </div>
        );
      },
    },
    {
      key: "city",
      header: "City",
      sortable: true,
      filterable: true,
      getValue: (app) => getCityWithFallback(app.applicants?.city, app.answers as Record<string, unknown>) || "",
      render: (app: Application) => {
        const city = getCityWithFallback(app.applicants?.city, app.answers as Record<string, unknown>);
        return (
          <span className="text-muted-foreground">
            {city || "—"}
          </span>
        );
      },
    },
    {
      key: "state",
      header: "State",
      sortable: true,
      filterable: true,
      getValue: (app) => getStateWithFallback(app.applicants?.state, app.answers as Record<string, unknown>) || "",
      render: (app: Application) => {
        const state = getStateWithFallback(app.applicants?.state, app.answers as Record<string, unknown>);
        return (
          <span className="text-muted-foreground">
            {state || "—"}
          </span>
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
      getValue: (app) => app.submitted_at || app.created_at,
      render: (app: Application) => {
        const timestamp = app.submitted_at || app.created_at;
        return (
          <span className="text-muted-foreground text-sm">
            {format(new Date(timestamp), "MMM d, yyyy h:mm a")}
          </span>
        );
      },
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
      key: "contacted",
      header: "Contacted",
      sortable: true,
      filterable: true,
      getValue: (app) => app.contacted_at ? "Yes" : "No",
      render: (app: Application) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  app.contacted_at
                    ? "text-green-600 hover:text-green-700"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleContacted?.(app);
                }}
              >
                {app.contacted_at ? (
                  <CheckCircle2 className="h-4 w-4 fill-current" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {app.contacted_at
                ? `Contacted on ${format(new Date(app.contacted_at), "MMM d, yyyy")}`
                : "Mark as contacted"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
    },
    {
      key: "actions",
      header: "",
      sortable: false,
      filterable: false,
      render: (app: Application) => (
        <div className="flex items-center justify-end gap-1">
          {app.status === "submitted" && (
            <>
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
            </>
          )}
          {app.status === "approved" && onReverseApproval && (
            <Button
              variant="ghost"
              size="icon"
              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              onClick={(e) => {
                e.stopPropagation();
                onReverseApproval(app);
              }}
              title="Reverse Approval"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          )}
          {onRevokeApproval && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                onRevokeApproval(app);
              }}
              title="Delete Applicant"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
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
              onRevokeApproval={onRevokeApproval}
              onToggleContacted={onToggleContacted}
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
