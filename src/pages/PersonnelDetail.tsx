import { useParams } from "react-router-dom";
import { DetailPageLayout } from "@/components/layout/DetailPageLayout";
import { SEO } from "@/components/SEO";
import { usePersonnelById, useResendOnboardingEmail } from "@/integrations/supabase/hooks/usePersonnel";
import { usePersonnelInvitationCheck } from "@/integrations/supabase/hooks/usePortal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Phone, MapPin, Calendar, DollarSign, AlertTriangle, IdCard, MessageSquare, Edit, Flag, FileCheck, Shield, Award, AlertCircle, LucideIcon, Clock, Check, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useState } from "react";
import { BadgeGenerator } from "@/components/badges/BadgeGenerator";
import { PersonnelForm } from "@/components/personnel/PersonnelForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SendSMSDialog } from "@/components/messaging/SendSMSDialog";
import { MessageHistory } from "@/components/messaging/MessageHistory";
import { InviteToPortalDialog } from "@/components/personnel/InviteToPortalDialog";
import { PersonnelProjectsList } from "@/components/personnel/PersonnelProjectsList";
import { W9FormView } from "@/components/personnel/W9FormView";
import { Generate1099Dialog } from "@/components/personnel/Generate1099Dialog";
import { usePersonnelW9Form } from "@/integrations/supabase/hooks/useW9Forms";

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
  const { data: personnel, isLoading } = usePersonnelById(id);
  const { data: existingInvitation } = usePersonnelInvitationCheck(id);
  const resendOnboardingEmail = useResendOnboardingEmail();
  const { data: w9Form } = usePersonnelW9Form(id);
  const [badgeDialogOpen, setBadgeDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [generate1099Open, setGenerate1099Open] = useState(false);
  const [defaultEditTab, setDefaultEditTab] = useState("personal");

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
              <Avatar className="h-24 w-24">
                <AvatarImage src={personnel.photo_url || ""} />
                <AvatarFallback className="text-2xl">
                  {personnel.first_name[0]}
                  {personnel.last_name[0]}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-2xl font-bold">
                    {personnel.first_name} {personnel.last_name}
                  </h2>
                  <p className="text-muted-foreground">{personnel.personnel_number}</p>
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSmsDialogOpen(true)}
                    disabled={!personnel.phone}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Send SMS
                  </Button>
                  {personnel.onboarding_status !== "completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResendOnboardingEmail}
                      disabled={resendOnboardingEmail.isPending}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {resendOnboardingEmail.isPending ? "Sending..." : "Resend Onboarding Email"}
                    </Button>
                  )}
                  <InviteToPortalDialog
                    personnelId={personnel.id}
                    personnelName={`${personnel.first_name} ${personnel.last_name}`}
                    personnelEmail={personnel.email}
                    hasExistingInvitation={!!existingInvitation}
                    existingInvitationDate={existingInvitation?.created_at}
                    isLinked={!!personnel.user_id}
                  />
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

        <Tabs defaultValue="personal" className="w-full">
          <ScrollArea className="w-full">
            <TabsList className="inline-flex w-full sm:grid sm:grid-cols-8">
              <TabsTrigger value="personal" className="whitespace-nowrap">
                <span className="sm:hidden">Info</span>
                <span className="hidden sm:inline">Personal</span>
              </TabsTrigger>
              <TabsTrigger value="projects" className="whitespace-nowrap">Projects</TabsTrigger>
              <TabsTrigger value="i9" className="whitespace-nowrap">
                <span className="sm:hidden">I-9</span>
                <span className="hidden sm:inline">I-9 Compliance</span>
              </TabsTrigger>
              <TabsTrigger value="everify" className="whitespace-nowrap">E-Verify</TabsTrigger>
              <TabsTrigger value="certs" className="whitespace-nowrap">
                <span className="sm:hidden">Certs</span>
                <span className="hidden sm:inline">Certifications</span>
              </TabsTrigger>
              <TabsTrigger value="emergency" className="whitespace-nowrap">
                <span className="sm:hidden">Contact</span>
                <span className="hidden sm:inline">Emergency</span>
              </TabsTrigger>
              <TabsTrigger value="messages" className="whitespace-nowrap">
                <span className="sm:hidden">SMS</span>
                <span className="hidden sm:inline">Messages</span>
              </TabsTrigger>
              <TabsTrigger value="tax" className="whitespace-nowrap">
                <span className="sm:hidden">Tax</span>
                <span className="hidden sm:inline">Tax Info</span>
              </TabsTrigger>
            </TabsList>
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
                <CardTitle>Message History</CardTitle>
                <Button 
                  size="sm" 
                  onClick={() => setSmsDialogOpen(true)}
                  disabled={!personnel.phone}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Send SMS
                </Button>
              </CardHeader>
              <CardContent>
                <MessageHistory 
                  recipientType="personnel" 
                  recipientId={personnel.id} 
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tax" className="space-y-4">
            <W9FormView 
              personnelId={personnel.id} 
              personnelSsnLastFour={personnel.ssn_last_four}
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

      <SendSMSDialog
        open={smsDialogOpen}
        onOpenChange={setSmsDialogOpen}
        recipientType="personnel"
        recipientId={personnel.id}
        recipientName={`${personnel.first_name} ${personnel.last_name}`}
        recipientPhone={personnel.phone || ""}
      />

      <Generate1099Dialog
        open={generate1099Open}
        onOpenChange={setGenerate1099Open}
        personnelId={personnel.id}
        personnelName={`${personnel.first_name} ${personnel.last_name}`}
        w9Form={w9Form}
        personnelData={personnel}
      />
    </DetailPageLayout>
  );
};

export default PersonnelDetail;
