import { useMemo } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SecureAvatar } from "@/components/ui/secure-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, CheckCircle, XCircle, ImageOff } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { PostingEntryCard } from "./PostingEntryCard";
import type { Application } from "@/integrations/supabase/hooks/useStaffingApplications";
import type { FormField } from "@/integrations/supabase/hooks/useApplicationFormTemplates";

const statusColors: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  reviewing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

interface PostingEntriesTableProps {
  applications: Application[];
  formFields: FormField[];
  isLoading: boolean;
  onViewApplication: (app: Application) => void;
  onApprove: (app: Application) => void;
  onReject: (app: Application) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

// Helper to find profile picture - prioritize applicant.photo_url, then answers
function getProfilePicture(
  answers: Record<string, unknown> | null,
  fields: FormField[],
  applicantPhotoUrl?: string | null
): string | null {
  // First check if applicant has a photo_url (core field)
  if (applicantPhotoUrl && typeof applicantPhotoUrl === "string" && applicantPhotoUrl.startsWith("http")) {
    return applicantPhotoUrl;
  }

  if (!answers) return null;

  // Fallback: look for file type fields in custom answers
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

// Format field value based on type
function formatFieldValue(value: unknown, field: FormField): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  switch (field.type) {
    case "file":
      if (typeof value === "string" && (value.startsWith("http") || value.startsWith("data:image"))) {
        return (
          <img
            src={value}
            alt={field.label}
            className="h-10 w-10 object-cover rounded"
          />
        );
      }
      return <span className="text-xs text-muted-foreground">File</span>;

    case "signature":
      if (typeof value === "string" && value.startsWith("data:image")) {
        return (
          <span className="text-xs text-green-600 font-medium">✓ Signed</span>
        );
      }
      return <span className="text-xs text-muted-foreground">—</span>;

    case "date":
      try {
        return (
          <span className="text-sm">
            {format(new Date(value as string), "MMM d, yyyy")}
          </span>
        );
      } catch {
        return <span className="text-sm">{String(value)}</span>;
      }

    case "checkbox":
      return value ? (
        <span className="text-green-600">✓</span>
      ) : (
        <span className="text-muted-foreground">✗</span>
      );

    case "multiselect":
      if (Array.isArray(value)) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.slice(0, 2).map((v, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {String(v)}
              </Badge>
            ))}
            {value.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{value.length - 2}
              </Badge>
            )}
          </div>
        );
      }
      return <span className="text-sm">{String(value)}</span>;

    case "address":
      if (typeof value === "object" && value !== null) {
        const addr = value as Record<string, string>;
        const parts = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean);
        return (
          <span className="text-sm whitespace-nowrap">
            {parts.join(", ").slice(0, 30)}
            {parts.join(", ").length > 30 ? "..." : ""}
          </span>
        );
      }
      return <span className="text-sm">{String(value)}</span>;

    default:
      const stringValue = String(value);
      return (
        <span className="text-sm whitespace-nowrap">
          {stringValue.length > 25 ? stringValue.slice(0, 25) + "..." : stringValue}
        </span>
      );
  }
}

export function PostingEntriesTable({
  applications,
  formFields,
  isLoading,
  onViewApplication,
  onApprove,
  onReject,
  selectable = false,
  selectedIds = new Set(),
  onSelectionChange,
}: PostingEntriesTableProps) {

  // Filter out profile picture field from columns (shown separately)
  const displayFields = useMemo(() => {
    return formFields.filter((f) => f.type !== "section");
  }, [formFields]);

  // Limit custom fields on desktop to prevent excessive columns
  const limitedDisplayFields = useMemo(() => {
    return displayFields.slice(0, 4);
  }, [displayFields]);

  const isAllSelected = applications.length > 0 && applications.every((app) => selectedIds.has(app.id));
  const isSomeSelected = applications.some((app) => selectedIds.has(app.id)) && !isAllSelected;

  const handleSelectAll = () => {
    if (isAllSelected) {
      onSelectionChange?.(new Set());
    } else {
      onSelectionChange?.(new Set(applications.map((app) => app.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    onSelectionChange?.(newSet);
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading entries...
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No entries found for this job posting
      </div>
    );
  }

  // Card view for tablet and mobile (< 1180px)
  return (
    <>
      {/* Card layout for tablet/mobile */}
      <div className="block min-[1180px]:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {applications.map((app) => (
            <PostingEntryCard
              key={app.id}
              application={app}
              formFields={formFields}
              onViewApplication={onViewApplication}
              onApprove={onApprove}
              onReject={onReject}
              selectable={selectable}
              isSelected={selectedIds.has(app.id)}
              onSelectionChange={handleSelectOne}
            />
          ))}
        </div>
      </div>

      {/* Table layout for desktop (>= 1180px) */}
      <div className="hidden min-[1180px]:block overflow-x-auto">
        <div className="min-w-max">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {selectable && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={isAllSelected ? true : isSomeSelected ? "indeterminate" : false}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-14">Photo</TableHead>
                <TableHead className="min-w-[150px]">Name</TableHead>
                <TableHead className="min-w-[180px]">Email</TableHead>
                <TableHead className="min-w-[120px]">Phone</TableHead>
                {limitedDisplayFields.map((field) => (
                  <TableHead key={field.id} className="min-w-[120px] max-w-[200px]">
                    {field.label}
                  </TableHead>
                ))}
                <TableHead className="min-w-[100px]">Submitted</TableHead>
                <TableHead className="min-w-[90px]">Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => {
                const answers = app.answers as Record<string, unknown> | null;
                const profilePic = getProfilePicture(answers, formFields, (app.applicants as any)?.photo_url);

                return (
                  <TableRow
                    key={app.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onViewApplication(app)}
                  >
                    {selectable && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(app.id)}
                          onCheckedChange={() => handleSelectOne(app.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onViewApplication(app)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="relative">
                              {profilePic ? (
                                <SecureAvatar
                                  bucket="application-files"
                                  photoUrl={profilePic}
                                  className="h-10 w-10 ring-2 ring-primary/20"
                                  fallback={<ImageOff className="h-4 w-4 text-muted-foreground" />}
                                  alt="Profile"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-muted/50 border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                                  <ImageOff className="h-4 w-4 text-muted-foreground/50" />
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {profilePic ? "View photo" : "No photo uploaded"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="font-medium">
                      {app.applicants?.first_name} {app.applicants?.last_name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {app.applicants?.email}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {app.applicants?.phone || "—"}
                    </TableCell>
                    {limitedDisplayFields.map((field) => (
                      <TableCell key={field.id}>
                        {formatFieldValue(answers?.[field.id], field)}
                      </TableCell>
                    ))}
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(app.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[app.status]}>
                        {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {app.status === "submitted" && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => onApprove(app)}
                            title="Approve"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => onReject(app)}
                            title="Reject"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
