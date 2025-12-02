import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useApproveRegistration,
  useRejectRegistration,
  type PersonnelRegistration,
} from "@/integrations/supabase/hooks/usePersonnelRegistrations";
import { supabase } from "@/integrations/supabase/client";
import {
  User,
  MapPin,
  Shield,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";

const WORK_AUTH_TYPES: Record<string, string> = {
  citizen: "U.S. Citizen",
  permanent_resident: "Permanent Resident",
  work_visa: "Work Visa",
  ead: "Employment Authorization Document",
  other: "Other",
};

interface RegistrationReviewDialogProps {
  registration: PersonnelRegistration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RegistrationReviewDialog = ({
  registration,
  open,
  onOpenChange,
}: RegistrationReviewDialogProps) => {
  const approveRegistration = useApproveRegistration();
  const rejectRegistration = useRejectRegistration();

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  if (!registration) return null;

  const handleApprove = async () => {
    await approveRegistration.mutateAsync(registration.id);
    onOpenChange(false);
  };

  const handleReject = async () => {
    await rejectRegistration.mutateAsync({
      registrationId: registration.id,
      reason: rejectionReason,
    });
    setShowRejectDialog(false);
    setRejectionReason("");
    onOpenChange(false);
  };

  const openDocument = async (path: string) => {
    const { data } = await supabase.storage
      .from("personnel-documents")
      .createSignedUrl(path, 60 * 60); // 1 hour expiry

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  const isProcessing =
    approveRegistration.isPending || rejectRegistration.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Review Registration
              <Badge variant="secondary">Pending</Badge>
            </DialogTitle>
            <DialogDescription>
              Submitted{" "}
              {format(new Date(registration.created_at), "MMM d, yyyy 'at' h:mm a")}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Personal Information */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4" />
                  Personal Information
                </div>
                <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-muted-foreground">Name</p>
                      <p className="font-medium">
                        {registration.first_name} {registration.last_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{registration.email}</p>
                    </div>
                  </div>
                  {registration.phone && (
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      <p className="font-medium">{registration.phone}</p>
                    </div>
                  )}
                  {registration.date_of_birth && (
                    <div>
                      <p className="text-muted-foreground">Date of Birth</p>
                      <p className="font-medium">
                        {format(
                          new Date(registration.date_of_birth),
                          "MMMM d, yyyy"
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <Separator />

              {/* Address */}
              {(registration.address ||
                registration.city ||
                registration.state) && (
                <>
                  <section className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="h-4 w-4" />
                      Address
                    </div>
                    <div className="bg-muted rounded-lg p-4 text-sm">
                      <p className="font-medium">
                        {[
                          registration.address,
                          registration.city,
                          registration.state,
                          registration.zip,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                  </section>
                  <Separator />
                </>
              )}

              {/* Work Authorization */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Shield className="h-4 w-4" />
                  Work Authorization
                </div>
                <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <p className="font-medium">
                      {WORK_AUTH_TYPES[
                        registration.work_authorization_type || ""
                      ] || "-"}
                    </p>
                  </div>
                  {registration.work_auth_expiry && (
                    <div>
                      <p className="text-muted-foreground">Expiry Date</p>
                      <p className="font-medium">
                        {format(
                          new Date(registration.work_auth_expiry),
                          "MMMM d, yyyy"
                        )}
                      </p>
                    </div>
                  )}
                  {registration.ssn_last_four && (
                    <div>
                      <p className="text-muted-foreground">SSN (Last 4)</p>
                      <p className="font-medium">
                        •••-••-{registration.ssn_last_four}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <Separator />

              {/* Documents */}
              {registration.documents.length > 0 && (
                <>
                  <section className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4" />
                      Documents ({registration.documents.length})
                    </div>
                    <div className="space-y-2">
                      {registration.documents.map((doc, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-muted rounded-lg p-3"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {doc.name}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDocument(doc.path)}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  </section>
                  <Separator />
                </>
              )}

              {/* Emergency Contacts */}
              {registration.emergency_contacts.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Users className="h-4 w-4" />
                    Emergency Contacts ({registration.emergency_contacts.length}
                    )
                  </div>
                  <div className="space-y-2">
                    {registration.emergency_contacts.map((contact, index) => (
                      <div
                        key={index}
                        className="bg-muted rounded-lg p-4 text-sm"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{contact.name}</p>
                          {contact.is_primary && (
                            <Badge variant="outline" className="text-xs">
                              Primary
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground">
                          {contact.relationship} • {contact.phone}
                          {contact.email && ` • ${contact.email}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(true)}
              disabled={isProcessing}
              className="text-destructive hover:text-destructive"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button onClick={handleApprove} disabled={isProcessing}>
              {approveRegistration.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Approve & Create Personnel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Registration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this registration? The applicant
              will not be added to the personnel system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="rejection-reason">
              Reason for Rejection (optional)
            </Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rejectRegistration.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Reject Registration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
