import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SecureAvatar } from "@/components/ui/secure-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, CheckCircle, XCircle, MoreVertical, Calendar, Briefcase, User, Trash2, CheckCircle2 } from "lucide-react";
import type { Application } from "@/integrations/supabase/hooks/useStaffingApplications";
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

interface MobileApplicationCardProps {
  application: Application;
  onView: (app: Application) => void;
  onApprove: (app: Application) => void;
  onReject: (app: Application) => void;
  onRevokeApproval?: (app: Application) => void;
  onToggleContacted?: (app: Application) => void;
  fieldTypeMap?: Record<string, { label: string; type: string }>;
}

export function MobileApplicationCard({
  application,
  onView,
  onApprove,
  onReject,
  onRevokeApproval,
  onToggleContacted,
  fieldTypeMap = {},
}: MobileApplicationCardProps) {
  const handleClick = () => {
    onView(application);
  };

  const profilePic = application.applicants?.photo_url || getProfilePicture(application.answers as Record<string, unknown>, fieldTypeMap);

  return (
    <Card
      className="hover:shadow-md transition-all cursor-pointer active:bg-muted/50"
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <SecureAvatar
            bucket="application-files"
            photoUrl={profilePic}
            className="h-10 w-10 flex-shrink-0"
            fallback={<User className="h-4 w-4" />}
            alt="Profile"
          />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm truncate">
                  {application.applicants?.first_name} {application.applicants?.last_name}
                </h3>
              </div>
              <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(application)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    {application.status === "submitted" && (
                      <>
                        <DropdownMenuItem 
                          onClick={() => onApprove(application)}
                          className="text-green-600"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => onReject(application)}
                          className="text-destructive"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </DropdownMenuItem>
                      </>
                    )}
                    {onRevokeApproval && (
                      <DropdownMenuItem 
                        onClick={() => onRevokeApproval(application)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Applicant
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              <Badge className={statusColors[application.status]}>
                {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
              </Badge>
              {application.contacted_at ? (
                <Badge
                  variant="outline"
                  className="text-green-600 border-green-600 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleContacted?.(application);
                  }}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Contacted
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-muted-foreground border-muted-foreground/50 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleContacted?.(application);
                  }}
                >
                  Not Contacted
                </Badge>
              )}
            </div>

            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                {(() => {
                  const city = getCityWithFallback(
                    application.applicants?.city,
                    application.answers as Record<string, unknown>
                  );
                  const state = getStateWithFallback(
                    application.applicants?.state,
                    application.answers as Record<string, unknown>
                  );
                  return (
                    <>
                      {city && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-foreground/70">City:</span>
                          <span>{city}</span>
                        </div>
                      )}
                      {state && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-foreground/70">State:</span>
                          <span>{state}</span>
                        </div>
                      )}
                      {!city && !state && <span>—</span>}
                    </>
                  );
                })()}
              </div>
              {application.job_postings?.project_task_orders?.title && (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">
                    {application.job_postings.project_task_orders.title}
                    {application.job_postings.project_task_orders.projects?.name && (
                      <span className="text-muted-foreground/70">
                        {" "}• {application.job_postings.project_task_orders.projects.name}
                      </span>
                    )}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  {format(
                    new Date((application as any).submitted_at || application.created_at),
                    "MMM d, yyyy h:mm a"
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
