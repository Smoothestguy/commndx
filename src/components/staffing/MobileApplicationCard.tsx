import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, CheckCircle, XCircle, MoreVertical, Mail, Calendar, Briefcase, User, Undo2 } from "lucide-react";
import type { Application } from "@/integrations/supabase/hooks/useStaffingApplications";

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
  fieldTypeMap?: Record<string, { label: string; type: string }>;
}

export function MobileApplicationCard({
  application,
  onView,
  onApprove,
  onReject,
  onRevokeApproval,
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
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={profilePic || undefined} alt="Profile" />
            <AvatarFallback className="text-xs">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
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
                    {application.status === "approved" && onRevokeApproval && (
                      <DropdownMenuItem 
                        onClick={() => onRevokeApproval(application)}
                        className="text-destructive"
                      >
                        <Undo2 className="mr-2 h-4 w-4" />
                        Revoke Approval
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
            </div>

            <div className="space-y-1 text-xs text-muted-foreground">
              {application.applicants?.email && (
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{application.applicants.email}</span>
                </div>
              )}
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
                <span>{format(new Date(application.created_at), "MMM d, yyyy")}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
