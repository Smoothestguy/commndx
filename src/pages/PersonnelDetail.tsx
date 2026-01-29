import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { DetailPageLayout } from "@/components/layout/DetailPageLayout";
import { SEO } from "@/components/SEO";
import { usePersonnelById, useResendOnboardingEmail, useUpdatePersonnelRating, useUpdatePersonnel } from "@/integrations/supabase/hooks/usePersonnel";
import { usePersonnelInvitationCheck, usePersonnelReimbursements, useUpdateReimbursementStatus } from "@/integrations/supabase/hooks/usePortal";
import { useRevokeOnboardingToken } from "@/integrations/supabase/hooks/usePersonnelOnboarding";
import { useApplicationByPersonnelId, useReverseApprovalWithReason } from "@/integrations/supabase/hooks/useStaffingApplications";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SecureAvatar } from "@/components/ui/secure-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Mail, Phone, MapPin, Calendar, DollarSign, AlertTriangle, IdCard, MessageSquare, Edit, Flag, FileCheck, Shield, Award, AlertCircle, LucideIcon, Clock, Check, Send, Link2, Building2, FileText, Landmark, Star, Receipt, Eye, CheckCircle, XCircle, Banknote, ExternalLink, Download, Ban, Undo2, UserX, UserCheck, Loader2, Briefcase } from "lucide-react";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { DirectDepositView } from "@/components/personnel/DirectDepositView";
import { AgreementSignatureView } from "@/components/personnel/AgreementSignatureView";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useState } from "react";
import { BadgeGenerator } from "@/components/badges/BadgeGenerator";
import { PersonnelForm } from "@/components/personnel/PersonnelForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGetOrCreateConversation } from "@/integrations/supabase/hooks/useConversations";
import { InviteToPortalDialog } from "@/components/personnel/InviteToPortalDialog";
import { PersonnelProjectsList } from "@/components/personnel/PersonnelProjectsList";
import { PersonnelCommunicationLog } from "@/components/personnel/PersonnelCommunicationLog";
import { W9FormView } from "@/components/personnel/W9FormView";
import { Generate1099Dialog } from "@/components/personnel/Generate1099Dialog";
import { usePersonnelW9Form } from "@/integrations/supabase/hooks/useW9Forms";
import { PersonnelVendorMergeDialog } from "@/components/merge/PersonnelVendorMergeDialog";
import { PersonnelDocumentsList } from "@/components/personnel/PersonnelDocumentsList";
import { StarRating } from "@/components/ui/star-rating";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConvertRecordTypeDialog } from "@/components/personnel/ConvertRecordTypeDialog";
import { RevokeOnboardingDialog } from "@/components/personnel/RevokeOnboardingDialog";
import { ReverseApprovalDialog } from "@/components/personnel/ReverseApprovalDialog";
import { PersonnelRolesDialog } from "@/components/personnel/PersonnelRolesDialog";
import { toast } from "sonner";
import { downloadReceipt, getReceiptFilename } from "@/utils/receiptDownload";

interface ComplianceIssue {
  type: string;
  message: string;
  severity: 'warning' | 'critical';
  icon: LucideIcon;
  action: string;
  actionLabel: string;
  details?: string;
}

const PersonnelDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const defaultTab = searchParams.get("tab") || "overview";
  const { data: personnel, isLoading } = usePersonnelById(id);
  const { data: existingInvitation } = usePersonnelInvitationCheck(id);
  const resendOnboardingEmail = useResendOnboardingEmail();
  const revokeOnboardingToken = useRevokeOnboardingToken();
  const updateRating = useUpdatePersonnelRating();
  const updatePersonnel = useUpdatePersonnel();
  const { data: w9Form } = usePersonnelW9Form(id);
  const { data: personnelReimbursements } = usePersonnelReimbursements(id);
  const updateReimbursementStatus = useUpdateReimbursementStatus();
  const [badgeDialogOpen, setBadgeDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const getOrCreateConversation = useGetOrCreateConversation();
  const [generate1099Open, setGenerate1099Open] = useState(false);
  const [defaultEditTab, setDefaultEditTab] = useState("personal");
  const [vendorMergeOpen, setVendorMergeOpen] = useState(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [revokeOnboardingOpen, setRevokeOnboardingOpen] = useState(false);
  const [reverseApprovalOpen, setReverseApprovalOpen] = useState(false);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const { data: linkedApplication } = useApplicationByPersonnelId(id);
  const reverseApproval = useReverseApprovalWithReason();
  const [reimbursementAction, setReimbursementAction] = useState<{
    id: string;
    type: "approve" | "reject" | "paid";
  } | null>(null);
  const [actionNotes, setActionNotes] = useState("");

  const handleReimbursementAction = () => {
    if (!reimbursementAction) return;
    
    const statusMap = {
      approve: "approved",
      reject: "rejected",
      paid: "paid",
    } as const;
    
    updateReimbursementStatus.mutate({
      id: reimbursementAction.id,
      status: statusMap[reimbursementAction.type],
      notes: actionNotes || undefined,
    }, {
      onSuccess: () => {
        setReimbursementAction(null);
        setActionNotes("");
      }
    });
  };

  const isImageReceipt = (url: string) => {
    const lower = url.toLowerCase();
    return lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.png') || lower.includes('.gif') || lower.includes('.webp');
  };

  const handleResendOnboardingEmail = () => {
    if (!personnel) return;
    resendOnboardingEmail.mutate({
      personnelId: personnel.id,
      email: personnel.email,
      firstName: personnel.first_name,
      lastName: personnel.last_name,
    });
  };

  if (isLoading) {
    return (
      <DetailPageLayout title="Loading..." backPath="/personnel">
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </DetailPageLayout>
    );
  }

  if (!personnel) {
    return (
      <DetailPageLayout title="Not Found" backPath="/personnel">
        <p>Personnel not found</p>
      </DetailPageLayout>
    );
  }

  const getStatusBadge = () => {
    switch (personnel.status) {
      case "active":
        return <Badge variant="default">Active</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      case "do_not_hire":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Do Not Hire
          </Badge>
        );
    }
  };

  const getEVerifyBadge = () => {
    switch (personnel.everify_status) {
      case "verified":
        return <Badge className="bg-green-600">E-Verified</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "expired":
        return <Badge variant="outline">Expired</Badge>;
      case "not_required":
        return <Badge variant="outline">Not Required</Badge>;
    }
  };

  const getComplianceIssues = (): ComplianceIssue[] => {
    const issues: ComplianceIssue[] = [];
    const today = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // E-Verify status issues
    if (personnel.everify_status === 'rejected') {
      issues.push({ 
        type: 'everify', 
        message: 'E-Verify rejected', 
        severity: 'critical',
        icon: Shield,
        action: 'i9',
        actionLabel: 'Update E-Verify',
        details: 'Employment authorization could not be verified'
      });
    } else if (personnel.everify_status === 'expired') {
      issues.push({ 
        type: 'everify', 
        message: 'E-Verify expired', 
        severity: 'critical',
        icon: Shield,
        action: 'i9',
        actionLabel: 'Update E-Verify',
        details: 'E-Verify status needs to be renewed'
      });
    }

    // E-Verify expiry
    if (personnel.everify_expiry) {
      const expiryDate = new Date(personnel.everify_expiry);
      if (expiryDate < today) {
        issues.push({ 
          type: 'everify_expiry', 
          message: 'E-Verify has expired', 
          severity: 'critical',
          icon: Shield,
          action: 'i9',
          actionLabel: 'Update E-Verify',
          details: `Expired on ${format(expiryDate, "MMM dd, yyyy")}`
        });
      } else if (expiryDate < thirtyDaysFromNow) {
        const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        issues.push({ 
          type: 'everify_expiry', 
          message: 'E-Verify expiring soon', 
          severity: 'warning',
          icon: Shield,
          action: 'i9',
          actionLabel: 'Update E-Verify',
          details: `Expires in ${daysLeft} days (${format(expiryDate, "MMM dd, yyyy")})`
        });
      }
    }

    // Work authorization expiry
    if (personnel.work_auth_expiry) {
      const expiryDate = new Date(personnel.work_auth_expiry);
      if (expiryDate < today) {
        issues.push({ 
          type: 'work_auth', 
          message: 'Work authorization expired', 
          severity: 'critical',
          icon: FileCheck,
          action: 'i9',
          actionLabel: 'Update Authorization',
          details: `Expired on ${format(expiryDate, "MMM dd, yyyy")}`
        });
      } else if (expiryDate < thirtyDaysFromNow) {
        const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        issues.push({ 
          type: 'work_auth', 
          message: 'Work authorization expiring soon', 
          severity: 'warning',
          icon: FileCheck,
          action: 'i9',
          actionLabel: 'Update Authorization',
          details: `Expires in ${daysLeft} days, renewal required`
        });
      }
    }

    // I-9 not completed
    if (!personnel.i9_completed_at) {
      issues.push({ 
        type: 'i9', 
        message: 'I-9 not completed', 
        severity: 'warning',
        icon: FileCheck,
        action: 'i9',
        actionLabel: 'Complete I-9',
        details: 'Form I-9 employment verification is required'
      });
    }

    // Expired certifications
    if (personnel.certifications?.length > 0) {
      const expiredCerts = personnel.certifications.filter(
        cert => cert.expiry_date && new Date(cert.expiry_date) < today
      );
      const expiringCerts = personnel.certifications.filter(
        cert => cert.expiry_date && new Date(cert.expiry_date) >= today && new Date(cert.expiry_date) < thirtyDaysFromNow
      );
      
      if (expiredCerts.length > 0) {
        const certNames = expiredCerts.map(c => c.certification_name).join(', ');
        issues.push({ 
          type: 'cert', 
          message: `${expiredCerts.length} expired certification(s)`, 
          severity: 'critical',
          icon: Award,
          action: 'personal',
          actionLabel: 'Update Certifications',
          details: certNames
        });
      }
      if (expiringCerts.length > 0) {
        const certNames = expiringCerts.map(c => c.certification_name).join(', ');
        issues.push({ 
          type: 'cert_warning', 
          message: `${expiringCerts.length} certification(s) expiring soon`, 
          severity: 'warning',
          icon: Award,
          action: 'personal',
          actionLabel: 'Update Certifications',
          details: certNames
        });
      }
    }

    return issues;
  };

  const openEditWithTab = (tab: string) => {
    setDefaultEditTab(tab);
    setEditDialogOpen(true);
  };

  const complianceIssues = getComplianceIssues();

  return (
    <DetailPageLayout
      title={`${personnel.first_name} ${personnel.last_name}`}
      backPath="/personnel"
    >
      <SEO
        title={`${personnel.first_name} ${personnel.last_name} - Personnel`}
        description={`Personnel details for ${personnel.first_name} ${personnel.last_name}`}
      />

      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <SecureAvatar
                bucket="personnel-photos"
                photoUrl={personnel.photo_url}
                className="h-24 w-24"
                fallback={
                  <span className="text-2xl">
                    {personnel.first_name[0]}
                    {personnel.last_name[0]}
                  </span>
                }
                alt={`${personnel.first_name} ${personnel.last_name}`}
              />

              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-2xl font-bold">
                    {personnel.first_name} {personnel.last_name}
                  </h2>
                  <p className="text-muted-foreground">{personnel.personnel_number}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StarRating
                      value={personnel.rating || 0}
                      onChange={(rating) => updateRating.mutate({ id: personnel.id, rating })}
                      size="md"
                    />
                    <span className="text-sm text-muted-foreground">
                      {personnel.rating ? `${personnel.rating}/5` : "Not rated"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {getStatusBadge()}
                  {getEVerifyBadge()}
                  {personnel.onboarding_status === "pending" && (
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      Onboarding Pending
                    </Badge>
                  )}
                  {personnel.onboarding_status === "completed" && (
                    <Badge className="bg-green-600 gap-1">
                      <Check className="h-3 w-3" />
                      Onboarding Complete
                    </Badge>
                  )}
                  {complianceIssues.length > 0 && (
                    <Badge variant="destructive" className="gap-1 animate-pulse">
                      <Flag className="h-3 w-3" />
                      Out of Compliance
                    </Badge>
                  )}
                  {personnel.vendor_id && (
                    <Link to={`/vendors/${personnel.vendor_id}`}>
                      <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-accent">
                        <Building2 className="h-3 w-3" />
                        Linked to Vendor
                      </Badge>
                    </Link>
                  )}
                  {(personnel as any).portal_required === false && (
                    <Badge variant="secondary" className="gap-1">
                      <UserX className="h-3 w-3" />
                      Temporary Worker
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button size="sm" onClick={() => setBadgeDialogOpen(true)}>
                    <IdCard className="mr-2 h-4 w-4" />
                    Generate Badge
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setRolesDialogOpen(true)}>
                    <Briefcase className="mr-2 h-4 w-4" />
                    Manage Roles
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={async () => {
                      if (!personnel) return;
                      const conversation = await getOrCreateConversation.mutateAsync({
                        participantType: "personnel",
                        participantId: personnel.id,
                      });
                      navigate(`/messages?conversation=${conversation.id}`);
                    }}
                    disabled={!personnel.phone || getOrCreateConversation.isPending}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {getOrCreateConversation.isPending ? "Opening..." : "Send Message"}
                  </Button>
                  {personnel.onboarding_status !== "completed" && personnel.onboarding_status !== "revoked" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResendOnboardingEmail}
                        disabled={resendOnboardingEmail.isPending}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        {resendOnboardingEmail.isPending ? "Sending..." : "Resend Onboarding Email"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRevokeOnboardingOpen(true)}
                        disabled={revokeOnboardingToken.isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Revoke Onboarding
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      updatePersonnel.mutate({
                        id: personnel.id,
                        updates: { portal_required: (personnel as any).portal_required === false ? true : false },
                      });
                    }}
                    disabled={updatePersonnel.isPending}
                    className="gap-1"
                  >
                    {updatePersonnel.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (personnel as any).portal_required === false ? (
                      <UserCheck className="h-3 w-3" />
                    ) : (
                      <UserX className="h-3 w-3" />
                    )}
                    {(personnel as any).portal_required === false ? "Require Portal" : "Mark as Temporary"}
                  </Button>
                  {(personnel as any).portal_required !== false && (
                    <InviteToPortalDialog
                      personnelId={personnel.id}
                      personnelName={`${personnel.first_name} ${personnel.last_name}`}
                      personnelEmail={personnel.email}
                      hasExistingInvitation={!!existingInvitation}
                      existingInvitationDate={existingInvitation?.created_at}
                      isLinked={!!personnel.user_id}
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVendorMergeOpen(true)}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    {personnel.vendor_id ? "Change Vendor" : "Link to Vendor"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConvertDialogOpen(true)}
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    Create Additional Record
                  </Button>
                  {linkedApplication?.status === 'approved' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReverseApprovalOpen(true)}
                      className="text-amber-600 hover:text-amber-700"
                    >
                      <Undo2 className="mr-2 h-4 w-4" />
                      Reverse Approval
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {complianceIssues.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Flag className="h-5 w-5" />
                Out of Compliance
                <Badge variant="destructive">{complianceIssues.length} issue(s)</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {complianceIssues.map((issue, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "flex items-center justify-between gap-4 p-3 rounded-lg border",
                    issue.severity === 'critical' 
                      ? "border-destructive/30 bg-destructive/10" 
                      : "border-amber-500/30 bg-amber-500/10"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <issue.icon className={cn(
                      "h-5 w-5 shrink-0",
                      issue.severity === 'critical' ? "text-destructive" : "text-amber-600 dark:text-amber-500"
                    )} />
                    <div className="min-w-0">
                      <p className={cn(
                        "font-medium",
                        issue.severity === 'critical' ? "text-destructive" : "text-amber-700 dark:text-amber-400"
                      )}>
                        {issue.message}
                      </p>
                      {issue.details && (
                        <p className="text-sm text-muted-foreground truncate">{issue.details}</p>
                      )}
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => openEditWithTab(issue.action)}
                    className="shrink-0"
                  >
                    {issue.actionLabel}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue={defaultTab} className="w-full">
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="inline-flex w-max min-w-full h-auto gap-1 p-1">
              <TabsTrigger value="personal" className="px-3 py-1.5">Personal</TabsTrigger>
              <TabsTrigger value="projects" className="px-3 py-1.5">Projects</TabsTrigger>
              <TabsTrigger value="documents" className="px-3 py-1.5">Documents</TabsTrigger>
              <TabsTrigger value="i9" className="px-3 py-1.5">I-9</TabsTrigger>
              <TabsTrigger value="everify" className="px-3 py-1.5">E-Verify</TabsTrigger>
              <TabsTrigger value="certs" className="px-3 py-1.5">Certifications</TabsTrigger>
              <TabsTrigger value="emergency" className="px-3 py-1.5">Emergency</TabsTrigger>
              <TabsTrigger value="messages" className="px-3 py-1.5">Messages</TabsTrigger>
              <TabsTrigger value="banking" className="px-3 py-1.5">Banking</TabsTrigger>
              <TabsTrigger value="tax" className="px-3 py-1.5">Tax Info</TabsTrigger>
              <TabsTrigger value="reimbursements" className="px-3 py-1.5">Reimbursements</TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" className="invisible" />
          </ScrollArea>

          <TabsContent value="personal" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {personnel.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{personnel.email}</span>
                  </div>
                )}
                {personnel.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{personnel.phone}</span>
                  </div>
                )}
                {personnel.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {personnel.address}
                      {personnel.city && `, ${personnel.city}`}
                      {personnel.state && `, ${personnel.state}`}
                      {personnel.zip && ` ${personnel.zip}`}
                    </span>
                  </div>
                )}
                {personnel.date_of_birth && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>DOB: {format(new Date(personnel.date_of_birth), "MMM dd, yyyy")}</span>
                  </div>
                )}
                {personnel.hourly_rate && personnel.hourly_rate > 0 && (
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>Hourly Rate: ${personnel.hourly_rate}/hr</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {personnel.languages && personnel.languages.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Languages</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {personnel.languages.map((lang) => (
                      <Badge key={lang.id} variant="secondary">
                        {lang.language} {lang.proficiency && `(${lang.proficiency})`}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {personnel.capabilities && personnel.capabilities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Capabilities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {personnel.capabilities.map((cap) => (
                      <Badge key={cap.id} variant="outline">
                        {cap.capability}
                        {cap.years_experience && ` (${cap.years_experience}y)`}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="projects">
            <PersonnelProjectsList personnelId={personnel.id} />
          </TabsContent>

          <TabsContent value="documents">
            <PersonnelDocumentsList personnelId={personnel.id} canDelete={true} />
          </TabsContent>

          <TabsContent value="i9">
            <Card>
              <CardHeader>
                <CardTitle>I-9 Compliance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {personnel.ssn_last_four && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">SSN (Last 4)</label>
                    <p>***-**-{personnel.ssn_last_four}</p>
                  </div>
                )}
                {personnel.work_authorization_type && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Work Authorization</label>
                    <p className="capitalize">{personnel.work_authorization_type.replace("_", " ")}</p>
                  </div>
                )}
                {personnel.work_auth_expiry && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Authorization Expiry</label>
                    <p>{format(new Date(personnel.work_auth_expiry), "MMM dd, yyyy")}</p>
                  </div>
                )}
                {personnel.i9_completed_at && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">I-9 Completed</label>
                    <p>{format(new Date(personnel.i9_completed_at), "MMM dd, yyyy")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="everify">
            <Card>
              <CardHeader>
                <CardTitle>E-Verify Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">{getEVerifyBadge()}</div>
                </div>
                {personnel.everify_case_number && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Case Number</label>
                    <p>{personnel.everify_case_number}</p>
                  </div>
                )}
                {personnel.everify_verified_at && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Verified Date</label>
                    <p>{format(new Date(personnel.everify_verified_at), "MMM dd, yyyy")}</p>
                  </div>
                )}
                {personnel.everify_expiry && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Expiry Date</label>
                    <p>{format(new Date(personnel.everify_expiry), "MMM dd, yyyy")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="certs">
            <Card>
              <CardHeader>
                <CardTitle>Certifications</CardTitle>
              </CardHeader>
              <CardContent>
                {personnel.certifications && personnel.certifications.length > 0 ? (
                  <div className="space-y-4">
                    {personnel.certifications.map((cert) => (
                      <div key={cert.id} className="border-b pb-4 last:border-0">
                        <h4 className="font-semibold">{cert.certification_name}</h4>
                        {cert.issuing_organization && (
                          <p className="text-sm text-muted-foreground">{cert.issuing_organization}</p>
                        )}
                        <div className="flex gap-4 mt-2 text-sm">
                          {cert.issue_date && (
                            <span>Issued: {format(new Date(cert.issue_date), "MMM yyyy")}</span>
                          )}
                          {cert.expiry_date && (
                            <span>Expires: {format(new Date(cert.expiry_date), "MMM yyyy")}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No certifications on file</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emergency">
            <Card>
              <CardHeader>
                <CardTitle>Emergency Contacts</CardTitle>
              </CardHeader>
              <CardContent>
                {personnel.emergency_contacts && personnel.emergency_contacts.length > 0 ? (
                  <div className="space-y-4">
                    {personnel.emergency_contacts.map((contact) => (
                      <div key={contact.id} className="border-b pb-4 last:border-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{contact.contact_name}</h4>
                            {contact.relationship && (
                              <p className="text-sm text-muted-foreground">{contact.relationship}</p>
                            )}
                          </div>
                          {contact.is_primary && <Badge>Primary</Badge>}
                        </div>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {contact.phone}
                          </div>
                          {contact.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              {contact.email}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No emergency contacts on file</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Messages</CardTitle>
                <Button 
                  size="sm" 
                  onClick={async () => {
                    if (!personnel) return;
                    const conversation = await getOrCreateConversation.mutateAsync({
                      participantType: "personnel",
                      participantId: personnel.id,
                    });
                    navigate(`/messages?conversation=${conversation.id}`);
                  }}
                  disabled={!personnel.phone || getOrCreateConversation.isPending}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {getOrCreateConversation.isPending ? "Opening..." : "Open Conversation"}
                </Button>
              </CardHeader>
              <CardContent>
                <PersonnelCommunicationLog personnelId={personnel.id} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="banking" className="space-y-4">
            <DirectDepositView
              name={`${personnel.first_name} ${personnel.last_name}`}
              address={personnel.address}
              city={personnel.city}
              state={personnel.state}
              zip={personnel.zip}
              phone={personnel.phone}
              email={personnel.email}
              bankName={personnel.bank_name}
              accountType={personnel.bank_account_type}
              routingNumber={personnel.bank_routing_number}
              accountNumber={personnel.bank_account_number}
              signature={personnel.direct_deposit_signature}
              signedAt={personnel.direct_deposit_signed_at}
            />
            <AgreementSignatureView
              icaSignature={personnel.ica_signature}
              icaSignedAt={personnel.ica_signed_at}
              w9Signature={personnel.w9_signature}
              w9SignedAt={personnel.w9_signed_at}
              personnelName={`${personnel.first_name} ${personnel.last_name}`}
              personnelAddress={[
                personnel.address,
                [personnel.city, personnel.state, personnel.zip].filter(Boolean).join(", ")
              ].filter(Boolean).join(", ")}
              w9Form={w9Form}
              ssnLastFour={personnel.ssn_last_four}
              ssnFull={personnel.ssn_full}
            />
            <W9FormView 
              personnelId={personnel.id} 
              personnelSsnLastFour={personnel.ssn_last_four}
              personnelSsnFull={personnel.ssn_full}
            />
          </TabsContent>

          <TabsContent value="tax" className="space-y-4">
            <W9FormView 
              personnelId={personnel.id} 
              personnelSsnLastFour={personnel.ssn_last_four}
              personnelSsnFull={personnel.ssn_full}
            />
            
            {w9Form && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>1099 Generation</span>
                    <Button onClick={() => setGenerate1099Open(true)}>
                      <DollarSign className="mr-2 h-4 w-4" />
                      Generate 1099
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Generate a 1099-NEC form for this personnel based on their W-9 information and payment history.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="reimbursements" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Reimbursement Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {!personnelReimbursements || personnelReimbursements.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No reimbursement requests submitted</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                          ${personnelReimbursements.filter(r => r.status === "pending").reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">Pending</div>
                      </div>
                      <div className="text-center p-3 bg-green-500/10 rounded-lg">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          ${personnelReimbursements.filter(r => r.status === "approved").reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">Approved</div>
                      </div>
                      <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          ${personnelReimbursements.filter(r => r.status === "paid").reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">Paid</div>
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Receipt</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {personnelReimbursements.map((reimbursement) => (
                          <TableRow key={reimbursement.id}>
                            <TableCell className="max-w-[200px] truncate">{reimbursement.description}</TableCell>
                            <TableCell>{reimbursement.category}</TableCell>
                            <TableCell>{reimbursement.project?.name || "—"}</TableCell>
                            <TableCell className="font-medium">${reimbursement.amount.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge className={cn(
                                reimbursement.status === "pending" && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
                                reimbursement.status === "approved" && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                                reimbursement.status === "rejected" && "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
                                reimbursement.status === "paid" && "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                              )}>
                                {reimbursement.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{format(new Date(reimbursement.submitted_at), "MMM d, yyyy")}</TableCell>
                            <TableCell>
                              {reimbursement.receipt_url ? (
                                <div className="flex items-center gap-2">
                                  {isImageReceipt(reimbursement.receipt_url) ? (
                                    <button
                                      onClick={() => setReceiptPreviewUrl(reimbursement.receipt_url)}
                                      className="text-primary hover:underline flex items-center gap-1"
                                    >
                                      <Eye className="h-4 w-4" />
                                      View
                                    </button>
                                  ) : (
                                    <a
                                      href={reimbursement.receipt_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline flex items-center gap-1"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                      Open
                                    </a>
                                  )}
                                  <button
                                    onClick={async () => {
                                      const filename = getReceiptFilename(
                                        reimbursement.description,
                                        reimbursement.submitted_at,
                                        reimbursement.receipt_url!
                                      );
                                      const result = await downloadReceipt(reimbursement.receipt_url!, filename);
                                      if (!result.success) {
                                        toast.error(result.error || "Receipt file unavailable");
                                      }
                                    }}
                                    className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                                    title="Download receipt"
                                  >
                                    <Download className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">None</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {reimbursement.status === "pending" && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                                      onClick={() => setReimbursementAction({ id: reimbursement.id, type: "approve" })}
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100"
                                      onClick={() => setReimbursementAction({ id: reimbursement.id, type: "reject" })}
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                {reimbursement.status === "approved" && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                                    onClick={() => setReimbursementAction({ id: reimbursement.id, type: "paid" })}
                                  >
                                    <Banknote className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <BadgeGenerator
        open={badgeDialogOpen}
        onOpenChange={setBadgeDialogOpen}
        personnelId={id}
      />

      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) setDefaultEditTab("personal");
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Personnel</DialogTitle>
          </DialogHeader>
          <PersonnelForm
            personnel={personnel}
            onSuccess={() => setEditDialogOpen(false)}
            onCancel={() => setEditDialogOpen(false)}
            defaultTab={defaultEditTab}
          />
        </DialogContent>
      </Dialog>


      <Generate1099Dialog
        open={generate1099Open}
        onOpenChange={setGenerate1099Open}
        personnelId={personnel.id}
        personnelName={`${personnel.first_name} ${personnel.last_name}`}
        w9Form={w9Form}
        personnelData={personnel}
      />

      <PersonnelVendorMergeDialog
        open={vendorMergeOpen}
        onOpenChange={setVendorMergeOpen}
        personnelId={personnel.id}
        personnelName={`${personnel.first_name} ${personnel.last_name}`}
        personnelEmail={personnel.email}
        personnelPhone={personnel.phone}
        currentVendorId={personnel.vendor_id}
      />

      <ConvertRecordTypeDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        personnel={{
          id: personnel.id,
          first_name: personnel.first_name,
          last_name: personnel.last_name,
          email: personnel.email,
          phone: personnel.phone,
          address: personnel.address,
          city: personnel.city,
          state: personnel.state,
          zip: personnel.zip,
          linked_vendor_id: personnel.linked_vendor_id,
        }}
      />

      {/* Receipt Preview Lightbox */}
      <ImageLightbox
        imageUrl={receiptPreviewUrl}
        onClose={() => setReceiptPreviewUrl(null)}
        alt="Receipt"
      />

      {/* Reimbursement Action Dialog */}
      <Dialog open={!!reimbursementAction} onOpenChange={(open) => !open && setReimbursementAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reimbursementAction?.type === "approve" && "Approve Reimbursement"}
              {reimbursementAction?.type === "reject" && "Reject Reimbursement"}
              {reimbursementAction?.type === "paid" && "Mark as Paid"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {reimbursementAction?.type === "approve" && "Are you sure you want to approve this reimbursement request?"}
              {reimbursementAction?.type === "reject" && "Are you sure you want to reject this reimbursement request?"}
              {reimbursementAction?.type === "paid" && "Mark this reimbursement as paid?"}
            </p>
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <textarea
                className="w-full mt-1 p-2 border rounded-md text-sm min-h-[80px] bg-background"
                placeholder="Add any notes..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReimbursementAction(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleReimbursementAction}
                disabled={updateReimbursementStatus.isPending}
                className={cn(
                  reimbursementAction?.type === "approve" && "bg-green-600 hover:bg-green-700",
                  reimbursementAction?.type === "reject" && "bg-red-600 hover:bg-red-700",
                  reimbursementAction?.type === "paid" && "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {updateReimbursementStatus.isPending ? "Processing..." : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revoke Onboarding Dialog */}
      <RevokeOnboardingDialog
        open={revokeOnboardingOpen}
        onOpenChange={setRevokeOnboardingOpen}
        onConfirm={async (reason) => {
          await revokeOnboardingToken.mutateAsync({
            personnelId: personnel.id,
            reason,
          });
          setRevokeOnboardingOpen(false);
        }}
        personnelName={`${personnel.first_name} ${personnel.last_name}`}
        isLoading={revokeOnboardingToken.isPending}
      />

      {/* Reverse Approval Dialog */}
      {linkedApplication && (
        <ReverseApprovalDialog
          open={reverseApprovalOpen}
          onOpenChange={setReverseApprovalOpen}
          onConfirm={async (reason) => {
            try {
              await reverseApproval.mutateAsync({
                applicationId: linkedApplication.id,
                reason,
              });
              setReverseApprovalOpen(false);
              toast.success("Approval reversed successfully");
            } catch (error) {
              toast.error("Failed to reverse approval");
            }
          }}
          registrantName={`${personnel.first_name} ${personnel.last_name}`}
          hasPersonnelRecord={true}
          hasVendorRecord={!!personnel.linked_vendor_id || !!personnel.vendor_id}
          isLoading={reverseApproval.isPending}
        />
      )}

      <PersonnelRolesDialog
        open={rolesDialogOpen}
        onOpenChange={setRolesDialogOpen}
        personnelId={personnel.id}
        personnelName={`${personnel.first_name} ${personnel.last_name}`}
      />
    </DetailPageLayout>
  );
};

export default PersonnelDetail;
