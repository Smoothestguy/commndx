import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Pencil, User, Save, X, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import {
  Application,
  useApproveApplication,
  useRejectApplication,
  useUpdateApplicant,
  useUpdateApplication,
} from "@/integrations/supabase/hooks/useStaffingApplications";
import {
  useApplicationFormTemplate,
  FormField,
} from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RequestMissingInfoDialog } from "./RequestMissingInfoDialog";

const statusColors: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  reviewing:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  needs_info:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  updated:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  approved:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

interface ApplicationDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: Application | null;
}

export function ApplicationDetailDialog({
  open,
  onOpenChange,
  application,
}: ApplicationDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [actionNotes, setActionNotes] = useState(application?.notes || "");
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [requestInfoDialogOpen, setRequestInfoDialogOpen] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    home_zip: "",
  });

  const formTemplateId = application?.job_postings?.form_template_id;
  const { data: formTemplate } = useApplicationFormTemplate(
    formTemplateId || ""
  );

  const approveApplication = useApproveApplication();
  const rejectApplication = useRejectApplication();
  const updateApplicant = useUpdateApplicant();
  const updateApplication = useUpdateApplication();

  // Build field label map from form template
  const fieldLabelMap = useMemo(() => {
    const map: Record<string, { label: string; type: string }> = {};
    if (formTemplate?.fields) {
      formTemplate.fields.forEach((field: FormField) => {
        map[field.id] = { label: field.label, type: field.type };
      });
    }
    return map;
  }, [formTemplate]);

  // Find profile picture - check applicant.photo_url first, then fall back to answers
  const profilePicture = useMemo(() => {
    // First check the applicant's photo_url (core field)
    if (application?.applicants?.photo_url) {
      return application.applicants.photo_url;
    }

    // Fall back to checking answers for file type fields (legacy behavior)
    if (!application?.answers) return null;
    const answers = application.answers as Record<string, unknown>;

    for (const [fieldId, value] of Object.entries(answers)) {
      const fieldInfo = fieldLabelMap[fieldId];
      // Skip signature fields - they're not profile pictures
      if (fieldInfo?.type === "signature") continue;
      if (
        fieldInfo?.type === "file" &&
        typeof value === "string" &&
        (value.startsWith("data:image") || value.startsWith("http"))
      ) {
        return value;
      }
    }
    return null;
  }, [application?.applicants?.photo_url, application?.answers, fieldLabelMap]);

  // Format form responses for display
  const formResponses = useMemo(() => {
    if (!application?.answers) return [];
    const answers = application.answers as Record<string, unknown>;
    const responses: {
      label: string;
      value: string;
      type: string;
      isImage: boolean;
    }[] = [];

    for (const [fieldId, value] of Object.entries(answers)) {
      const fieldInfo = fieldLabelMap[fieldId] || {
        label: fieldId,
        type: "text",
      };
      let displayValue = "";
      let isImage = false;

      if (value === null || value === undefined) {
        displayValue = "—";
      } else if (typeof value === "boolean") {
        displayValue = value ? "Yes" : "No";
      } else if (Array.isArray(value)) {
        displayValue = value.join(", ");
      } else if (typeof value === "object") {
        // Handle address objects
        const obj = value as Record<string, string>;
        if (obj.street || obj.city || obj.state || obj.zip) {
          const parts = [obj.street, obj.city, obj.state, obj.zip].filter(
            Boolean
          );
          displayValue = parts.join(", ");
        } else {
          displayValue = JSON.stringify(value);
        }
      } else if (typeof value === "string") {
        if (value.startsWith("data:image")) {
          isImage = true;
          displayValue = value;
        } else {
          displayValue = value;
        }
      } else {
        displayValue = String(value);
      }

      responses.push({
        label: fieldInfo.label,
        value: displayValue,
        type: fieldInfo.type,
        isImage,
      });
    }

    return responses;
  }, [application?.answers, fieldLabelMap]);

  const handleStartEdit = () => {
    if (application?.applicants) {
      setEditForm({
        first_name: application.applicants.first_name,
        last_name: application.applicants.last_name,
        email: application.applicants.email,
        phone: application.applicants.phone || "",
        home_zip: application.applicants.home_zip || "",
      });
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!application?.applicants) return;

    try {
      await updateApplicant.mutateAsync({
        id: application.applicants.id,
        ...editForm,
      });

      // Update notes if changed
      if (actionNotes !== application.notes) {
        await updateApplication.mutateAsync({
          id: application.id,
          notes: actionNotes,
        });
      }

      toast.success("Applicant updated successfully");
      setIsEditing(false);
    } catch (error) {
      toast.error("Failed to update applicant");
    }
  };

  const handleApprove = async () => {
    if (!application) return;
    try {
      await approveApplication.mutateAsync({
        applicationId: application.id,
        notes: actionNotes,
      });
      toast.success("Application approved! Applicant added to Personnel.");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to approve application");
    }
  };

  const handleReject = async () => {
    if (!application) return;
    try {
      await rejectApplication.mutateAsync({
        applicationId: application.id,
        notes: actionNotes,
      });
      toast.success("Application rejected");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to reject application");
    }
  };

  const handleResendEmail = async () => {
    if (!application) return;

    setIsResending(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-application-edit-request",
        {
          body: {
            applicationId: application.id,
            missingFields: application.missing_fields || [],
            adminMessage: application.admin_message || undefined,
          },
        }
      );

      if (error) throw error;

      if (data && !data.success) {
        toast.warning(
          `Application token refreshed, but email could not be sent: ${
            data.emailError || "Unknown error"
          }`,
          { duration: 8000 }
        );
      } else {
        toast.success("Edit request email resent to applicant");
      }
    } catch (error: any) {
      console.error("Error resending edit request:", error);
      toast.error(error.message || "Failed to resend edit request");
    } finally {
      setIsResending(false);
    }
  };

  if (!application) return null;

  const applicant = application.applicants;
  const initials = applicant
    ? `${applicant.first_name[0]}${applicant.last_name[0]}`.toUpperCase()
    : "??";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Application Details</DialogTitle>
                <DialogDescription>
                  Review application from {applicant?.first_name}{" "}
                  {applicant?.last_name}
                </DialogDescription>
              </div>
              {!isEditing && application.status === "submitted" && (
                <Button variant="outline" size="sm" onClick={handleStartEdit}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden min-h-0">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-6">
                {/* Profile Section */}
                <div className="flex items-start gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      profilePicture && setEnlargedImage(profilePicture)
                    }
                    className={`rounded-full transition-all ${
                      profilePicture
                        ? "cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2"
                        : "cursor-default"
                    }`}
                    disabled={!profilePicture}
                  >
                    <Avatar className="h-20 w-20">
                      <AvatarImage
                        src={profilePicture || undefined}
                        alt="Profile"
                      />
                      <AvatarFallback className="text-lg">
                        <User className="h-8 w-8" />
                      </AvatarFallback>
                    </Avatar>
                  </button>

                  <div className="flex-1 space-y-3">
                    {isEditing ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            First Name
                          </Label>
                          <Input
                            value={editForm.first_name}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                first_name: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Last Name
                          </Label>
                          <Input
                            value={editForm.last_name}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                last_name: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Email
                          </Label>
                          <Input
                            value={editForm.email}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                email: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Phone
                          </Label>
                          <Input
                            value={editForm.phone}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                phone: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Home ZIP
                          </Label>
                          <Input
                            value={editForm.home_zip}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                home_zip: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">
                            {applicant?.first_name} {applicant?.last_name}
                          </h3>
                          <Badge className={statusColors[application.status]}>
                            {application.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">
                              Email:
                            </span>{" "}
                            {applicant?.email}
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Phone:
                            </span>{" "}
                            {applicant?.phone || "N/A"}
                          </div>
                          <div>
                            <span className="text-muted-foreground">ZIP:</span>{" "}
                            {applicant?.home_zip || "N/A"}
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Submitted:
                            </span>{" "}
                            {format(
                              new Date(application.created_at),
                              "MMM d, yyyy"
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Position Info */}
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-sm">
                    Position
                  </Label>
                  <p className="font-medium">
                    {application.job_postings?.project_task_orders?.title}
                  </p>
                </div>

                <Separator />

                {/* Form Responses Table */}
                {formResponses.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-muted-foreground text-sm">
                      Form Responses
                    </Label>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-1/3">Field</TableHead>
                            <TableHead>Response</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {formResponses.map((response, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium text-muted-foreground">
                                {response.label}
                              </TableCell>
                              <TableCell>
                                {response.isImage ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEnlargedImage(response.value)
                                    }
                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                  >
                                    <img
                                      src={response.value}
                                      alt={response.label}
                                      className="max-h-24 rounded border"
                                    />
                                  </button>
                                ) : (
                                  <span className="whitespace-pre-wrap">
                                    {response.value}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Admin Notes */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">
                    Admin Notes
                  </Label>
                  <Textarea
                    placeholder="Add internal notes about this application..."
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            {isEditing ? (
              <div className="flex gap-2 w-full justify-end">
                <Button variant="outline" onClick={handleCancelEdit}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={updateApplicant.isPending}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save Changes
                </Button>
              </div>
            ) : (
              <>
                {(application.status === "submitted" ||
                  application.status === "updated") && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setRequestInfoDialogOpen(true)}
                    >
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Request Info
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={rejectApplication.isPending}
                    >
                      Reject
                    </Button>
                    <Button
                      onClick={handleApprove}
                      disabled={approveApplication.isPending}
                    >
                      Approve & Add to Personnel
                    </Button>
                  </>
                )}
                {application.status === "needs_info" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleResendEmail}
                      disabled={isResending}
                    >
                      <RefreshCw
                        className={`h-4 w-4 mr-1 ${
                          isResending ? "animate-spin" : ""
                        }`}
                      />
                      {isResending ? "Sending..." : "Resend Email"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                    >
                      Close (Awaiting Applicant Update)
                    </Button>
                  </>
                )}
                {application.status !== "submitted" &&
                  application.status !== "updated" &&
                  application.status !== "needs_info" && (
                    <Button
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                    >
                      Close
                    </Button>
                  )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageLightbox
        imageUrl={enlargedImage}
        onClose={() => setEnlargedImage(null)}
        alt="Application image"
      />

      <RequestMissingInfoDialog
        open={requestInfoDialogOpen}
        onOpenChange={setRequestInfoDialogOpen}
        application={application}
        onSuccess={() => onOpenChange(false)}
      />
    </>
  );
}
