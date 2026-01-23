import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SecureAvatar } from "@/components/ui/secure-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, CheckCircle, XCircle, ImageOff } from "lucide-react";
import type { Application } from "@/integrations/supabase/hooks/useStaffingApplications";
import type { FormField } from "@/integrations/supabase/hooks/useApplicationFormTemplates";

const statusColors: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  reviewing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

interface PostingEntryCardProps {
  application: Application;
  formFields: FormField[];
  onViewApplication: (app: Application) => void;
  onApprove: (app: Application) => void;
  onReject: (app: Application) => void;
  selectable?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (id: string) => void;
}

function getProfilePicture(
  answers: Record<string, unknown> | null,
  fields: FormField[],
  applicantPhotoUrl?: string | null
): string | null {
  if (applicantPhotoUrl && typeof applicantPhotoUrl === "string" && applicantPhotoUrl.startsWith("http")) {
    return applicantPhotoUrl;
  }

  if (!answers) return null;

  for (const field of fields) {
    if (field.type === "file") {
      const value = answers[field.id];
      if (typeof value === "string" && (value.startsWith("http") || value.startsWith("data:image"))) {
        return value;
      }
    }
  }

  return null;
}

export function PostingEntryCard({
  application,
  formFields,
  onViewApplication,
  onApprove,
  onReject,
  selectable = false,
  isSelected = false,
  onSelectionChange,
}: PostingEntryCardProps) {
  const answers = application.answers as Record<string, unknown> | null;
  const profilePic = getProfilePicture(answers, formFields, (application.applicants as any)?.photo_url);

  // Get key form field answers (first 2 non-file fields)
  const keyFields = formFields
    .filter(f => f.type !== "section" && f.type !== "file" && f.type !== "signature")
    .slice(0, 2);

  const getFieldValue = (fieldId: string): string => {
    const value = answers?.[fieldId];
    if (value === null || value === undefined || value === "") return "—";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  return (
    <div
      className="bg-card border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => onViewApplication(application)}
    >
      <div className="flex items-start gap-3">
        {selectable && (
          <div
            className="pt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onSelectionChange?.(application.id)}
            />
          </div>
        )}

        {/* Avatar */}
        <div className="shrink-0">
          {profilePic ? (
            <SecureAvatar
              bucket="application-files"
              photoUrl={profilePic}
              className="h-12 w-12 ring-2 ring-primary/20"
              fallback={<ImageOff className="h-5 w-5 text-muted-foreground" />}
              alt="Profile"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-muted/50 border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
              <ImageOff className="h-5 w-5 text-muted-foreground/50" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Name and Status */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-medium text-foreground truncate">
                {application.applicants?.first_name} {application.applicants?.last_name}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                {application.applicants?.email}
              </p>
            </div>
            <Badge className={`shrink-0 ${statusColors[application.status]}`}>
              {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
            </Badge>
          </div>

          {/* Phone & Date */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {application.applicants?.phone && (
              <span>{application.applicants.phone}</span>
            )}
            <span>
              {format(new Date(application.created_at), "MMM d, yyyy")}
            </span>
          </div>

          {/* Key form fields - hidden on mobile, shown on tablet */}
          {keyFields.length > 0 && (
            <div className="hidden sm:flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {keyFields.map(field => (
                <div key={field.id} className="flex items-center gap-1">
                  <span className="text-muted-foreground">{field.label}:</span>
                  <span className="font-medium truncate max-w-[120px]">
                    {getFieldValue(field.id)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={(e) => {
            e.stopPropagation();
            onViewApplication(application);
          }}
        >
          <Eye className="h-4 w-4 mr-1.5" />
          View
        </Button>
        {application.status === "submitted" && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={(e) => {
                e.stopPropagation();
                onApprove(application);
              }}
            >
              <CheckCircle className="h-4 w-4 mr-1.5" />
              Approve
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                onReject(application);
              }}
            >
              <XCircle className="h-4 w-4 mr-1.5" />
              Reject
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
