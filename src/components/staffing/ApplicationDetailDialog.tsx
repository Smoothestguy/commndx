import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Pencil, User, Save, X, AlertCircle, RefreshCw, Trash2, ShieldCheck, Upload, Calendar, CheckCircle2, MessageSquare, Send } from "lucide-react";
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
  useApproveApplicationWithType,
  type ApprovalRecordType,
  useRejectApplication,
  useRevokeApproval,
  useRemoveFromPosting,
  useUpdateApplicant,
  useUpdateApplication,
} from "@/integrations/supabase/hooks/useStaffingApplications";
import {
  useApplicationFormTemplate,
  FormField,
} from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import {
  useApplicationNotes,
  useAddApplicationNote,
  useToggleApplicationContacted,
} from "@/integrations/supabase/hooks/useApplicationNotes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RequestMissingInfoDialog } from "./RequestMissingInfoDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { ApprovalTypeSelectionDialog, type RecordType } from "@/components/personnel/ApprovalTypeSelectionDialog";

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
  const [adminBypassMode, setAdminBypassMode] = useState(false);
  const [bypassPhotoUrl, setBypassPhotoUrl] = useState<string>("");
  const [bypassDob, setBypassDob] = useState<string>("");
  const [isSavingBypass, setIsSavingBypass] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [showTypeSelectionDialog, setShowTypeSelectionDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    home_zip: "",
  });

  const { isAdmin } = useUserRole();

  // Application notes
  const { data: notes = [], isLoading: notesLoading } = useApplicationNotes(application?.id);
  const addNote = useAddApplicationNote();
  const toggleContacted = useToggleApplicationContacted();

  const formTemplateId = application?.job_postings?.form_template_id;
  const { data: formTemplate } = useApplicationFormTemplate(
    formTemplateId || ""
  );

  const approveApplication = useApproveApplication();
  const approveApplicationWithType = useApproveApplicationWithType();
  const rejectApplication = useRejectApplication();
  const revokeApproval = useRevokeApproval();
  const removeFromPosting = useRemoveFromPosting();
  const updateApplicant = useUpdateApplicant();
  const updateApplication = useUpdateApplication();
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [showRemoveFromPostingConfirm, setShowRemoveFromPostingConfirm] = useState(false);

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

  const handleApprove = () => {
    // Show the type selection dialog instead of directly approving
    setShowTypeSelectionDialog(true);
  };

  const handleApproveWithType = async (recordType: RecordType) => {
    if (!application) return;
    try {
      await approveApplicationWithType.mutateAsync({
        applicationId: application.id,
        recordType: recordType as ApprovalRecordType,
        notes: actionNotes,
      });
      
      const typeLabel = recordType === 'personnel_vendor' 
        ? 'Personnel + Vendor' 
        : recordType.charAt(0).toUpperCase() + recordType.slice(1);
      toast.success(`Application approved! ${typeLabel} record(s) created.`);
      setShowTypeSelectionDialog(false);
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

  const handleRevokeApproval = async () => {
    if (!application) return;
    try {
      await revokeApproval.mutateAsync({ applicationId: application.id });
      toast.success("Entire applicant record deleted. They can now reapply.");
      setShowRevokeConfirm(false);
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to delete applicant");
    }
  };

  const handleRemoveFromPosting = async () => {
    if (!application) return;
    try {
      await removeFromPosting.mutateAsync({ applicationId: application.id });
      toast.success("Removed from this posting. Applicant remains in system for other applications.");
      setShowRemoveFromPostingConfirm(false);
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to remove from posting");
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

  // Handle photo file upload for admin bypass
  const handleBypassPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setBypassPhotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Save admin bypass and approve
  const handleAdminBypassApprove = async () => {
    if (!application) return;

    setIsSavingBypass(true);
    try {
      // Get missing fields to know what to update
      const missingFields = (application.missing_fields || []) as string[];
      
      // Update applicant photo_url if photo was missing and provided
      if (missingFields.includes("Profile Photo") && bypassPhotoUrl) {
        await updateApplicant.mutateAsync({
          id: application.applicants.id,
          photo_url: bypassPhotoUrl,
        });
      }

      // Update application answers for DOB if it was missing and provided
      if (missingFields.includes("Date Of Birth") && bypassDob) {
        const currentAnswers = (application.answers || {}) as Record<string, unknown>;
        // Find the DOB field ID from the form template
        const dobField = formTemplate?.fields?.find(
          (f: FormField) => f.label.toLowerCase().includes("date of birth") || f.label.toLowerCase().includes("dob")
        );
        
        if (dobField) {
          const updatedAnswers = {
            ...currentAnswers,
            [dobField.id]: bypassDob,
          };
          
          await updateApplication.mutateAsync({
            id: application.id,
            answers: updatedAnswers,
          });
        }
      }

      // Add note about admin bypass
      const bypassNote = `[Admin Bypass] Missing info entered manually by admin on ${format(new Date(), "MMM d, yyyy")}`;
      const updatedNotes = actionNotes ? `${actionNotes}\n\n${bypassNote}` : bypassNote;

      // Change status to submitted then approve
      await updateApplication.mutateAsync({
        id: application.id,
        status: "submitted",
        notes: updatedNotes,
        missing_fields: null,
      });

      // Now approve the application
      await approveApplication.mutateAsync({
        applicationId: application.id,
        notes: updatedNotes,
      });

      toast.success("Application approved via admin bypass");
      setAdminBypassMode(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error during admin bypass:", error);
      toast.error(error.message || "Failed to complete admin bypass");
    } finally {
      setIsSavingBypass(false);
    }
  };

  // Get missing fields info for display
  const missingFieldsInfo = useMemo(() => {
    const fields = (application?.missing_fields || []) as string[];
    return {
      hasPhoto: fields.includes("Profile Photo"),
      hasDob: fields.includes("Date Of Birth"),
      fields,
    };
  }, [application?.missing_fields]);

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

                {/* Contact Status & Notes Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-muted-foreground text-sm font-medium">
                        Notes & Communication
                      </Label>
                    </div>
                    <Button
                      variant={application.contacted_at ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        const newState = !application.contacted_at;
                        toggleContacted.mutate(
                          { applicationId: application.id, contacted: newState },
                          {
                            onSuccess: () => {
                              toast.success(newState ? "Marked as contacted" : "Marked as not contacted");
                            },
                            onError: () => {
                              toast.error("Failed to update contact status");
                            },
                          }
                        );
                      }}
                      disabled={toggleContacted.isPending}
                      className={application.contacted_at ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {application.contacted_at ? "Contacted" : "Mark Contacted"}
                    </Button>
                  </div>

                  {/* Notes list */}
                  {notes.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {notes.map((note) => (
                        <div key={note.id} className="p-3 bg-muted rounded-lg">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span className="font-medium">{note.user_name}</span>
                            <span>{format(new Date(note.created_at), "MMM d, yyyy h:mm a")}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add note form */}
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Add a note about this applicant..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="min-h-[60px] flex-1"
                      rows={2}
                    />
                    <Button
                      onClick={() => {
                        if (!newNote.trim() || !application) return;
                        addNote.mutate(
                          { applicationId: application.id, content: newNote.trim() },
                          {
                            onSuccess: () => {
                              setNewNote("");
                              toast.success("Note added");
                            },
                            onError: () => {
                              toast.error("Failed to add note");
                            },
                          }
                        );
                      }}
                      disabled={!newNote.trim() || addNote.isPending}
                      size="icon"
                      className="h-[60px] w-10"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Admin Notes (legacy single field) */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">
                    Internal Admin Notes
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
              <div className="flex flex-wrap gap-2 w-full justify-end">
                <Button variant="outline" onClick={handleCancelEdit} className="flex-1 sm:flex-none">
                  <X className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Cancel</span>
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={updateApplicant.isPending}
                  className="flex-1 sm:flex-none"
                >
                  <Save className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Save Changes</span>
                  <span className="sm:hidden">Save</span>
                </Button>
              </div>
            ) : (
              <>
                {(application.status === "submitted" ||
                  application.status === "updated") && (
                  <div className="flex flex-wrap gap-2 w-full justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setRequestInfoDialogOpen(true)}
                      className="flex-1 sm:flex-none"
                    >
                      <AlertCircle className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Request Info</span>
                      <span className="sm:hidden">Info</span>
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={rejectApplication.isPending}
                      className="flex-1 sm:flex-none"
                    >
                      Reject
                    </Button>
                    <Button
                      onClick={handleApprove}
                      disabled={approveApplication.isPending}
                      className="flex-1 sm:flex-none"
                    >
                      <span className="hidden lg:inline">Approve & Add to Personnel</span>
                      <span className="lg:hidden">Approve</span>
                    </Button>
                  </div>
                )}
                {application.status === "needs_info" && (
                  <div className="flex flex-col gap-3 w-full">
                    {/* Admin Bypass Mode */}
                    {isAdmin && adminBypassMode && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-4">
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                          <ShieldCheck className="h-4 w-4" />
                          <span className="font-medium text-sm">Admin Bypass - Enter Missing Info</span>
                        </div>
                        
                        <div className="space-y-3">
                          {missingFieldsInfo.hasPhoto && (
                            <div className="space-y-2">
                              <Label className="text-sm">Profile Photo</Label>
                              <div className="flex items-center gap-3">
                                {bypassPhotoUrl ? (
                                  <img 
                                    src={bypassPhotoUrl} 
                                    alt="Uploaded photo" 
                                    className="h-16 w-16 rounded-full object-cover border"
                                  />
                                ) : (
                                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border">
                                    <User className="h-6 w-6 text-muted-foreground" />
                                  </div>
                                )}
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleBypassPhotoUpload}
                                  />
                                  <div className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-muted transition-colors text-sm">
                                    <Upload className="h-4 w-4" />
                                    Upload Photo
                                  </div>
                                </label>
                              </div>
                            </div>
                          )}
                          
                          {missingFieldsInfo.hasDob && (
                            <div className="space-y-2">
                              <Label className="text-sm">Date of Birth</Label>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="date"
                                  value={bypassDob}
                                  onChange={(e) => setBypassDob(e.target.value)}
                                  className="max-w-[200px]"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setAdminBypassMode(false);
                              setBypassPhotoUrl("");
                              setBypassDob("");
                            }}
                            className="flex-1 sm:flex-none"
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={rejectApplication.isPending}
                            className="flex-1 sm:flex-none"
                          >
                            Reject
                          </Button>
                          <Button
                            onClick={handleAdminBypassApprove}
                            disabled={isSavingBypass || approveApplication.isPending}
                            className="flex-1 sm:flex-none"
                          >
                            <ShieldCheck className="h-4 w-4 mr-1" />
                            {isSavingBypass ? "Processing..." : "Approve (Bypass)"}
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Normal needs_info buttons */}
                    {!adminBypassMode && (
                      <div className="flex flex-wrap gap-2 w-full justify-end">
                        {isAdmin && (
                          <Button
                            variant="outline"
                            onClick={() => setAdminBypassMode(true)}
                            className="flex-1 sm:flex-none border-amber-500 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                          >
                            <ShieldCheck className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Admin Bypass</span>
                            <span className="sm:hidden">Bypass</span>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          onClick={handleResendEmail}
                          disabled={isResending}
                          className="flex-1 sm:flex-none"
                        >
                          <RefreshCw
                            className={`h-4 w-4 sm:mr-1 ${
                              isResending ? "animate-spin" : ""
                            }`}
                          />
                          <span className="hidden sm:inline">{isResending ? "Sending..." : "Resend Email"}</span>
                          <span className="sm:hidden">{isResending ? "..." : "Resend"}</span>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => onOpenChange(false)}
                          className="flex-1 sm:flex-none"
                        >
                          <span className="hidden md:inline">Close (Awaiting Applicant Update)</span>
                          <span className="md:hidden">Close</span>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {!showRevokeConfirm && !showRemoveFromPostingConfirm && (
                  <div className="flex flex-wrap gap-2 w-full justify-end">
                    <Button
                      variant="outline"
                      className="text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex-1 sm:flex-none"
                      onClick={() => setShowRemoveFromPostingConfirm(true)}
                    >
                      <X className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Remove from Posting</span>
                      <span className="sm:hidden">Remove</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10 flex-1 sm:flex-none"
                      onClick={() => setShowRevokeConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Delete Entire Applicant</span>
                      <span className="sm:hidden">Delete All</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      className="flex-1 sm:flex-none"
                    >
                      Close
                    </Button>
                  </div>
                )}
                {showRemoveFromPostingConfirm && (
                  <div className="flex flex-col gap-3 w-full">
                    <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                      <p className="font-medium">Remove from this posting only?</p>
                      <ul className="mt-2 list-disc pl-4 text-muted-foreground text-xs space-y-1">
                        <li>Their application for <strong>{application.job_postings?.project_task_orders?.title || "this position"}</strong> will be rejected</li>
                        <li>Their applicant record will remain in the system</li>
                        <li>Any other applications they have will not be affected</li>
                      </ul>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setShowRemoveFromPostingConfirm(false)}
                        className="flex-1 sm:flex-none"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="default"
                        className="bg-amber-600 hover:bg-amber-700 flex-1 sm:flex-none"
                        onClick={handleRemoveFromPosting}
                        disabled={removeFromPosting.isPending}
                      >
                        <span className="hidden sm:inline">{removeFromPosting.isPending ? "Removing..." : "Yes, Remove from Posting"}</span>
                        <span className="sm:hidden">{removeFromPosting.isPending ? "..." : "Remove"}</span>
                      </Button>
                    </div>
                  </div>
                )}
                {showRevokeConfirm && (
                  <div className="flex flex-col gap-3 w-full">
                    <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                      <p className="font-medium">Delete entire applicant record?</p>
                      <ul className="mt-2 list-disc pl-4 text-muted-foreground text-xs space-y-1">
                        <li>The applicant record for {application.applicants?.first_name} {application.applicants?.last_name} will be <strong>permanently deleted</strong></li>
                        <li><strong>All applications</strong> they have submitted will be deleted</li>
                        <li>Any associated personnel record will be deleted</li>
                      </ul>
                      <p className="mt-2 text-xs font-medium">They will be able to submit a new application from scratch.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setShowRevokeConfirm(false)}
                        className="flex-1 sm:flex-none"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleRevokeApproval}
                        disabled={revokeApproval.isPending}
                        className="flex-1 sm:flex-none"
                      >
                        <span className="hidden sm:inline">{revokeApproval.isPending ? "Deleting..." : "Yes, Delete Everything"}</span>
                        <span className="sm:hidden">{revokeApproval.isPending ? "..." : "Delete"}</span>
                      </Button>
                    </div>
                  </div>
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

      <ApprovalTypeSelectionDialog
        open={showTypeSelectionDialog}
        onOpenChange={setShowTypeSelectionDialog}
        onConfirm={handleApproveWithType}
        isLoading={approveApplicationWithType.isPending}
        applicantName={`${application?.applicants?.first_name || ''} ${application?.applicants?.last_name || ''}`}
      />
    </>
  );
}
