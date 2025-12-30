import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  usePersonnelW9Form, 
  useVerifyW9Form,
  useRequestW9Edit,
  W9Form 
} from "@/integrations/supabase/hooks/useW9Forms";
import { format } from "date-fns";
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  ShieldCheck,
  ShieldX,
  Download,
  Pencil
} from "lucide-react";
import { downloadFormW9 } from "@/lib/generateW9";
import { toast } from "sonner";

interface W9FormViewProps {
  personnelId: string;
  personnelSsnLastFour?: string | null;
  personnelSsnFull?: string | null;
}

export function W9FormView({ personnelId, personnelSsnLastFour, personnelSsnFull }: W9FormViewProps) {
  const { data: w9Form, isLoading } = usePersonnelW9Form(personnelId);
  const verifyW9 = useVerifyW9Form();
  const requestW9Edit = useRequestW9Edit();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const handleRequestEdit = async () => {
    if (!w9Form) return;
    await requestW9Edit.mutateAsync({
      w9Id: w9Form.id,
      personnelId,
      daysValid: 7,
    });
  };

  // Check if edit permission is currently active
  const editPermissionActive = w9Form?.edit_allowed && 
    w9Form.edit_allowed_until && 
    new Date(w9Form.edit_allowed_until) > new Date();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pending Review</Badge>;
      case "verified":
        return <Badge className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Verified</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" /> Not Submitted</Badge>;
    }
  };

  const handleVerify = async () => {
    if (!w9Form) return;
    await verifyW9.mutateAsync({
      w9Id: w9Form.id,
      personnelId,
      action: "verify",
    });
  };

  const handleReject = async () => {
    if (!w9Form || !rejectionReason.trim()) return;
    await verifyW9.mutateAsync({
      w9Id: w9Form.id,
      personnelId,
      action: "reject",
      rejectionReason: rejectionReason.trim(),
    });
    setRejectDialogOpen(false);
    setRejectionReason("");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!w9Form) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            W-9 Form
          </CardTitle>
          <CardDescription>
            Request for Taxpayer Identification Number and Certification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No W-9 on File</AlertTitle>
            <AlertDescription>
              This personnel member has not yet submitted their W-9 form.
              They will be prompted to complete it when they access the personnel portal.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const handleDownloadW9 = () => {
    if (!w9Form) return;
    try {
      downloadFormW9({
        w9Form,
        ssnLastFour: personnelSsnLastFour,
        ssnFull: personnelSsnFull,
      });
      toast.success("W-9 PDF downloaded successfully");
    } catch (error) {
      console.error("Error generating W-9 PDF:", error);
      toast.error("Failed to generate W-9 PDF");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>W-9 Form</CardTitle>
                <CardDescription>Request for Taxpayer Identification Number and Certification</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownloadW9}
                className="gap-1"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              {getStatusBadge(w9Form.status)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Rejection Alert */}
          {w9Form.status === "rejected" && w9Form.rejection_reason && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Previously Rejected</AlertTitle>
              <AlertDescription>{w9Form.rejection_reason}</AlertDescription>
            </Alert>
          )}

          {/* Verification Actions */}
          {w9Form.status === "completed" && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertTitle>Awaiting Review</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>This W-9 form is pending admin verification.</span>
                <div className="flex gap-2 ml-4">
                  <Button 
                    size="sm" 
                    onClick={handleVerify}
                    disabled={verifyW9.isPending}
                    className="gap-1"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Verify
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => setRejectDialogOpen(true)}
                    disabled={verifyW9.isPending}
                    className="gap-1"
                  >
                    <ShieldX className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Request Edit Button for Verified W-9s */}
          {w9Form.status === "verified" && !editPermissionActive && (
            <div className="flex items-center gap-3">
              <Button 
                variant="outline"
                size="sm"
                onClick={handleRequestEdit}
                disabled={requestW9Edit.isPending}
                className="gap-1"
              >
                <Pencil className="h-4 w-4" />
                Request Edit
              </Button>
              <span className="text-sm text-muted-foreground">
                Allow personnel to modify their W-9
              </span>
            </div>
          )}

          {/* Show if edit is currently allowed */}
          {editPermissionActive && (
            <Alert>
              <Pencil className="h-4 w-4" />
              <AlertTitle>Edit Permission Granted</AlertTitle>
              <AlertDescription>
                Personnel can edit their W-9 until {format(new Date(w9Form.edit_allowed_until!), "MMM d, yyyy 'at' h:mm a")}
              </AlertDescription>
            </Alert>
          )}

          {/* Part 1: Identification */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Part I: Identification (Rev. March 2024)
            </h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-muted-foreground text-xs">Name of entity/individual (Line 1)</Label>
                <p className="font-medium">{w9Form.name_on_return}</p>
              </div>
              {w9Form.business_name && (
                <div>
                  <Label className="text-muted-foreground text-xs">Business Name (Line 2)</Label>
                  <p className="font-medium">{w9Form.business_name}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground text-xs">Federal Tax Classification (Line 3a)</Label>
                <p className="font-medium capitalize">{w9Form.federal_tax_classification.replace(/_/g, " ")}</p>
              </div>
              {w9Form.llc_tax_classification && (
                <div>
                  <Label className="text-muted-foreground text-xs">LLC Tax Classification</Label>
                  <p className="font-medium">{w9Form.llc_tax_classification}</p>
                </div>
              )}
              {/* Line 3b - Foreign Partners */}
              {(w9Form.federal_tax_classification === "partnership" || 
                w9Form.federal_tax_classification === "trust_estate" ||
                (w9Form.federal_tax_classification === "llc" && w9Form.llc_tax_classification?.toUpperCase() === "P")) && (
                <div>
                  <Label className="text-muted-foreground text-xs">Foreign Partners/Owners/Beneficiaries (Line 3b)</Label>
                  <p className="font-medium flex items-center gap-1">
                    {w9Form.has_foreign_partners ? (
                      <><CheckCircle className="h-4 w-4 text-amber-600" /> Yes</>
                    ) : (
                      <><XCircle className="h-4 w-4 text-muted-foreground" /> No</>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Address */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Address
            </h3>
            <div>
              <p className="font-medium">{w9Form.address}</p>
              <p className="font-medium">{w9Form.city}, {w9Form.state} {w9Form.zip}</p>
            </div>
          </div>

          <Separator />

          {/* TIN */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Taxpayer Identification Number (TIN)
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-muted-foreground text-xs">TIN Type</Label>
                <p className="font-medium uppercase">{w9Form.tin_type}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">
                  {w9Form.tin_type === "ssn" ? "SSN" : "EIN"}
                </Label>
                <p className="font-medium">
                  {w9Form.tin_type === "ssn" 
                    ? (personnelSsnLastFour ? `***-**-${personnelSsnLastFour}` : "On file")
                    : (w9Form.ein || "Not provided")
                  }
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Certification */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Certification
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {w9Form.certified_correct_tin ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span>Correct TIN certified</span>
              </div>
              <div className="flex items-center gap-2">
                {w9Form.certified_not_subject_backup_withholding ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span>Not subject to backup withholding</span>
              </div>
              <div className="flex items-center gap-2">
                {w9Form.certified_us_person ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span>U.S. citizen or person</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Signature */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Signature
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-muted-foreground text-xs">Electronic Signature</Label>
                {w9Form.signature_data?.startsWith("data:image") ? (
                  <img 
                    src={w9Form.signature_data} 
                    alt="Electronic Signature"
                    className="max-h-16 object-contain border rounded p-1 bg-white"
                  />
                ) : (
                  <p className="font-medium italic">{w9Form.signature_data || "—"}</p>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Signature Date</Label>
                <p className="font-medium">{format(new Date(w9Form.signature_date), "MMMM d, yyyy")}</p>
              </div>
            </div>
          </div>

          {/* Verification Info */}
          {w9Form.status === "verified" && w9Form.verified_at && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Verification
                </h3>
                <div>
                  <Label className="text-muted-foreground text-xs">Verified On</Label>
                  <p className="font-medium">{format(new Date(w9Form.verified_at), "MMMM d, yyyy 'at' h:mm a")}</p>
                </div>
              </div>
            </>
          )}

          {/* Timestamps */}
          <div className="pt-4 border-t">
            <div className="flex gap-6 text-xs text-muted-foreground">
              <span>Submitted: {format(new Date(w9Form.created_at), "MMM d, yyyy")}</span>
              <span>Last Updated: {format(new Date(w9Form.updated_at), "MMM d, yyyy")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject W-9 Form</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this W-9 form. The personnel member will be notified and asked to resubmit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={!rejectionReason.trim() || verifyW9.isPending}
            >
              Reject W-9
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
