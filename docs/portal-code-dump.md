# Portal Code Dump

Generated read-only export of all portal-related code.

## Personnel Portal — Pages

### `src/pages/portal/AcceptPortalInvitation.tsx`

```tsx
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useInvitationByToken } from "@/integrations/supabase/hooks/usePortal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, XCircle, User } from "lucide-react";

export default function AcceptPortalInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { data: invitation, isLoading: invitationLoading, error } = useInvitationByToken(token);
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if invitation is expired
  const isExpired = invitation && new Date(invitation.expires_at) < new Date();

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    
    if (!invitation || !token) return;
    
    setLoading(true);

    try {
      // Call the edge function to handle account creation
      const { data, error } = await supabase.functions.invoke("accept-portal-invitation", {
        body: { token, password },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Account created successfully! You can now sign in.");
      navigate("/portal/login");
    } catch (error: any) {
      console.error("Account creation error:", error);
      toast.error(error.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  if (invitationLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Invitation</h2>
            <p className="text-muted-foreground text-center mb-4">
              This invitation link is invalid or has already been used.
            </p>
            <Button variant="outline" onClick={() => navigate("/portal/login")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invitation Expired</h2>
            <p className="text-muted-foreground text-center mb-4">
              This invitation has expired. Please contact your administrator for a new invitation.
            </p>
            <Button variant="outline" onClick={() => navigate("/portal/login")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
            <User className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome!</CardTitle>
          <CardDescription>
            You've been invited to join the Personnel Portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg mb-6">
            <p className="text-sm text-muted-foreground">Invitation for:</p>
            <p className="font-medium">
              {invitation.personnel?.first_name} {invitation.personnel?.last_name}
            </p>
            <p className="text-sm text-muted-foreground">{invitation.email}</p>
          </div>
          
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Create Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Account
            </Button>
          </form>
          
          <p className="text-sm text-center text-muted-foreground mt-6">
            Already have an account?{" "}
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/portal/login")}>
              Sign in
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

```

### `src/pages/portal/PortalAssets.tsx`

```tsx
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel } from "@/integrations/supabase/hooks/usePortal";
import { usePersonnelAssignedAssets } from "@/integrations/supabase/hooks/usePortalAssets";
import { PortalAssetCard } from "@/components/portal/PortalAssetCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Package } from "lucide-react";

export default function PortalAssets() {
  const { data: personnel, isLoading: personnelLoading } = useCurrentPersonnel();
  const { data: assets, isLoading: assetsLoading } = usePersonnelAssignedAssets(personnel?.id);

  const isLoading = personnelLoading || assetsLoading;

  // Group assets by project
  const assetsByProject = (assets || []).reduce((acc, asset) => {
    const projectName = asset.project?.name || "Unassigned";
    const projectId = asset.project?.id || "unassigned";
    if (!acc[projectId]) {
      acc[projectId] = { name: projectName, assets: [] };
    }
    acc[projectId].assets.push(asset);
    return acc;
  }, {} as Record<string, { name: string; assets: typeof assets }>);

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Assets</h1>
          <p className="text-muted-foreground">
            Equipment, vehicles, and resources assigned to you
          </p>
        </div>

        {!assets || assets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Assets Assigned</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                You don't have any equipment, vehicles, or resources currently assigned to you.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(assetsByProject).map(([projectId, { name, assets: projectAssets }]) => (
              <Card key={projectId}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{name}</CardTitle>
                  <CardDescription>
                    {projectAssets?.length} asset{projectAssets?.length !== 1 ? "s" : ""} assigned
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {projectAssets?.map((assignment) => (
                    <PortalAssetCard 
                      key={assignment.id} 
                      assignment={assignment}
                      showProject={false}
                    />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

```

### `src/pages/portal/PortalDashboard.tsx`

```tsx
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel, usePersonnelTimeEntries, usePersonnelAssignments, usePersonnelReimbursements, usePersonnelNotifications } from "@/integrations/supabase/hooks/usePortal";
import { usePersonnelAssignedAssets } from "@/integrations/supabase/hooks/usePortalAssets";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { useClockEnabledProjects, useAllOpenClockEntries } from "@/integrations/supabase/hooks/useTimeClock";
import { ClockStatusCard } from "@/components/portal/ClockStatusCard";
import { PortalAssetCard } from "@/components/portal/PortalAssetCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Briefcase, Receipt, Bell, TrendingUp, Calendar, Package } from "lucide-react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isWithinInterval, format } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { getLastCompletedPayPeriod, calculatePayPeriodTotals } from "@/lib/payPeriodUtils";
import { PersonnelAvatar } from "@/components/personnel/PersonnelAvatar";

export default function PortalDashboard() {
  const navigate = useNavigate();
  const { data: personnel, isLoading: personnelLoading } = useCurrentPersonnel();
  const { data: timeEntries, isLoading: timeLoading } = usePersonnelTimeEntries(personnel?.id);
  const { data: assignments, isLoading: assignmentsLoading } = usePersonnelAssignments(personnel?.id);
  const { data: reimbursements, isLoading: reimbursementsLoading } = usePersonnelReimbursements(personnel?.id);
  const { data: notifications } = usePersonnelNotifications(personnel?.id);
  const { data: companySettings } = useCompanySettings();
  const { data: assignedAssets, isLoading: assetsLoading } = usePersonnelAssignedAssets(personnel?.id);
  
  // Time clock data
  const { data: clockProjects, isLoading: clockProjectsLoading } = useClockEnabledProjects(personnel?.id);
  const { data: openClockEntries, isLoading: clockEntriesLoading } = useAllOpenClockEntries(personnel?.id);

  const isLoading = personnelLoading || timeLoading || assignmentsLoading || reimbursementsLoading || clockProjectsLoading || clockEntriesLoading || assetsLoading;
  
  // Get the active clock entry (if any)
  const activeClockEntry = openClockEntries?.[0] || null;
  
  const overtimeMultiplier = companySettings?.overtime_multiplier ?? 1.5;
  const weeklyOvertimeThreshold = companySettings?.weekly_overtime_threshold ?? 40;
  const holidayMultiplier = companySettings?.holiday_multiplier ?? 2.0;

  // Calculate hours this week
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const weeklyHours = timeEntries?.reduce((total, entry) => {
    const entryDate = parseISO(entry.entry_date);
    if (isWithinInterval(entryDate, { start: weekStart, end: weekEnd })) {
      return total + (entry.regular_hours || 0) + (entry.overtime_hours || 0);
    }
    return total;
  }, 0) || 0;

  const monthlyHours = timeEntries?.reduce((total, entry) => {
    const entryDate = parseISO(entry.entry_date);
    if (isWithinInterval(entryDate, { start: monthStart, end: monthEnd })) {
      return total + (entry.regular_hours || 0) + (entry.overtime_hours || 0);
    }
    return total;
  }, 0) || 0;

  // Calculate last completed pay period (for Upcoming Payment card)
  const hourlyRate = personnel?.hourly_rate || 0;
  const lastPayPeriod = getLastCompletedPayPeriod();
  const lastPayPeriodTotals = timeEntries 
    ? calculatePayPeriodTotals(timeEntries, lastPayPeriod, hourlyRate, overtimeMultiplier, weeklyOvertimeThreshold, holidayMultiplier)
    : { regularHours: 0, overtimeHours: 0, holidayHours: 0, totalHours: 0, regularPay: 0, overtimePay: 0, holidayPay: 0, totalPay: 0, daysWorked: 0 };

  const monthlyPay = monthlyHours * hourlyRate;

  // Count pending reimbursements
  const pendingReimbursements = reimbursements?.filter(r => r.status === "pending").length || 0;

  // Count unread notifications
  const unreadNotifications = notifications?.filter(n => !n.is_read).length || 0;

  // Active projects count
  const activeProjects = assignments?.length || 0;

  // Assigned assets count
  const assetCount = assignedAssets?.length || 0;

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          {personnel && (
            <PersonnelAvatar
              photoUrl={personnel.photo_url}
              firstName={personnel.first_name}
              lastName={personnel.last_name}
              size="lg"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold">
              Welcome, {personnel?.first_name}!
            </h1>
            <p className="text-muted-foreground">
              Here's an overview of your work activity
            </p>
          </div>
        </div>

        {/* Time Clock Card - Always show for personnel */}
        {personnel && (
          <ClockStatusCard
            personnelId={personnel.id}
            projects={clockProjects || []}
            activeEntry={activeClockEntry}
          />
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hours This Week</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{weeklyHours.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">
                {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d")}
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Payment</CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(lastPayPeriodTotals.totalPay)}
              </div>
              <p className="text-xs text-muted-foreground">
                Pay Period: {lastPayPeriod.label}
              </p>
              <p className="text-xs text-primary font-medium">
                Paid: {format(lastPayPeriod.paymentDate, "EEE, MMM d")}
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/portal/projects')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeProjects}</div>
              <p className="text-xs text-muted-foreground">
                Currently assigned
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Notifications</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{unreadNotifications}</div>
              <p className="text-xs text-muted-foreground">
                Unread messages
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Monthly Summary
              </CardTitle>
              <CardDescription>{format(now, "MMMM yyyy")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Hours</span>
                <span className="font-medium">{monthlyHours.toFixed(1)} hrs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated Pay</span>
                <span className="font-medium">${monthlyPay.toFixed(2)}</span>
              </div>
              <Link to="/portal/hours">
                <Button variant="outline" className="w-full mt-2">
                  View All Hours
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Reimbursements
              </CardTitle>
              <CardDescription>Track your expense claims</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-medium">{pendingReimbursements}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Submitted</span>
                <span className="font-medium">{reimbursements?.length || 0}</span>
              </div>
              <Link to="/portal/reimbursements">
                <Button variant="outline" className="w-full mt-2">
                  Manage Reimbursements
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Assigned Assets */}
        {assetCount > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Assigned Assets
              </CardTitle>
              <CardDescription>
                {assetCount} item{assetCount !== 1 ? "s" : ""} assigned to you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {assignedAssets?.slice(0, 3).map((assignment) => (
                <PortalAssetCard 
                  key={assignment.id} 
                  assignment={assignment}
                  showProject={true}
                />
              ))}
              {assetCount > 3 && (
                <Link to="/portal/assets">
                  <Button variant="ghost" className="w-full">
                    View All Assets ({assetCount})
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        {notifications && notifications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {notifications.slice(0, 3).map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`p-3 rounded-lg border ${!notification.is_read ? "bg-muted/50" : ""}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{notification.title}</p>
                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(notification.created_at), "MMM d")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {notifications.length > 3 && (
                <Link to="/portal/notifications">
                  <Button variant="ghost" className="w-full mt-4">
                    View All Notifications
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}

```

### `src/pages/portal/PortalDocuments.tsx`

```tsx
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel } from "@/integrations/supabase/hooks/usePortal";
import { 
  usePersonnelDocuments, 
  useGetPersonnelDocumentUrl,
  getDocumentTypeLabel,
  PersonnelDocument
} from "@/integrations/supabase/hooks/usePersonnelDocuments";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Loader2, FolderOpen, Eye, CheckCircle, FileSignature, CreditCard } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ICAFormPreview } from "@/components/personnel/ICAFormPreview";
import { downloadICAForm } from "@/lib/generateICA";
import { DirectDepositFormPreview } from "@/components/personnel/DirectDepositFormPreview";
import { downloadDirectDepositForm } from "@/lib/generateDirectDeposit";

export default function PortalDocuments() {
  const { data: personnel, isLoading: personnelLoading } = useCurrentPersonnel();
  const { data: documents, isLoading: documentsLoading } = usePersonnelDocuments(personnel?.id);
  const getDocumentUrl = useGetPersonnelDocumentUrl();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PersonnelDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showICADialog, setShowICADialog] = useState(false);
  const [showDirectDepositDialog, setShowDirectDepositDialog] = useState(false);

  const handleDownload = async (documentId: string, filePath: string, fileName: string) => {
    setDownloadingId(documentId);
    try {
      const url = await getDocumentUrl(filePath);
      if (url) {
        window.open(url, "_blank");
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = async (doc: PersonnelDocument) => {
    setPreviewDoc(doc);
    setPreviewLoading(true);
    try {
      const url = await getDocumentUrl(doc.file_path);
      setPreviewUrl(url);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewUrl(null);
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = (fileName: string): boolean => {
    const ext = fileName.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '');
  };

  const isPdf = (fileName: string): boolean => {
    return fileName.toLowerCase().endsWith('.pdf');
  };

  const isLoading = personnelLoading || documentsLoading;

  // Group documents by type
  const groupedDocuments = documents?.reduce((acc, doc) => {
    const type = doc.document_type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(doc);
    return acc;
  }, {} as Record<string, typeof documents>);

  // Check if ICA is signed
  const hasSignedICA = personnel?.ica_signature && personnel?.ica_signed_at;
  
  // Check if Direct Deposit is signed
  const hasSignedDirectDeposit = personnel?.direct_deposit_signature && personnel?.direct_deposit_signed_at;

  // Prepare ICA form data
  const icaFormData = personnel ? {
    contractorName: `${personnel.first_name} ${personnel.last_name}`,
    contractorAddress: [personnel.address, personnel.city, personnel.state, personnel.zip].filter(Boolean).join(", "),
    signature: personnel.ica_signature || null,
    signedDate: personnel.ica_signed_at ? new Date(personnel.ica_signed_at) : null,
  } : null;

  // Prepare Direct Deposit form data
  const directDepositFormData = personnel ? {
    name: `${personnel.first_name} ${personnel.last_name}`,
    address: personnel.address,
    city: personnel.city,
    state: personnel.state,
    zip: personnel.zip,
    email: personnel.email,
    phone: personnel.phone,
    bankName: personnel.bank_name,
    accountType: personnel.bank_account_type,
    routingNumber: personnel.bank_routing_number,
    accountNumber: personnel.bank_account_number,
    signature: personnel.direct_deposit_signature,
    signedAt: personnel.direct_deposit_signed_at,
  } : null;

  const hasSignedForms = hasSignedICA || hasSignedDirectDeposit;
  const hasUploadedDocuments = documents && documents.length > 0;

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Documents</h1>
          <p className="text-muted-foreground">
            View and download your signed forms and uploaded documents
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Signed Forms Section */}
            {hasSignedForms && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Signed Forms</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {/* ICA Card */}
                  {hasSignedICA && icaFormData && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileSignature className="h-4 w-4 text-primary" />
                          Independent Contractor Agreement
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle className="h-3 w-3" /> Signed
                          </Badge>
                          <span className="text-xs ml-2">
                            {personnel?.ica_signed_at && format(new Date(personnel.ica_signed_at), "MMM d, yyyy")}
                          </span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowICADialog(true)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadICAForm(icaFormData)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* Direct Deposit Card */}
                  {hasSignedDirectDeposit && directDepositFormData && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-primary" />
                          Direct Deposit Authorization
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle className="h-3 w-3" /> Authorized
                          </Badge>
                          <span className="text-xs ml-2">
                            {personnel?.direct_deposit_signed_at && format(new Date(personnel.direct_deposit_signed_at), "MMM d, yyyy")}
                          </span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDirectDepositDialog(true)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadDirectDepositForm(directDepositFormData)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {/* Uploaded Documents Section */}
            {hasUploadedDocuments ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Uploaded Documents</h2>
                <div className="grid gap-4">
                  {Object.entries(groupedDocuments || {}).map(([type, docs]) => (
                    <Card key={type}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          {getDocumentTypeLabel(type)}
                        </CardTitle>
                        <CardDescription>
                          {docs?.length} {docs?.length === 1 ? "file" : "files"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {docs?.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => handlePreview(doc)}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {doc.file_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(doc.file_size)} • Uploaded{" "}
                                {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePreview(doc);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(doc.id, doc.file_path, doc.file_name);
                                }}
                                disabled={downloadingId === doc.id}
                              >
                                {downloadingId === doc.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : !hasSignedForms ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Documents</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You haven't uploaded any documents yet.
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </div>

      {/* Document Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {previewDoc && getDocumentTypeLabel(previewDoc.document_type)}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 overflow-auto">
            {previewLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : previewUrl && previewDoc ? (
              <div className="space-y-4">
                {/* Preview Content */}
                <div className="flex items-center justify-center bg-muted/30 rounded-lg p-4 min-h-[400px]">
                  {isImage(previewDoc.file_name) ? (
                    <img 
                      src={previewUrl} 
                      alt={previewDoc.file_name}
                      className="max-w-full max-h-[60vh] object-contain rounded"
                    />
                  ) : isPdf(previewDoc.file_name) ? (
                    <iframe 
                      src={previewUrl}
                      className="w-full h-[60vh] rounded border"
                      title={previewDoc.file_name}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Preview not available for this file type
                      </p>
                    </div>
                  )}
                </div>

                {/* Document Info */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{previewDoc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(previewDoc.file_size)} • Uploaded{" "}
                      {format(new Date(previewDoc.uploaded_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(previewDoc.id, previewDoc.file_path, previewDoc.file_name)}
                    disabled={downloadingId === previewDoc.id}
                  >
                    {downloadingId === previewDoc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Download
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* ICA Preview Dialog */}
      <Dialog open={showICADialog} onOpenChange={setShowICADialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Independent Contractor Agreement</DialogTitle>
          </DialogHeader>
          {icaFormData && <ICAFormPreview data={icaFormData} />}
        </DialogContent>
      </Dialog>

      {/* Direct Deposit Preview Dialog */}
      <Dialog open={showDirectDepositDialog} onOpenChange={setShowDirectDepositDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Direct Deposit Authorization Form</DialogTitle>
          </DialogHeader>
          {directDepositFormData && <DirectDepositFormPreview data={directDepositFormData} />}
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
```

### `src/pages/portal/PortalHours.tsx`

```tsx
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel, usePersonnelTimeEntries } from "@/integrations/supabase/hooks/usePortal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { calculateSingleEmployeeOvertime } from "@/lib/overtimeUtils";

export default function PortalHours() {
  const { data: personnel } = useCurrentPersonnel();
  const { data: timeEntries, isLoading } = usePersonnelTimeEntries(personnel?.id);
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const weekEnd = endOfWeek(selectedWeekStart, { weekStartsOn: 1 });

  // Filter entries for selected week
  const weekEntries = timeEntries?.filter(entry => {
    const entryDate = parseISO(entry.entry_date);
    return isWithinInterval(entryDate, { start: selectedWeekStart, end: weekEnd });
  }) || [];

  // Calculate totals using 40-hour weekly threshold for this single employee
  const { totalRegular, totalOvertime, totalHours } = useMemo(() => {
    // Sum all hours for the week (ignore stored regular/overtime split)
    const weeklyTotal = weekEntries.reduce((sum, e) => 
      sum + (e.regular_hours || 0) + (e.overtime_hours || 0), 0
    );
    const { regularHours, overtimeHours } = calculateSingleEmployeeOvertime(weeklyTotal, 40);
    return { totalRegular: regularHours, totalOvertime: overtimeHours, totalHours: weeklyTotal };
  }, [weekEntries]);

  // Group by project
  const entriesByProject = weekEntries.reduce((acc, entry) => {
    const projectName = entry.project?.name || "Unknown Project";
    if (!acc[projectName]) {
      acc[projectName] = [];
    }
    acc[projectName].push(entry);
    return acc;
  }, {} as Record<string, typeof weekEntries>);

  const goToPreviousWeek = () => {
    setSelectedWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 7);
      return newDate;
    });
  };

  const goToNextWeek = () => {
    setSelectedWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 7);
      return newDate;
    });
  };

  const goToCurrentWeek = () => {
    setSelectedWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">My Hours</h1>
            <p className="text-muted-foreground">View your recorded work hours</p>
          </div>
        </div>

        {/* Week Navigator */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="text-center">
                <p className="font-medium">
                  {format(selectedWeekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
                </p>
                <Button variant="link" size="sm" onClick={goToCurrentWeek} className="text-xs">
                  Go to Current Week
                </Button>
              </div>
              
              <Button variant="outline" size="icon" onClick={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Regular Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRegular.toFixed(1)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overtime Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{totalOvertime.toFixed(1)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Hours by Project */}
        {Object.keys(entriesByProject).length > 0 ? (
          Object.entries(entriesByProject).map(([projectName, entries]) => {
            // Sum total hours for this project and recalculate based on 40-hour threshold
            const projectTotalHours = entries.reduce((sum, e) => 
              sum + (e.regular_hours || 0) + (e.overtime_hours || 0), 0
            );
            // Note: For per-project breakdown, we show raw hours since overtime is calculated weekly across all projects
            const projectRegular = projectTotalHours;
            const projectOvertime = 0; // Overtime is calculated at weekly level, not per-project
            
            return (
              <Card key={projectName}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    {projectName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Regular</TableHead>
                        <TableHead className="text-right">Overtime</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.sort((a, b) => a.entry_date.localeCompare(b.entry_date)).map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {format(parseISO(entry.entry_date), "EEE, MMM d")}
                          </TableCell>
                          <TableCell className="text-right">
                            {(entry.regular_hours || 0).toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right text-orange-500">
                            {(entry.overtime_hours || 0).toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {((entry.regular_hours || 0) + (entry.overtime_hours || 0)).toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50">
                        <TableCell className="font-medium">Subtotal</TableCell>
                        <TableCell className="text-right font-medium">{projectRegular.toFixed(1)}</TableCell>
                        <TableCell className="text-right font-medium text-orange-500">{projectOvertime.toFixed(1)}</TableCell>
                        <TableCell className="text-right font-medium">{(projectRegular + projectOvertime).toFixed(1)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hours recorded</h3>
              <p className="text-muted-foreground text-center">
                No time entries found for this week.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}

```

### `src/pages/portal/PortalLogin.tsx`

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, User, ArrowRightLeft } from "lucide-react";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { AppleIcon } from "@/components/icons/AppleIcon";
import { PortalSwitcherModal } from "@/components/PortalSwitcherModal";
import { usePortalSwitcher } from "@/hooks/usePortalSwitcher";
import { NetworkErrorBanner } from "@/components/auth/NetworkErrorBanner";
import { withTimeout, isNetworkError, classifyNetworkError } from "@/utils/authNetwork";

export default function PortalLogin() {
  const navigate = useNavigate();
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [showNetworkError, setShowNetworkError] = useState(false);
  const {
    isOpen: isPortalSwitcherOpen,
    setIsOpen: setPortalSwitcherOpen,
    openSwitcher,
  } = usePortalSwitcher();

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setShowNetworkError(false);

    try {
      console.info(`[PortalLogin] signIn: start | origin: ${window.location.origin}`);

      const signInPromise = supabase.auth.signInWithPassword({
        email,
        password,
      });

      const { error } = await withTimeout(signInPromise, 15000, "Sign in");

      if (error) throw error;

      console.info("[PortalLogin] signIn: success, checking personnel link");
      
      // Check if user is linked to personnel
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: personnel } = await supabase
          .from("personnel")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (personnel) {
          navigate("/portal");
        } else {
          toast.error("Your account is not linked to a personnel record");
          await supabase.auth.signOut();
        }
      }
    } catch (error: unknown) {
      console.error("[PortalLogin] signIn: exception", error);
      if (isNetworkError(error)) {
        const networkErr = classifyNetworkError(error);
        setShowNetworkError(true);
        toast.error(networkErr.userMessage);
      } else {
        toast.error((error as Error).message || "Failed to sign in");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setShowNetworkError(false);
    if (email && password) {
      handleLogin();
    }
  };

  const handleGoogleLogin = async () => {
    setIsOAuthLoading(true);
    setShowNetworkError(false);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        if (isNetworkError(error) || error.message.includes("Can't reach")) {
          setShowNetworkError(true);
        }
        throw error;
      }
      // AuthCallback will handle the redirect
    } catch (error: unknown) {
      toast.error((error as Error).message || "Failed to sign in with Google");
      setIsOAuthLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsOAuthLoading(true);
    setShowNetworkError(false);
    try {
      const { error } = await signInWithApple();
      if (error) {
        if (isNetworkError(error) || error.message.includes("Can't reach")) {
          setShowNetworkError(true);
        }
        throw error;
      }
      // AuthCallback will handle the redirect
    } catch (error: unknown) {
      toast.error((error as Error).message || "Failed to sign in with Apple");
      setIsOAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
            <User className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Personnel Portal</CardTitle>
          <CardDescription>
            Sign in to view your hours, projects, and more
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isOAuthLoading || loading}
            >
              {isOAuthLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <GoogleIcon className="h-4 w-4 mr-2" />
              )}
              Continue with Google
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleAppleLogin}
              disabled={isOAuthLoading || loading}
            >
              {isOAuthLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <AppleIcon className="h-4 w-4 mr-2" />
              )}
              Continue with Apple
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || isOAuthLoading}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Sign In
              </Button>
            </form>
          </div>

          {/* Network Error Banner */}
          {showNetworkError && (
            <NetworkErrorBanner onRetry={handleRetry} isRetrying={loading} />
          )}

          <p className="text-sm text-center text-muted-foreground mt-6">
            Don't have an account? Contact your administrator to receive an
            invitation.
          </p>

          {/* Portal Switcher */}
          <div className="pt-4 mt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={openSwitcher}
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Switch Portal
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Portal Switcher Modal */}
      <PortalSwitcherModal
        open={isPortalSwitcherOpen}
        onOpenChange={setPortalSwitcherOpen}
      />
    </div>
  );
}

```

### `src/pages/portal/PortalNotifications.tsx`

```tsx
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel, usePersonnelNotifications, useMarkNotificationRead } from "@/integrations/supabase/hooks/usePortal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Briefcase, DollarSign, Info, CheckCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

const NOTIFICATION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  general: Info,
  job_alert: Briefcase,
  pay_info: DollarSign,
  assignment: CheckCircle,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  general: "bg-blue-500/10 text-blue-500",
  job_alert: "bg-orange-500/10 text-orange-500",
  pay_info: "bg-green-500/10 text-green-500",
  assignment: "bg-purple-500/10 text-purple-500",
};

export default function PortalNotifications() {
  const { data: personnel } = useCurrentPersonnel();
  const { data: notifications, isLoading } = usePersonnelNotifications(personnel?.id);
  const markRead = useMarkNotificationRead();

  const handleMarkRead = (id: string) => {
    if (!personnel?.id) return;
    markRead.mutate({ id, personnelId: personnel.id });
  };

  const handleMarkAllRead = () => {
    if (!personnel?.id || !notifications) return;
    const unread = notifications.filter(n => !n.is_read);
    unread.forEach(n => {
      markRead.mutate({ id: n.id, personnelId: personnel.id });
    });
  };

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-muted-foreground">
              {unreadCount > 0 
                ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                : "All caught up!"
              }
            </p>
          </div>
          
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllRead}>
              Mark All as Read
            </Button>
          )}
        </div>

        {notifications && notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const Icon = NOTIFICATION_ICONS[notification.notification_type] || Info;
              const iconColor = NOTIFICATION_COLORS[notification.notification_type] || NOTIFICATION_COLORS.general;
              
              return (
                <Card 
                  key={notification.id}
                  className={cn(
                    "transition-colors",
                    !notification.is_read && "bg-muted/50 border-primary/20"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={cn("p-2 rounded-lg", iconColor)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{notification.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.message}
                            </p>
                          </div>
                          
                          {!notification.is_read && (
                            <Badge variant="default" className="shrink-0">New</Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(notification.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                          
                          {!notification.is_read && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleMarkRead(notification.id)}
                            >
                              Mark as Read
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No notifications</h3>
              <p className="text-muted-foreground text-center">
                You don't have any notifications yet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}

```

### `src/pages/portal/PortalProjectDetail.tsx`

```tsx
import { useParams, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel, usePersonnelTimeEntries, usePersonnelAllAssignments } from "@/integrations/supabase/hooks/usePortal";
import { usePersonnelProjectAssets } from "@/integrations/supabase/hooks/usePortalAssets";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Briefcase, Calendar, Clock, MapPin, User, Building, Phone, Mail, FileText, DollarSign, Package, AlertCircle } from "lucide-react";
import { format, parseISO, startOfWeek } from "date-fns";
import { ProjectWeeklyPayHistory } from "@/components/portal/ProjectWeeklyPayHistory";
import { formatCurrency } from "@/lib/utils";
import { PortalAssetCard } from "@/components/portal/PortalAssetCard";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PortalProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: personnel } = useCurrentPersonnel();
  // Use ALL assignments (not just active) to allow viewing historical projects
  const { data: allAssignments, isLoading: assignmentsLoading } = usePersonnelAllAssignments(personnel?.id);
  const { data: timeEntries, isLoading: timeLoading } = usePersonnelTimeEntries(personnel?.id);
  const { data: projectAssets, isLoading: assetsLoading } = usePersonnelProjectAssets(personnel?.id, id);
  const { data: companySettings } = useCompanySettings();

  const overtimeMultiplier = companySettings?.overtime_multiplier ?? 1.5;
  const holidayMultiplier = companySettings?.holiday_multiplier ?? 2.0;

  // Find ANY assignment for this project (not just active - allows viewing history)
  const assignment = allAssignments?.find(a => a.project?.id === id);
  const project = assignment?.project;
  const isActiveAssignment = assignment?.status === 'active';

  // Filter time entries for this project
  const projectTimeEntries = timeEntries?.filter(entry => entry.project_id === id) || [];

  // Calculate hours for this project using 40-hour weekly overtime threshold
  const { totalRegularHours, totalOvertimeHours, totalHolidayHours, totalHours } = useMemo(() => {
    // Group entries by week
    const entriesByWeek = new Map<string, { hours: number; holidayHours: number }>();
    
    projectTimeEntries.forEach(entry => {
      const entryDate = parseISO(entry.entry_date);
      const weekStart = startOfWeek(entryDate, { weekStartsOn: 1 }).toISOString();
      const entryHours = (entry.regular_hours || 0) + (entry.overtime_hours || 0);
      const existing = entriesByWeek.get(weekStart) || { hours: 0, holidayHours: 0 };
      entriesByWeek.set(weekStart, {
        hours: existing.hours + entryHours,
        holidayHours: existing.holidayHours + ((entry as any).is_holiday ? entryHours : 0)
      });
    });
    
    // Calculate regular and overtime based on 40-hour weekly threshold
    let regular = 0;
    let overtime = 0;
    let holiday = 0;
    
    entriesByWeek.forEach(({ hours: weekHours, holidayHours }) => {
      if (weekHours <= 40) {
        regular += weekHours;
      } else {
        regular += 40;
        overtime += weekHours - 40;
      }
      holiday += holidayHours;
    });
    
    return {
      totalRegularHours: regular,
      totalOvertimeHours: overtime,
      totalHolidayHours: holiday,
      totalHours: regular + overtime
    };
  }, [projectTimeEntries]);

  // Calculate pay using each entry's snapshotted hourly_rate (fallback to personnel rate if missing)
  const fallbackRate = personnel?.hourly_rate || 0;
  
  // Group entries by week and calculate pay respecting 40-hour OT threshold per week
  const weeklyData = useMemo(() => {
    const weekMap = new Map<string, typeof projectTimeEntries>();
    
    projectTimeEntries.forEach(entry => {
      const entryDate = parseISO(entry.entry_date);
      const weekStart = startOfWeek(entryDate, { weekStartsOn: 1 }).toISOString();
      const weekEntries = weekMap.get(weekStart) || [];
      weekEntries.push(entry);
      weekMap.set(weekStart, weekEntries);
    });
    
    let totalRegularPay = 0;
    let totalOvertimePay = 0;
    let totalHolidayPay = 0;
    
    weekMap.forEach((weekEntries) => {
      // Sort entries by date within the week
      const sorted = [...weekEntries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
      let hoursAccumulated = 0;
      
      sorted.forEach((entry) => {
        const entryRate = entry.hourly_rate ?? fallbackRate;
        const entryTotalHours = (entry.regular_hours || 0) + (entry.overtime_hours || 0);
        const isHoliday = (entry as any).is_holiday === true;
        
        let entryRegular = 0;
        let entryOvertime = 0;
        
        if (hoursAccumulated >= 40) {
          entryOvertime = entryTotalHours;
        } else if (hoursAccumulated + entryTotalHours > 40) {
          entryRegular = 40 - hoursAccumulated;
          entryOvertime = entryTotalHours - entryRegular;
        } else {
          entryRegular = entryTotalHours;
        }
        
        hoursAccumulated += entryTotalHours;
        
        if (isHoliday) {
          // Holiday pay uses holiday multiplier
          totalHolidayPay += entryRegular * entryRate * holidayMultiplier;
          totalHolidayPay += entryOvertime * entryRate * Math.max(overtimeMultiplier, holidayMultiplier);
        } else {
          totalRegularPay += entryRegular * entryRate;
          totalOvertimePay += entryOvertime * entryRate * overtimeMultiplier;
        }
      });
    });
    
    return { totalRegularPay, totalOvertimePay, totalHolidayPay };
  }, [projectTimeEntries, fallbackRate, overtimeMultiplier, holidayMultiplier]);
  
  const totalRegularPay = weeklyData.totalRegularPay;
  const totalOvertimePay = weeklyData.totalOvertimePay;
  const totalHolidayPay = weeklyData.totalHolidayPay;
  const totalPay = totalRegularPay + totalOvertimePay + totalHolidayPay;

  const isLoading = assignmentsLoading || timeLoading || assetsLoading;

  // Format address
  const formatAddress = () => {
    if (!project) return null;
    const parts = [project.address, project.city, project.state, project.zip].filter(Boolean);
    if (parts.length === 0) return null;
    
    if (project.city && project.state) {
      return `${project.address || ''}\n${project.city}, ${project.state} ${project.zip || ''}`.trim();
    }
    return parts.join(', ');
  };

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      </PortalLayout>
    );
  }

  if (!assignment || !project) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => navigate("/portal/projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Project not found</h3>
              <p className="text-muted-foreground text-center">
                This project may not be assigned to you or doesn't exist.
              </p>
            </CardContent>
          </Card>
        </div>
      </PortalLayout>
    );
  }

  const address = formatAddress();
  const customer = project.customer;

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/portal/projects")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground">Project Details</p>
          </div>
          <div className="flex items-center gap-2">
            {!isActiveAssignment && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                Past Assignment
              </Badge>
            )}
            <Badge variant={project.status === "active" ? "default" : "secondary"}>
              {project.status}
            </Badge>
          </div>
        </div>

        {/* Inactive Assignment Banner */}
        {!isActiveAssignment && (
          <Alert variant="default" className="border-amber-200 bg-amber-50/50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              You are no longer actively assigned to this project. You can view your historical time entries and pay information below.
              {assignment.unassigned_at && (
                <span className="block text-sm text-amber-600 mt-1">
                  Assignment ended: {format(parseISO(assignment.unassigned_at), "MMM d, yyyy")}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Project Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>
                    Assigned {format(parseISO(assignment.assigned_at), "MMM d, yyyy")}
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {project.start_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Started: {format(parseISO(project.start_date), "MMM d, yyyy")}</span>
                </div>
              )}
              {project.end_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Ends: {format(parseISO(project.end_date), "MMM d, yyyy")}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Location & Contact Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Jobsite Location */}
          {address && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Jobsite Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line">{address}</p>
              </CardContent>
            </Card>
          )}

          {/* Point of Contact */}
          {(project.poc_name || project.poc_phone || project.poc_email) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Point of Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {project.poc_name && (
                  <p className="text-sm font-medium">{project.poc_name}</p>
                )}
                {project.poc_phone && (
                  <a href={`tel:${project.poc_phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Phone className="h-3 w-3" />
                    {project.poc_phone}
                  </a>
                )}
                {project.poc_email && (
                  <a href={`mailto:${project.poc_email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Mail className="h-3 w-3" />
                    {project.poc_email}
                  </a>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Customer Info */}
        {(customer || project.customer_po) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="h-4 w-4 text-primary" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {customer && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Customer</p>
                    <p className="text-sm font-medium">{customer.company || customer.name}</p>
                  </div>
                )}
                {project.customer_po && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Customer PO</p>
                    <p className="text-sm font-medium">{project.customer_po}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Project Description */}
        {project.description && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Project Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{project.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Assigned Equipment */}
        {projectAssets && projectAssets.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Assigned Equipment
              </CardTitle>
              <CardDescription>
                {projectAssets.length} item{projectAssets.length !== 1 ? "s" : ""} assigned for this project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {projectAssets.map((assignment) => (
                <PortalAssetCard 
                  key={assignment.id} 
                  assignment={assignment}
                  showProject={false}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Hours & Pay Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Project Totals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Total Hours</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{totalRegularHours.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Regular</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-amber-600">{totalOvertimeHours.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">OT</div>
              </div>
              {totalHolidayHours > 0 && (
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-purple-600">{totalHolidayHours.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground">HO</div>
                </div>
              )}
              {fallbackRate > 0 && (
                <div className="text-center p-4 rounded-lg bg-primary/10">
                  <div className="text-2xl font-bold text-primary">{formatCurrency(totalPay)}</div>
                  <div className="text-sm text-muted-foreground">Total Pay</div>
                </div>
              )}
            </div>

            {/* Pay breakdown formula */}
            {fallbackRate > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-muted/30 border">
                <div className="flex flex-wrap items-center gap-2 justify-center text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>{formatCurrency(totalRegularPay)}</span>
                  <span className="text-muted-foreground">+</span>
                  <span className="text-amber-600">{formatCurrency(totalOvertimePay)}</span>
                  <span className="text-xs text-muted-foreground">(1.5x)</span>
                  {totalHolidayPay > 0 && (
                    <>
                      <span className="text-muted-foreground">+</span>
                      <span className="text-purple-600">{formatCurrency(totalHolidayPay)}</span>
                      <span className="text-xs text-muted-foreground">(2x)</span>
                    </>
                  )}
                  <span className="text-muted-foreground">=</span>
                  <span className="font-semibold text-primary">{formatCurrency(totalPay)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Pay History */}
        <ProjectWeeklyPayHistory 
          timeEntries={projectTimeEntries}
          hourlyRate={personnel?.hourly_rate || null}
          overtimeMultiplier={overtimeMultiplier}
          holidayMultiplier={holidayMultiplier}
        />
      </div>
    </PortalLayout>
  );
}

```

### `src/pages/portal/PortalProjects.tsx`

```tsx
import { useNavigate } from "react-router-dom";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel, usePersonnelAssignments, usePersonnelAllAssignments, usePersonnelTimeEntries } from "@/integrations/supabase/hooks/usePortal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, Calendar, Clock, ChevronRight, History } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function PortalProjects() {
  const navigate = useNavigate();
  const { data: personnel } = useCurrentPersonnel();
  const { data: activeAssignments, isLoading: activeLoading } = usePersonnelAssignments(personnel?.id);
  const { data: allAssignments, isLoading: allLoading } = usePersonnelAllAssignments(personnel?.id);
  const { data: timeEntries } = usePersonnelTimeEntries(personnel?.id);

  // Calculate hours per project
  const hoursByProject = timeEntries?.reduce((acc, entry) => {
    const projectId = entry.project_id;
    if (!acc[projectId]) {
      acc[projectId] = { regular: 0, overtime: 0 };
    }
    acc[projectId].regular += entry.regular_hours || 0;
    acc[projectId].overtime += entry.overtime_hours || 0;
    return acc;
  }, {} as Record<string, { regular: number; overtime: number }>) || {};

  // Current projects = active assignments
  const currentProjects = activeAssignments || [];
  
  // Past projects = assignments that are not active, deduplicated by project ID
  // (show latest assignment for each project that's not currently active)
  const activeProjectIds = new Set(currentProjects.map(a => a.project?.id));
  const pastProjectsRaw = allAssignments?.filter(a => 
    a.status !== 'active' && 
    a.project?.id && 
    !activeProjectIds.has(a.project.id)
  ) || [];
  
  // Deduplicate past projects - show only the most recent assignment per project
  const pastProjectsMap = new Map<string, typeof pastProjectsRaw[0]>();
  pastProjectsRaw.forEach(assignment => {
    const projectId = assignment.project?.id;
    if (projectId && !pastProjectsMap.has(projectId)) {
      pastProjectsMap.set(projectId, assignment);
    }
  });
  const pastProjects = Array.from(pastProjectsMap.values());

  const isLoading = activeLoading || allLoading;

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </PortalLayout>
    );
  }

  const ProjectCard = ({ assignment, isPast = false }: { assignment: typeof currentProjects[0]; isPast?: boolean }) => {
    const project = assignment.project;
    const projectHours = hoursByProject[project?.id || ""] || { regular: 0, overtime: 0 };
    const totalHours = projectHours.regular + projectHours.overtime;
    
    return (
      <Card 
        key={assignment.id}
        className={`cursor-pointer hover:shadow-md transition-shadow group ${isPast ? 'opacity-80' : ''}`}
        onClick={() => navigate(`/portal/projects/${project?.id}`)}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isPast ? 'bg-muted' : 'bg-primary/10'}`}>
                {isPast ? (
                  <History className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Briefcase className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg group-hover:text-primary transition-colors">
                  {project?.name}
                </CardTitle>
                <CardDescription>
                  {isPast && assignment.unassigned_at ? (
                    <>Ended {format(parseISO(assignment.unassigned_at), "MMM d, yyyy")}</>
                  ) : (
                    <>Assigned {format(parseISO(assignment.assigned_at), "MMM d, yyyy")}</>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={project?.status === "active" ? "default" : "secondary"}>
                {project?.status}
              </Badge>
              {isPast && (
                <Badge variant="outline" className="text-xs">
                  History
                </Badge>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {project?.start_date 
                  ? format(parseISO(project.start_date), "MMM d, yyyy")
                  : "No start date"
                }
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{totalHours.toFixed(1)} hrs logged</span>
            </div>
          </div>
          
          {totalHours > 0 && (
            <div className="pt-4 border-t">
              <div className="text-sm text-muted-foreground mb-2">Hours Breakdown</div>
              <div className="flex gap-4">
                <div>
                  <span className="text-lg font-semibold">{projectHours.regular.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground ml-1">regular</span>
                </div>
                {projectHours.overtime > 0 && (
                  <div>
                    <span className="text-lg font-semibold text-orange-500">{projectHours.overtime.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground ml-1">overtime</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Projects</h1>
          <p className="text-muted-foreground">Projects you're currently assigned to and past project history</p>
        </div>

        {/* Current Projects */}
        {currentProjects.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Current Projects
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {currentProjects.map((assignment) => (
                <ProjectCard key={assignment.id} assignment={assignment} />
              ))}
            </div>
          </div>
        )}

        {/* Past Projects */}
        {pastProjects.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
              <History className="h-5 w-5" />
              Past Projects
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {pastProjects.map((assignment) => (
                <ProjectCard key={assignment.id} assignment={assignment} isPast />
              ))}
            </div>
          </div>
        )}

        {/* No Projects */}
        {currentProjects.length === 0 && pastProjects.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects</h3>
              <p className="text-muted-foreground text-center">
                You have not been assigned to any projects yet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
```

### `src/pages/portal/PortalReimbursements.tsx`

```tsx
import { useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel, usePersonnelReimbursements, usePersonnelAssignments, useAddReimbursement } from "@/integrations/supabase/hooks/usePortal";
import { useExpenseCategories } from "@/integrations/supabase/hooks/useExpenseCategories";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, Plus, DollarSign, Image, Download, Eye } from "lucide-react";
import { downloadReceipt, getReceiptFilename } from "@/utils/receiptDownload";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ReceiptUpload } from "@/components/portal/ReceiptUpload";

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  paid: "outline",
};

export default function PortalReimbursements() {
  const { data: personnel } = useCurrentPersonnel();
  const { data: reimbursements, isLoading } = usePersonnelReimbursements(personnel?.id);
  const { data: assignments } = usePersonnelAssignments(personnel?.id);
  const { data: expenseCategories, isLoading: categoriesLoading } = useExpenseCategories('both');
  const addReimbursement = useAddReimbursement();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    category: "",
    category_id: "",
    project_id: "",
    receipt_url: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personnel?.id) return;

    await addReimbursement.mutateAsync({
      personnel_id: personnel.id,
      amount: parseFloat(formData.amount),
      description: formData.description,
      category: formData.category,
      project_id: formData.project_id || null,
      status: "pending",
      receipt_url: formData.receipt_url || null,
      notes: null,
    });

    setFormData({ amount: "", description: "", category: "", category_id: "", project_id: "", receipt_url: "" });
    setDialogOpen(false);
  };

  // Calculate totals
  const pendingTotal = reimbursements?.filter(r => r.status === "pending").reduce((sum, r) => sum + r.amount, 0) || 0;
  const approvedTotal = reimbursements?.filter(r => r.status === "approved").reduce((sum, r) => sum + r.amount, 0) || 0;

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Reimbursements</h1>
            <p className="text-muted-foreground">Submit and track expense reimbursements</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Reimbursement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit Reimbursement</DialogTitle>
                <DialogDescription>
                  Submit an expense for reimbursement approval
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="pl-9"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => {
                      const selectedCategory = expenseCategories?.find(c => c.id === value);
                      setFormData({ 
                        ...formData, 
                        category_id: value,
                        category: selectedCategory?.name || ""
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriesLoading ? (
                        <SelectItem value="loading" disabled>Loading categories...</SelectItem>
                      ) : expenseCategories && expenseCategories.length > 0 ? (
                        expenseCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="other">Other</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="project">Project (Optional)</Label>
                  <Select
                    value={formData.project_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, project_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific project</SelectItem>
                      {assignments?.filter(a => a.project?.id).map((assignment) => (
                        <SelectItem key={assignment.project!.id} value={assignment.project!.id}>
                          {assignment.project?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the expense..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>

                {personnel?.id && (
                  <div className="space-y-2">
                    <Label>Receipt (Optional)</Label>
                    <ReceiptUpload
                      personnelId={personnel.id}
                      onUpload={(url) => setFormData({ ...formData, receipt_url: url })}
                      existingUrl={formData.receipt_url || null}
                    />
                  </div>
                )}
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addReimbursement.isPending}>
                    {addReimbursement.isPending ? "Submitting..." : "Submit"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Approval
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${pendingTotal.toFixed(2)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Approved (Awaiting Payment)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${approvedTotal.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Reimbursements List */}
        {reimbursements && reimbursements.length > 0 ? (
          <div className="space-y-4">
            {reimbursements.map((reimbursement) => (
              <Card key={reimbursement.id}>
                <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      {reimbursement.receipt_url ? (
                        <div className="flex-shrink-0">
                          <button
                            onClick={() => setPreviewUrl(reimbursement.receipt_url)}
                            className="block"
                          >
                            <div className="w-12 h-12 rounded-lg overflow-hidden border bg-muted hover:opacity-80 transition-opacity">
                              {reimbursement.receipt_url.endsWith('.pdf') ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Image className="h-5 w-5 text-muted-foreground" />
                                </div>
                              ) : (
                                <img
                                  src={reimbursement.receipt_url}
                                  alt="Receipt"
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                          </button>
                          <div className="flex gap-1 mt-1 justify-center">
                            <button
                              onClick={() => setPreviewUrl(reimbursement.receipt_url)}
                              className="text-xs text-primary hover:underline"
                              title="Preview"
                            >
                              <Eye className="h-3 w-3" />
                            </button>
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
                              className="text-xs text-muted-foreground hover:text-foreground"
                              title="Download"
                            >
                              <Download className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-muted flex-shrink-0">
                          <Receipt className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{reimbursement.description}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
                          <span className="capitalize">{reimbursement.category}</span>
                          {reimbursement.project && (
                            <>
                              <span>•</span>
                              <span>{reimbursement.project.name}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{format(parseISO(reimbursement.submitted_at), "MMM d, yyyy")}</span>
                        </div>
                        {reimbursement.notes && (
                          <p className="text-sm text-muted-foreground mt-2 italic">
                            Note: {reimbursement.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-semibold">${reimbursement.amount.toFixed(2)}</p>
                      <Badge variant={STATUS_COLORS[reimbursement.status]} className="mt-1">
                        {reimbursement.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No reimbursements</h3>
              <p className="text-muted-foreground text-center mb-4">
                You haven't submitted any reimbursement requests yet.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Submit First Reimbursement
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Receipt Preview Dialog */}
        <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Receipt Preview</DialogTitle>
            </DialogHeader>
            {previewUrl && (
              <div className="flex items-center justify-center max-h-[70vh] overflow-auto">
                {previewUrl.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[70vh] border-0"
                    title="Receipt PDF"
                  />
                ) : (
                  <img src={previewUrl} alt="Receipt" className="max-w-full h-auto" />
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PortalLayout>
  );
}

```

### `src/pages/portal/PortalSettings.tsx`

```tsx
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel, usePersonnelNotificationPreferences, useUpdateNotificationPreferences } from "@/integrations/supabase/hooks/usePortal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Bell, Mail, Smartphone, Briefcase, DollarSign, UserPlus } from "lucide-react";
import { DeleteAccountSection } from "@/components/settings/DeleteAccountSection";

export default function PortalSettings() {
  const { data: personnel } = useCurrentPersonnel();
  const { data: preferences, isLoading } = usePersonnelNotificationPreferences(personnel?.id);
  const updatePreferences = useUpdateNotificationPreferences();

  const handleToggle = (key: string, value: boolean) => {
    if (!personnel?.id) return;
    updatePreferences.mutate({
      personnelId: personnel.id,
      preferences: { [key]: value },
    });
  };

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </PortalLayout>
    );
  }

  // Default values if no preferences exist yet
  const currentPreferences = {
    email_notifications: preferences?.email_notifications ?? true,
    sms_notifications: preferences?.sms_notifications ?? false,
    job_alerts: preferences?.job_alerts ?? true,
    pay_notifications: preferences?.pay_notifications ?? true,
    assignment_notifications: preferences?.assignment_notifications ?? true,
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your notification preferences</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Channels
            </CardTitle>
            <CardDescription>
              Choose how you want to receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="email_notifications" className="text-base">
                    Email Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
              </div>
              <Switch
                id="email_notifications"
                checked={currentPreferences.email_notifications}
                onCheckedChange={(checked) => handleToggle("email_notifications", checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="sms_notifications" className="text-base">
                    SMS Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive text message alerts
                  </p>
                </div>
              </div>
              <Switch
                id="sms_notifications"
                checked={currentPreferences.sms_notifications}
                onCheckedChange={(checked) => handleToggle("sms_notifications", checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Notification Types
            </CardTitle>
            <CardDescription>
              Select which types of notifications you want to receive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="job_alerts" className="text-base">
                    Job Alerts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    New job opportunities and assignments
                  </p>
                </div>
              </div>
              <Switch
                id="job_alerts"
                checked={currentPreferences.job_alerts}
                onCheckedChange={(checked) => handleToggle("job_alerts", checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="pay_notifications" className="text-base">
                    Pay Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Updates about pay and reimbursements
                  </p>
                </div>
              </div>
              <Switch
                id="pay_notifications"
                checked={currentPreferences.pay_notifications}
                onCheckedChange={(checked) => handleToggle("pay_notifications", checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserPlus className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="assignment_notifications" className="text-base">
                    Assignment Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Project assignment updates
                  </p>
                </div>
              </div>
              <Switch
                id="assignment_notifications"
                checked={currentPreferences.assignment_notifications}
                onCheckedChange={(checked) => handleToggle("assignment_notifications", checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Profile Info Card */}
        {personnel && (
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Your personnel details (contact admin to make changes)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{personnel.first_name} {personnel.last_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Personnel Number</p>
                  <p className="font-medium">{personnel.personnel_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{personnel.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{personnel.phone || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hourly Rate</p>
                  <p className="font-medium">${personnel.hourly_rate?.toFixed(2) || "0.00"}/hr</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Danger Zone - Account Deletion */}
        <DeleteAccountSection />
      </div>
    </PortalLayout>
  );
}

```

### `src/pages/portal/PortalTaxForms.tsx`

```tsx
import { useState, useEffect } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel } from "@/integrations/supabase/hooks/usePortal";
import { useCurrentPersonnelW9Form, useSubmitW9Form, W9FormInput } from "@/integrations/supabase/hooks/useW9Forms";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle, AlertCircle, Clock, XCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
];

export default function PortalTaxForms() {
  const { data: personnel, isLoading: personnelLoading } = useCurrentPersonnel();
  const { data: w9Form, isLoading: w9Loading } = useCurrentPersonnelW9Form(personnel?.id);
  const submitW9 = useSubmitW9Form();

  const [formData, setFormData] = useState({
    name_on_return: "",
    business_name: "",
    federal_tax_classification: "",
    llc_tax_classification: "",
    other_classification: "",
    has_foreign_partners: false,
    exempt_payee_code: "",
    fatca_exemption_code: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    account_numbers: "",
    tin_type: "ssn" as "ssn" | "ein",
    ein: "",
    certified_us_person: true,
    certified_correct_tin: true,
    certified_not_subject_backup_withholding: true,
    certified_fatca_exempt: false,
    signature_data: "",
  });

  const [isEditing, setIsEditing] = useState(false);

  // Check if Line 3b should be shown (Partnership, Trust/estate, or LLC with P classification)
  const showLine3b = 
    formData.federal_tax_classification === "partnership" ||
    formData.federal_tax_classification === "trust_estate" ||
    (formData.federal_tax_classification === "llc" && formData.llc_tax_classification?.toUpperCase() === "P");

  // Conditional field states based on tax classification
  const selectedClassification = formData.federal_tax_classification;

  // LLC dropdown visibility/enabled state
  const llcFieldState = {
    enabled: selectedClassification === "llc",
    required: selectedClassification === "llc"
  };

  // Other description field visibility/enabled state
  const otherFieldState = {
    enabled: selectedClassification === "other",
    required: selectedClassification === "other"
  };

  // TIN type requirements based on classification
  const tinRequirements = {
    einRequired: ["c_corporation", "s_corporation", "partnership"].includes(selectedClassification),
    ssnPreferred: selectedClassification === "individual",
    eitherAllowed: ["trust_estate", "llc", "other", ""].includes(selectedClassification)
  };

  // Handle classification change with dependent field clearing
  const handleClassificationChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      federal_tax_classification: value,
      // Clear LLC classification if not LLC
      llc_tax_classification: value === "llc" ? prev.llc_tax_classification : "",
      // Clear other classification if not Other
      other_classification: value === "other" ? prev.other_classification : "",
      // Clear business name if not LLC (only LLC allows both personal and business name)
      business_name: value === "llc" ? prev.business_name : "",
      // Reset foreign partners checkbox
      has_foreign_partners: false,
      // Auto-select TIN type for corporations/partnerships
      tin_type: ["c_corporation", "s_corporation", "partnership"].includes(value) ? "ein" : prev.tin_type
    }));
  };

  // Business name field state - only enabled for LLC
  const businessNameFieldState = {
    enabled: formData.federal_tax_classification === "llc",
    blocked: formData.federal_tax_classification !== "llc" && formData.federal_tax_classification !== ""
  };

  // Auto-select EIN for corporations/partnerships when classification changes
  useEffect(() => {
    if (["c_corporation", "s_corporation", "partnership"].includes(formData.federal_tax_classification)) {
      if (formData.tin_type !== "ein") {
        setFormData(prev => ({ ...prev, tin_type: "ein" }));
      }
    }
  }, [formData.federal_tax_classification]);

  // Pre-populate form when personnel data is loaded (for new W-9)
  useEffect(() => {
    if (personnel && !w9Form) {
      setFormData(prev => ({
        ...prev,
        name_on_return: `${personnel.first_name} ${personnel.last_name}`,
        address: personnel.address || "",
        city: personnel.city || "",
        state: personnel.state || "",
        zip: personnel.zip || "",
      }));
    }
  }, [personnel, w9Form]);

  // Pre-populate form when editing an existing W-9
  useEffect(() => {
    if (w9Form && isEditing) {
      setFormData({
        name_on_return: w9Form.name_on_return || "",
        business_name: w9Form.business_name || "",
        federal_tax_classification: w9Form.federal_tax_classification || "",
        llc_tax_classification: w9Form.llc_tax_classification || "",
        other_classification: w9Form.other_classification || "",
        has_foreign_partners: w9Form.has_foreign_partners ?? false,
        exempt_payee_code: w9Form.exempt_payee_code || "",
        fatca_exemption_code: w9Form.fatca_exemption_code || "",
        address: w9Form.address || "",
        city: w9Form.city || "",
        state: w9Form.state || "",
        zip: w9Form.zip || "",
        account_numbers: w9Form.account_numbers || "",
        tin_type: w9Form.tin_type || "ssn",
        ein: w9Form.ein || "",
        certified_us_person: w9Form.certified_us_person ?? true,
        certified_correct_tin: w9Form.certified_correct_tin ?? true,
        certified_not_subject_backup_withholding: w9Form.certified_not_subject_backup_withholding ?? true,
        certified_fatca_exempt: w9Form.certified_fatca_exempt ?? false,
        signature_data: "", // Clear signature to require re-signing
      });
    }
  }, [w9Form, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personnel?.id) return;

    const w9Data: W9FormInput = {
      personnel_id: personnel.id,
      name_on_return: formData.name_on_return,
      business_name: formData.business_name || null,
      federal_tax_classification: formData.federal_tax_classification,
      llc_tax_classification: formData.llc_tax_classification || null,
      other_classification: formData.other_classification || null,
      has_foreign_partners: showLine3b ? formData.has_foreign_partners : false,
      exempt_payee_code: formData.exempt_payee_code || null,
      fatca_exemption_code: formData.fatca_exemption_code || null,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      zip: formData.zip,
      account_numbers: formData.account_numbers || null,
      tin_type: formData.tin_type,
      ein: formData.tin_type === "ein" ? formData.ein : null,
      signature_data: formData.signature_data,
      signature_date: new Date().toISOString().split("T")[0],
      certified_us_person: formData.certified_us_person,
      certified_correct_tin: formData.certified_correct_tin,
      certified_not_subject_backup_withholding: formData.certified_not_subject_backup_withholding,
      certified_fatca_exempt: formData.certified_fatca_exempt,
    };

    await submitW9.mutateAsync(w9Data);
    setIsEditing(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Submitted - Pending Review</Badge>;
      case "verified":
        return <Badge className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Verified</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" /> Not Submitted</Badge>;
    }
  };

  if (personnelLoading || w9Loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PortalLayout>
    );
  }

  // Show completed W-9 view
  if (w9Form && !isEditing) {
    // Check if Line 3b applies for the saved form
    const savedShowLine3b = 
      w9Form.federal_tax_classification === "partnership" ||
      w9Form.federal_tax_classification === "trust_estate" ||
      (w9Form.federal_tax_classification === "llc" && w9Form.llc_tax_classification?.toUpperCase() === "P");

    return (
      <PortalLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Tax Forms</h1>
              <p className="text-muted-foreground">View and manage your tax documentation</p>
            </div>
            {getStatusBadge(w9Form.status)}
          </div>

          {w9Form.status === "rejected" && w9Form.rejection_reason && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>W-9 Rejected</AlertTitle>
              <AlertDescription>{w9Form.rejection_reason}</AlertDescription>
            </Alert>
          )}

          {/* IRS-Style Read-Only View */}
          <Card className="border-2 border-foreground/20 overflow-hidden">
            {/* Form Header */}
            <div className="border-b-2 border-foreground/20">
              <div className="flex">
                <div className="w-24 border-r-2 border-foreground/20 p-3 flex flex-col justify-center">
                  <span className="text-xs">Form</span>
                  <span className="text-2xl font-bold">W-9</span>
                  <span className="text-[10px] text-muted-foreground">(Rev. March 2024)</span>
                </div>
                <div className="flex-1 p-3">
                  <p className="text-xs text-muted-foreground">Department of the Treasury</p>
                  <p className="text-xs text-muted-foreground">Internal Revenue Service</p>
                  <p className="font-semibold mt-1">Request for Taxpayer Identification Number and Certification</p>
                </div>
              </div>
            </div>

            <CardContent className="p-0">
              {/* Line 1 - Name */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm">1</span>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Name of entity/individual</p>
                    <p className="font-medium">{w9Form.name_on_return}</p>
                  </div>
                </div>
              </div>

              {/* Line 2 - Business Name */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm">2</span>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Business name/disregarded entity name, if different from above</p>
                    <p className="font-medium">{w9Form.business_name || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Line 3a - Tax Classification */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm">3a</span>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-2">Federal tax classification</p>
                    <p className="font-medium capitalize">{w9Form.federal_tax_classification.replace(/_/g, " ")}</p>
                    {w9Form.llc_tax_classification && (
                      <p className="text-sm text-muted-foreground mt-1">LLC Classification: {w9Form.llc_tax_classification}</p>
                    )}
                    {w9Form.other_classification && (
                      <p className="text-sm text-muted-foreground mt-1">Other: {w9Form.other_classification}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Line 3b - Foreign Partners (conditional) */}
              {savedShowLine3b && (
                <div className="border-b border-foreground/20 p-3">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-sm">3b</span>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">Foreign partners, owners, or beneficiaries</p>
                      <p className="font-medium flex items-center gap-2">
                        {w9Form.has_foreign_partners ? (
                          <><CheckCircle className="h-4 w-4 text-amber-600" /> Yes - Has foreign partners/owners/beneficiaries</>
                        ) : (
                          <><XCircle className="h-4 w-4 text-muted-foreground" /> No</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Line 4 - Exemptions */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm">4</span>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Exemptions (codes apply only to certain entities, not individuals)</p>
                    <div className="flex gap-6">
                      <div>
                        <span className="text-xs text-muted-foreground">Exempt payee code: </span>
                        <span className="font-medium">{w9Form.exempt_payee_code || "—"}</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">FATCA exemption code: </span>
                        <span className="font-medium">{w9Form.fatca_exemption_code || "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Line 5 - Address */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm">5</span>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Address (number, street, and apt. or suite no.)</p>
                    <p className="font-medium">{w9Form.address}</p>
                  </div>
                </div>
              </div>

              {/* Line 6 - City, State, ZIP */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm">6</span>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">City, state, and ZIP code</p>
                    <p className="font-medium">{w9Form.city}, {w9Form.state} {w9Form.zip}</p>
                  </div>
                </div>
              </div>

              {/* Line 7 - Account Numbers */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm">7</span>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">List account number(s) here (optional)</p>
                    <p className="font-medium">{w9Form.account_numbers || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Part I - TIN */}
              <div className="bg-slate-800 text-white px-3 py-2">
                <span className="font-bold">Part I</span>
                <span className="ml-4">Taxpayer Identification Number (TIN)</span>
              </div>
              <div className="border-b border-foreground/20 p-3">
                <div className="flex gap-8">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">TIN Type</p>
                    <p className="font-medium uppercase">{w9Form.tin_type}</p>
                  </div>
                  {w9Form.tin_type === "ssn" && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Social Security Number</p>
                      <p className="font-medium font-mono">XXX-XX-{personnel?.ssn_last_four || "XXXX"}</p>
                    </div>
                  )}
                  {w9Form.tin_type === "ein" && w9Form.ein && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Employer Identification Number</p>
                      <p className="font-medium font-mono">{w9Form.ein}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Part II - Certification */}
              <div className="bg-slate-800 text-white px-3 py-2">
                <span className="font-bold">Part II</span>
                <span className="ml-4">Certification</span>
              </div>
              <div className="border-b border-foreground/20 p-3">
                <p className="text-sm mb-2">Under penalties of perjury, I certify that:</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>1. The number shown on this form is my correct taxpayer identification number</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>2. I am not subject to backup withholding</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>3. I am a U.S. citizen or other U.S. person</span>
                  </p>
                  <p className="flex items-start gap-2">
                    {w9Form.certified_fatca_exempt ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <span className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span>4. FATCA code(s) indicating I am exempt from FATCA reporting is correct</span>
                  </p>
                </div>
              </div>

              {/* Signature */}
              <div className="p-3">
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Signature of U.S. person</p>
                    {w9Form.signature_data?.startsWith("data:image") ? (
                      <img 
                        src={w9Form.signature_data} 
                        alt="Electronic Signature"
                        className="max-h-16 object-contain border-b border-foreground/40 pb-1"
                      />
                    ) : (
                      <p className="font-medium italic text-lg border-b border-foreground/40 pb-1">
                        {w9Form.signature_data || "—"}
                      </p>
                    )}
                  </div>
                  <div className="md:w-48">
                    <p className="text-xs text-muted-foreground mb-1">Date</p>
                    <p className="font-medium">{format(new Date(w9Form.signature_date), "MM/dd/yyyy")}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-4">
            {(() => {
              // Determine if editing is allowed
              const canEdit = 
                w9Form.status === "rejected" || // Rejected - can always edit
                w9Form.status === "pending" || // Not yet submitted - can edit
                (w9Form.edit_allowed && 
                 (!w9Form.edit_allowed_until || new Date(w9Form.edit_allowed_until) > new Date()));
              
              if (canEdit) {
                return (
                  <>
                    <Button onClick={() => setIsEditing(true)} variant="outline">
                      Edit W-9 Form
                    </Button>
                    {w9Form.status === "verified" && (
                      <p className="text-sm text-muted-foreground">
                        Note: Editing will require re-verification by an administrator.
                      </p>
                    )}
                  </>
                );
              } else {
                return (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Lock className="h-4 w-4" />
                    <span className="text-sm">Editing locked. Contact administrator to request changes.</span>
                  </div>
                );
              }
            })()}
          </div>
        </div>
      </PortalLayout>
    );
  }

  // Show W-9 form input - IRS Style (March 2024 Revision)
  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Tax Forms</h1>
          <p className="text-muted-foreground">Complete your tax documentation</p>
        </div>

        {!w9Form && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>W-9 Required</AlertTitle>
            <AlertDescription>
              Please complete your W-9 form below. This is required for tax reporting purposes.
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-2 border-foreground/20 overflow-hidden">
          {/* IRS Form Header */}
          <div className="border-b-2 border-foreground/20">
            <div className="flex flex-col sm:flex-row">
              <div className="sm:w-28 border-b-2 sm:border-b-0 sm:border-r-2 border-foreground/20 p-3 flex flex-col justify-center items-center sm:items-start">
                <span className="text-xs text-muted-foreground">Form</span>
                <span className="text-3xl font-bold tracking-tight">W-9</span>
                <span className="text-[10px] text-muted-foreground">(Rev. March 2024)</span>
              </div>
              <div className="flex-1 p-3">
                <p className="text-xs text-muted-foreground">Department of the Treasury</p>
                <p className="text-xs text-muted-foreground">Internal Revenue Service</p>
                <p className="font-semibold text-lg mt-1">Request for Taxpayer Identification Number and Certification</p>
                <p className="text-xs text-muted-foreground mt-1">▶ Go to www.irs.gov/FormW9 for instructions and the latest information.</p>
              </div>
            </div>
          </div>

          <CardContent className="p-0">
            <form onSubmit={handleSubmit}>
              {/* Before you begin instruction */}
              <div className="bg-muted/50 border-b border-foreground/20 p-3 text-sm">
                <span className="font-semibold">Before you begin.</span> For guidance related to the purpose of Form W-9, see Purpose of Form, below. <span className="font-semibold">Print or type.</span> See Specific Instructions on page 3.
              </div>

              {/* Line 1 - Name */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm w-4 flex-shrink-0">1</span>
                  <div className="flex-1">
                    <Label htmlFor="name_on_return" className="text-xs text-muted-foreground">
                      {formData.federal_tax_classification === "llc" 
                        ? "Name of LLC member/owner. An entry is required."
                        : formData.federal_tax_classification === "individual"
                          ? "Your name (as shown on your income tax return). An entry is required."
                          : ["c_corporation", "s_corporation", "partnership", "trust_estate", "other"].includes(formData.federal_tax_classification)
                            ? "Name of entity. An entry is required."
                            : <>Name of entity/individual. An entry is required. <span className="text-[10px]">(For a sole proprietor or disregarded entity, enter the owner's name on line 1, and enter the business/disregarded entity's name on line 2.)</span></>
                      }
                    </Label>
                    <Input
                      id="name_on_return"
                      value={formData.name_on_return}
                      onChange={(e) => setFormData({ ...formData, name_on_return: e.target.value })}
                      className="mt-1 border-foreground/30 bg-muted/30"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Line 2 - Business Name (Only available for LLC) */}
              <div className={cn(
                "border-b border-foreground/20 p-3 transition-all duration-300 relative",
                businessNameFieldState.blocked && "opacity-50 bg-muted/30"
              )}>
                {/* Blocked overlay indicator */}
                {businessNameFieldState.blocked && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-muted">
                      N/A
                    </Badge>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm w-4 flex-shrink-0">2</span>
                  <div className="flex-1">
                    <Label htmlFor="business_name" className={cn(
                      "text-xs transition-colors duration-300",
                      businessNameFieldState.blocked ? "text-muted-foreground" : "text-muted-foreground"
                    )}>
                      {formData.federal_tax_classification === "llc"
                        ? "Business name of LLC (required)"
                        : "Business name/disregarded entity name, if different from above"}
                    </Label>
                    <Input
                      id="business_name"
                      value={formData.business_name}
                      onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                      disabled={businessNameFieldState.blocked}
                      className={cn(
                        "mt-1 transition-all duration-300",
                        businessNameFieldState.blocked 
                          ? "border-muted bg-muted/50 cursor-not-allowed" 
                          : "border-foreground/30 bg-muted/30"
                      )}
                    />
                    {businessNameFieldState.blocked && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Business name only applicable for LLC classification
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Line 3a - Federal Tax Classification */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm w-4 flex-shrink-0">3a</span>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground block mb-2">
                      Check the appropriate box for federal tax classification of the entity/individual whose name is entered on line 1. Check only one of the following seven boxes.
                    </Label>
                    <RadioGroup
                      value={formData.federal_tax_classification}
                      onValueChange={handleClassificationChange}
                      className="space-y-2"
                    >
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="individual" id="individual" />
                          <Label htmlFor="individual" className="text-sm font-normal cursor-pointer">
                            Individual/sole proprietor
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="c_corporation" id="c_corporation" />
                          <Label htmlFor="c_corporation" className="text-sm font-normal cursor-pointer">C Corporation</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="s_corporation" id="s_corporation" />
                          <Label htmlFor="s_corporation" className="text-sm font-normal cursor-pointer">S Corporation</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="partnership" id="partnership" />
                          <Label htmlFor="partnership" className="text-sm font-normal cursor-pointer">Partnership</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="trust_estate" id="trust_estate" />
                          <Label htmlFor="trust_estate" className="text-sm font-normal cursor-pointer">Trust/estate</Label>
                        </div>
                      </div>
                      
                      {/* LLC Option with always-visible classification field */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="llc" id="llc" />
                          <Label htmlFor="llc" className="text-sm font-normal cursor-pointer">
                            LLC. Enter the tax classification (C=C corporation, S=S corporation, P=Partnership) ▶
                          </Label>
                        </div>
                      </div>

                      {/* LLC Classification - Always visible, conditionally enabled */}
                      <div className={cn(
                        "ml-6 flex items-center gap-2 p-2 border rounded-md transition-all duration-300",
                        llcFieldState.enabled 
                          ? "border-primary bg-primary/5" 
                          : "opacity-50 bg-muted/30 border-muted"
                      )}>
                        <Label className={cn(
                          "text-sm transition-colors duration-300",
                          !llcFieldState.enabled && "text-muted-foreground"
                        )}>
                          LLC Tax Classification:
                        </Label>
                        <select
                          value={formData.llc_tax_classification}
                          onChange={(e) => setFormData({ ...formData, llc_tax_classification: e.target.value, has_foreign_partners: false })}
                          disabled={!llcFieldState.enabled}
                          required={llcFieldState.required}
                          className={cn(
                            "h-8 px-2 rounded-md border text-sm transition-all duration-300",
                            llcFieldState.enabled 
                              ? "border-foreground/30 bg-background cursor-pointer" 
                              : "border-muted bg-muted/50 cursor-not-allowed text-muted-foreground"
                          )}
                        >
                          <option value="">Select C, S, or P</option>
                          <option value="C">C - C Corporation</option>
                          <option value="S">S - S Corporation</option>
                          <option value="P">P - Partnership</option>
                        </select>
                        {llcFieldState.required && !formData.llc_tax_classification && (
                          <span className="text-xs text-destructive">Required</span>
                        )}
                      </div>

                      {/* Other Option */}
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="other" id="other" />
                        <Label htmlFor="other" className="text-sm font-normal cursor-pointer">Other (see instructions) ▶</Label>
                      </div>

                      {/* Other Classification - Always visible, conditionally enabled */}
                      <div className={cn(
                        "ml-6 flex items-center gap-2 p-2 border rounded-md transition-all duration-300",
                        otherFieldState.enabled 
                          ? "border-primary bg-primary/5" 
                          : "opacity-50 bg-muted/30 border-muted"
                      )}>
                        <Label className={cn(
                          "text-sm transition-colors duration-300",
                          !otherFieldState.enabled && "text-muted-foreground"
                        )}>
                          Specify Entity Type:
                        </Label>
                        <Input
                          value={formData.other_classification}
                          onChange={(e) => setFormData({ ...formData, other_classification: e.target.value })}
                          disabled={!otherFieldState.enabled}
                          required={otherFieldState.required}
                          placeholder="Enter entity type description"
                          className={cn(
                            "w-48 h-8 transition-all duration-300",
                            otherFieldState.enabled 
                              ? "border-foreground/30" 
                              : "border-muted bg-muted/50 cursor-not-allowed"
                          )}
                        />
                        {otherFieldState.required && !formData.other_classification && (
                          <span className="text-xs text-destructive">Required</span>
                        )}
                      </div>
                    </RadioGroup>

                    <p className="text-xs text-muted-foreground mt-3">
                      <strong>Note:</strong> Check the "LLC" box above and, in the entry space, enter the appropriate code (C, S, or P) for the tax 
                      classification of the LLC, unless it is a disregarded entity. A disregarded entity should instead check the appropriate 
                      box for the tax classification of its owner.
                    </p>
                  </div>
                </div>
              </div>

              {/* Line 3b - Foreign Partners (conditional) */}
              {showLine3b && (
                <div className="border-b border-foreground/20 p-3 bg-amber-50/50 dark:bg-amber-950/20">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-sm w-4 flex-shrink-0">3b</span>
                    <div className="flex-1">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="has_foreign_partners"
                          checked={formData.has_foreign_partners}
                          onCheckedChange={(checked) => 
                            setFormData({ ...formData, has_foreign_partners: checked as boolean })
                          }
                        />
                        <Label htmlFor="has_foreign_partners" className="text-sm leading-relaxed cursor-pointer">
                          If on line 3a you checked "Partnership" or "Trust/estate," or checked "LLC" and entered "P" as its tax classification, 
                          and you are providing this form to a partnership, trust, or estate in which you have an ownership interest, check this box 
                          if you have any <strong>foreign partners, owners, or beneficiaries</strong>. See instructions.
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Line 4 - Exemptions */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm w-4 flex-shrink-0">4</span>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground block mb-2">
                      Exemptions (codes apply only to certain entities, not individuals; see instructions on page 3):
                    </Label>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Exempt payee code (if any)</span>
                        <Input
                          value={formData.exempt_payee_code}
                          onChange={(e) => setFormData({ ...formData, exempt_payee_code: e.target.value })}
                          className="w-16 h-7 text-center border-foreground/30 font-mono"
                          maxLength={2}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Exemption from FATCA reporting code (if any)</span>
                        <Input
                          value={formData.fatca_exemption_code}
                          onChange={(e) => setFormData({ ...formData, fatca_exemption_code: e.target.value })}
                          className="w-16 h-7 text-center border-foreground/30 font-mono"
                          maxLength={2}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      (Applies to accounts maintained outside the U.S.)
                    </p>
                  </div>
                </div>
              </div>

              {/* Line 5 - Address */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm w-4 flex-shrink-0">5</span>
                  <div className="flex-1">
                    <Label htmlFor="address" className="text-xs text-muted-foreground">
                      Address (number, street, and apt. or suite no.). See instructions.
                    </Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="mt-1 border-foreground/30 bg-muted/30"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Line 6 - City, State, ZIP */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm w-4 flex-shrink-0">6</span>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground block mb-1">City, state, and ZIP code</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Input
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="City"
                        className="border-foreground/30 bg-muted/30"
                        required
                      />
                      <select
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-foreground/30 bg-muted/30 px-3 py-2 text-sm"
                        required
                      >
                        <option value="">State</option>
                        {US_STATES.map((state) => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                      <Input
                        value={formData.zip}
                        onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                        placeholder="ZIP code"
                        className="border-foreground/30 bg-muted/30"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Line 7 - Account Numbers */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm w-4 flex-shrink-0">7</span>
                  <div className="flex-1">
                    <Label htmlFor="account_numbers" className="text-xs text-muted-foreground">
                      List account number(s) here (optional)
                    </Label>
                    <Input
                      id="account_numbers"
                      value={formData.account_numbers}
                      onChange={(e) => setFormData({ ...formData, account_numbers: e.target.value })}
                      className="mt-1 border-foreground/30 bg-muted/30"
                    />
                  </div>
                </div>
              </div>

              {/* Part I - TIN */}
              <div className="bg-slate-800 text-white px-3 py-2 flex items-center gap-4">
                <span className="font-bold">Part I</span>
                <span>Taxpayer Identification Number (TIN)</span>
              </div>
              <div className="border-b border-foreground/20 p-4">
                <p className="text-sm mb-4">
                  Enter your TIN in the appropriate box. The TIN provided must match the name given on line 1 to avoid 
                  backup withholding. For individuals, this is generally your social security number (SSN). However, for a 
                  resident alien, sole proprietor, or disregarded entity, see the instructions for Part I, later. For other 
                  entities, it is your employer identification number (EIN). If you do not have a number, see How to get a 
                  TIN, later.
                </p>

                {/* TIN Requirement Notice */}
                {tinRequirements.einRequired && (
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md transition-all duration-300">
                    <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span><strong>Note:</strong> Corporations and partnerships must use an Employer Identification Number (EIN).</span>
                    </p>
                  </div>
                )}

                {tinRequirements.ssnPreferred && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md transition-all duration-300">
                    <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span><strong>Tip:</strong> Individuals/sole proprietors typically use their Social Security Number (SSN), but may also use an EIN if they have one.</span>
                    </p>
                  </div>
                )}

                <div className="flex flex-col md:flex-row gap-6">
                  {/* SSN Section */}
                  <div className={cn(
                    "flex-1 border rounded-md p-4 transition-all duration-300 relative",
                    tinRequirements.ssnPreferred && "border-primary ring-2 ring-primary/20 bg-primary/5",
                    tinRequirements.einRequired && "opacity-50 bg-muted/30 border-muted cursor-not-allowed",
                    !tinRequirements.ssnPreferred && !tinRequirements.einRequired && "border-foreground/20"
                  )}>
                    {/* Blocked overlay indicator */}
                    {tinRequirements.einRequired && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-muted">
                          N/A
                        </Badge>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="radio"
                        id="tin_ssn"
                        name="tin_type"
                        checked={formData.tin_type === "ssn"}
                        onChange={() => setFormData({ ...formData, tin_type: "ssn" })}
                        disabled={tinRequirements.einRequired}
                        className={cn("h-4 w-4", tinRequirements.einRequired && "cursor-not-allowed")}
                      />
                      <Label htmlFor="tin_ssn" className={cn(
                        "font-semibold transition-colors duration-300",
                        tinRequirements.einRequired ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"
                      )}>
                        Social security number
                      </Label>
                      {tinRequirements.ssnPreferred && (
                        <Badge variant="secondary" className="text-xs">Recommended</Badge>
                      )}
                    </div>
                    <div className={cn(
                      "flex items-center gap-1 font-mono text-lg transition-opacity duration-300",
                      tinRequirements.einRequired && "opacity-30 pointer-events-none"
                    )}>
                      <div className="w-10 h-8 border border-foreground/40 rounded flex items-center justify-center bg-muted/50">
                        X
                      </div>
                      <div className="w-10 h-8 border border-foreground/40 rounded flex items-center justify-center bg-muted/50">
                        X
                      </div>
                      <div className="w-10 h-8 border border-foreground/40 rounded flex items-center justify-center bg-muted/50">
                        X
                      </div>
                      <span className="mx-1">-</span>
                      <div className="w-10 h-8 border border-foreground/40 rounded flex items-center justify-center bg-muted/50">
                        X
                      </div>
                      <div className="w-10 h-8 border border-foreground/40 rounded flex items-center justify-center bg-muted/50">
                        X
                      </div>
                      <span className="mx-1">-</span>
                      <div className="w-10 h-8 border border-foreground/40 rounded flex items-center justify-center bg-muted/50">
                        {personnel?.ssn_last_four?.[0] || "X"}
                      </div>
                      <div className="w-10 h-8 border border-foreground/40 rounded flex items-center justify-center bg-muted/50">
                        {personnel?.ssn_last_four?.[1] || "X"}
                      </div>
                      <div className="w-10 h-8 border border-foreground/40 rounded flex items-center justify-center bg-muted/50">
                        {personnel?.ssn_last_four?.[2] || "X"}
                      </div>
                      <div className="w-10 h-8 border border-foreground/40 rounded flex items-center justify-center bg-muted/50">
                        {personnel?.ssn_last_four?.[3] || "X"}
                      </div>
                    </div>
                    <p className={cn(
                      "text-xs mt-2",
                      tinRequirements.einRequired ? "text-muted-foreground" : "text-muted-foreground"
                    )}>
                      {tinRequirements.einRequired 
                        ? "SSN not applicable for this classification"
                        : formData.tin_type === "ssn" 
                          ? "Your SSN on file will be used. Contact your administrator to update."
                          : "Select if using your Social Security Number"}
                    </p>
                  </div>

                  <div className="text-center self-center font-bold text-muted-foreground">
                    or
                  </div>

                  {/* EIN Section */}
                  <div className={cn(
                    "flex-1 border rounded-md p-4 transition-all duration-300",
                    tinRequirements.einRequired && "border-primary ring-2 ring-primary/20 bg-primary/5",
                    !tinRequirements.einRequired && "border-foreground/20"
                  )}>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="radio"
                        id="tin_ein"
                        name="tin_type"
                        checked={formData.tin_type === "ein"}
                        onChange={() => setFormData({ ...formData, tin_type: "ein" })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="tin_ein" className="font-semibold cursor-pointer">
                        Employer identification number
                      </Label>
                      {tinRequirements.einRequired && (
                        <Badge variant="secondary" className="text-xs">Required</Badge>
                      )}
                    </div>
                    {formData.tin_type === "ein" ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={formData.ein.slice(0, 2)}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                            const rest = formData.ein.slice(2);
                            setFormData({ ...formData, ein: val + rest });
                          }}
                          className="w-14 h-8 text-center font-mono border-foreground/40"
                          maxLength={2}
                          placeholder="XX"
                          required={tinRequirements.einRequired}
                        />
                        <span className="font-mono">-</span>
                        <Input
                          value={formData.ein.slice(2)}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 7);
                            const prefix = formData.ein.slice(0, 2);
                            setFormData({ ...formData, ein: prefix + val });
                          }}
                          className="w-28 h-8 text-center font-mono border-foreground/40"
                          maxLength={7}
                          placeholder="XXXXXXX"
                          required={tinRequirements.einRequired}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 font-mono text-lg text-muted-foreground">
                        <div className="w-10 h-8 border border-foreground/20 rounded flex items-center justify-center bg-muted/30">
                          
                        </div>
                        <div className="w-10 h-8 border border-foreground/20 rounded flex items-center justify-center bg-muted/30">
                          
                        </div>
                        <span className="mx-1">-</span>
                        <div className="w-10 h-8 border border-foreground/20 rounded flex items-center justify-center bg-muted/30">
                          
                        </div>
                        <div className="w-10 h-8 border border-foreground/20 rounded flex items-center justify-center bg-muted/30">
                          
                        </div>
                        <div className="w-10 h-8 border border-foreground/20 rounded flex items-center justify-center bg-muted/30">
                          
                        </div>
                        <div className="w-10 h-8 border border-foreground/20 rounded flex items-center justify-center bg-muted/30">
                          
                        </div>
                        <div className="w-10 h-8 border border-foreground/20 rounded flex items-center justify-center bg-muted/30">
                          
                        </div>
                        <div className="w-10 h-8 border border-foreground/20 rounded flex items-center justify-center bg-muted/30">
                          
                        </div>
                        <div className="w-10 h-8 border border-foreground/20 rounded flex items-center justify-center bg-muted/30">
                          
                        </div>
                      </div>
                    )}
                    {tinRequirements.einRequired && formData.tin_type === "ein" && formData.ein.length < 9 && (
                      <p className="text-xs text-destructive mt-2">
                        EIN is required for this entity type. Please enter a valid 9-digit EIN.
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-4">
                  <strong>Note:</strong> If the account is in more than one name, see the instructions for line 1. Also see What Name and 
                  Number To Give the Requester for guidelines on whose number to enter.
                </p>
              </div>

              {/* Part II - Certification */}
              <div className="bg-slate-800 text-white px-3 py-2 flex items-center gap-4">
                <span className="font-bold">Part II</span>
                <span>Certification</span>
              </div>
              <div className="border-b border-foreground/20 p-4">
                <p className="font-semibold mb-3">Under penalties of perjury, I certify that:</p>
                
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="certified_correct_tin"
                      checked={formData.certified_correct_tin}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, certified_correct_tin: checked as boolean })
                      }
                    />
                    <Label htmlFor="certified_correct_tin" className="text-sm leading-relaxed cursor-pointer">
                      <strong>1.</strong> The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and
                    </Label>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="certified_not_subject_backup_withholding"
                      checked={formData.certified_not_subject_backup_withholding}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, certified_not_subject_backup_withholding: checked as boolean })
                      }
                    />
                    <Label htmlFor="certified_not_subject_backup_withholding" className="text-sm leading-relaxed cursor-pointer">
                      <strong>2.</strong> I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the Internal Revenue Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no longer subject to backup withholding; and
                    </Label>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="certified_us_person"
                      checked={formData.certified_us_person}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, certified_us_person: checked as boolean })
                      }
                    />
                    <Label htmlFor="certified_us_person" className="text-sm leading-relaxed cursor-pointer">
                      <strong>3.</strong> I am a U.S. citizen or other U.S. person (defined below); and
                    </Label>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="certified_fatca_exempt"
                      checked={formData.certified_fatca_exempt}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, certified_fatca_exempt: checked as boolean })
                      }
                    />
                    <Label htmlFor="certified_fatca_exempt" className="text-sm leading-relaxed cursor-pointer">
                      <strong>4.</strong> The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.
                    </Label>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-muted/50 rounded-md border border-foreground/20">
                  <p className="text-sm">
                    <strong>Certification instructions.</strong> You must cross out item 2 above if you have been notified by the IRS that you are currently subject to backup withholding because you have failed to report all interest and dividends on your tax return. For real estate transactions, item 2 does not apply. For mortgage interest paid, acquisition or abandonment of secured property, cancellation of debt, contributions to an individual retirement arrangement (IRA), and generally, payments other than interest and dividends, you are not required to sign the certification, but you must provide your correct TIN. See the instructions for Part II, later.
                  </p>
                </div>
              </div>

              {/* Sign Here */}
              <div className="bg-slate-800 text-white px-3 py-1 text-sm">
                <span className="font-bold">Sign Here</span>
              </div>
              <div className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-1 block">Signature of U.S. person ▶</Label>
                    <Input
                      value={formData.signature_data}
                      onChange={(e) => setFormData({ ...formData, signature_data: e.target.value })}
                      className="border-foreground/40 bg-muted/30 italic font-serif text-lg h-12"
                      placeholder="Type your full legal name to sign"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      By typing your name above, you are electronically signing this W-9 form.
                    </p>
                  </div>
                  <div className="md:w-48">
                    <Label className="text-xs text-muted-foreground mb-1 block">Date ▶</Label>
                    <Input
                      value={format(new Date(), "MM/dd/yyyy")}
                      readOnly
                      className="border-foreground/40 bg-muted/50 h-12"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Submit Buttons */}
              <div className="p-4 flex gap-3">
                <Button
                  type="submit"
                  disabled={
                    submitW9.isPending || 
                    !formData.signature_data || 
                    !formData.federal_tax_classification ||
                    // LLC requires classification selection
                    (formData.federal_tax_classification === "llc" && !formData.llc_tax_classification) ||
                    // Other requires description
                    (formData.federal_tax_classification === "other" && !formData.other_classification) ||
                    // Corporations/partnerships require valid EIN
                    (["c_corporation", "s_corporation", "partnership"].includes(formData.federal_tax_classification) && 
                      (formData.tin_type !== "ein" || formData.ein.length < 9))
                  }
                  className="min-w-32"
                >
                  {submitW9.isPending ? "Submitting..." : "Submit W-9 Form"}
                </Button>
                {isEditing && (
                  <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

```

### `src/pages/portal/PortalTimeClock.tsx`

```tsx
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel } from "@/integrations/supabase/hooks/usePortal";
import { useClockEnabledProjects, useAllOpenClockEntries } from "@/integrations/supabase/hooks/useTimeClock";
import { ClockStatusCard } from "@/components/portal/ClockStatusCard";
import { ClockHistoryTable } from "@/components/portal/ClockHistoryTable";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortalTimeClock() {
  const { data: personnel, isLoading: personnelLoading } = useCurrentPersonnel();
  const { data: projects, isLoading: projectsLoading } = useClockEnabledProjects(personnel?.id);
  const { data: openEntries, isLoading: entriesLoading } = useAllOpenClockEntries(personnel?.id);

  const isLoading = personnelLoading || projectsLoading || entriesLoading;

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      </PortalLayout>
    );
  }

  // Get the active entry (first open entry)
  const activeEntry = openEntries?.[0] || null;

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Time Clock</h1>
          <p className="text-muted-foreground">
            Clock in and out of your assigned projects
          </p>
        </div>

        {/* Main Clock Status Card */}
        <ClockStatusCard
          personnelId={personnel?.id || ""}
          projects={projects || []}
          activeEntry={activeEntry}
        />

        {/* Clock History */}
        <ClockHistoryTable personnelId={personnel?.id || ""} />
      </div>
    </PortalLayout>
  );
}

```

## Personnel Portal — Components

### `src/components/portal/ClockHistoryTable.tsx`

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { History, Clock } from "lucide-react";
import { useClockHistory, formatTime24h, formatDuration, formatHoursDetailed } from "@/integrations/supabase/hooks/useTimeClock";
import { Skeleton } from "@/components/ui/skeleton";

interface ClockHistoryTableProps {
  personnelId: string;
}

export function ClockHistoryTable({ personnelId }: ClockHistoryTableProps) {
  const { data: history, isLoading } = useClockHistory(personnelId, 14);

  const formatDate = (dateString: string) => {
    // Handle date-only strings (YYYY-MM-DD) to avoid timezone shifts
    const date = dateString.includes('T') 
      ? new Date(dateString)
      : new Date(dateString + 'T12:00:00'); // Parse as noon local time
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatHours = (hours: number | null) => {
    if (hours === null || hours === undefined) return "-";
    return formatHoursDetailed(hours);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            Recent Clock History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const completedEntries = history?.filter((entry) => entry.clock_out_at) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          Recent Clock History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {completedEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No clock history yet</p>
            <p className="text-sm">Your completed shifts will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-center">Clock In</TableHead>
                  <TableHead className="text-center">Lunch</TableHead>
                  <TableHead className="text-center">Clock Out</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {formatDate(entry.entry_date)}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {entry.project?.name || "Unknown"}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {formatTime24h(entry.clock_in_at)}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {entry.lunch_duration_minutes && entry.lunch_duration_minutes > 0
                        ? formatDuration(entry.lunch_duration_minutes)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {entry.clock_out_at ? formatTime24h(entry.clock_out_at) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatHours(entry.hours)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

```

### `src/components/portal/ClockInModal.tsx`

```tsx
import { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MapPin, Clock, Loader2, AlertTriangle, Navigation, Ban } from "lucide-react";
import { useClockIn } from "@/integrations/supabase/hooks/useTimeClock";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useProjectGeofence } from "@/integrations/supabase/hooks/useProjectGeofence";
import { useScheduleValidation } from "@/hooks/useScheduleValidation";
import { LocationPermissionDialog } from "./LocationPermissionDialog";
import { toast } from "sonner";
import { isWithinGeofence, formatDistance, isValidCoordinates } from "@/utils/geoDistance";

interface Project {
  id: string;
  name: string;
  time_clock_enabled: boolean;
  require_clock_location: boolean;
}

interface ClockInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  personnelId: string;
}

interface LateBlockInfo {
  minutesLate: number;
  scheduledTime: string;
}

export function ClockInModal({
  open,
  onOpenChange,
  projects,
  personnelId,
}: ClockInModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isClocking, setIsClocking] = useState(false);
  const [showLocationHelp, setShowLocationHelp] = useState(false);
  const [geofenceError, setGeofenceError] = useState<string | null>(null);
  const [distanceFromSite, setDistanceFromSite] = useState<number | null>(null);
  const [lateBlockInfo, setLateBlockInfo] = useState<LateBlockInfo | null>(null);

  const clockIn = useClockIn();
  const { requestLocation, permissionState, geoData } = useGeolocation(false);
  const { data: projectGeofence, isLoading: loadingGeofence } = useProjectGeofence(selectedProjectId);
  const { data: scheduleValidation } = useScheduleValidation(personnelId, selectedProjectId);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const requiresLocation = selectedProject?.require_clock_location ?? false;
  const isLocationDenied = permissionState === "denied";

  // Check if project has valid geofence coordinates
  const hasGeofenceCoordinates = useMemo(() => {
    if (!projectGeofence) return false;
    return isValidCoordinates(projectGeofence.site_lat, projectGeofence.site_lng);
  }, [projectGeofence]);

  // Format scheduled time for display (convert "HH:MM:SS" to "h:mm AM/PM")
  const formatScheduledTime = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleClockIn = useCallback(async () => {
    if (!selectedProjectId) {
      toast.error("Please select a project");
      return;
    }

    setGeofenceError(null);
    setDistanceFromSite(null);
    setLateBlockInfo(null);

    // Check if location is required but denied
    if (requiresLocation && isLocationDenied) {
      setShowLocationHelp(true);
      return;
    }

    setIsClocking(true);

    try {
      let geoData = {
        lat: null as number | null,
        lng: null as number | null,
        accuracy: null as number | null,
        source: null as "device" | "ip_fallback" | null,
        capturedAt: null as string | null,
        error: null as string | null,
      };

      if (requiresLocation) {
        const locationResult = await requestLocation();
        if (locationResult.error || !locationResult.lat) {
          if (locationResult.error?.includes("denied")) {
            setShowLocationHelp(true);
            setIsClocking(false);
            return;
          }
          toast.error("Could not get location: " + locationResult.error);
          setIsClocking(false);
          return;
        }
        geoData = locationResult;

        // Check geofence if project has coordinates
        if (hasGeofenceCoordinates && projectGeofence) {
          const radiusMiles = projectGeofence.geofence_radius_miles || 0.25;
          const withinGeofence = isWithinGeofence(
            geoData.lat!,
            geoData.lng!,
            projectGeofence.site_lat!,
            projectGeofence.site_lng!,
            radiusMiles
          );

          if (!withinGeofence) {
            // Calculate and show distance
            const { calculateDistanceMiles } = await import("@/utils/geoDistance");
            const distance = calculateDistanceMiles(
              geoData.lat!,
              geoData.lng!,
              projectGeofence.site_lat!,
              projectGeofence.site_lng!
            );
            setDistanceFromSite(distance);
            setGeofenceError(
              `You must be within ${formatDistance(radiusMiles)} of the job site to clock in. You are currently ${formatDistance(distance)} away.`
            );
            setIsClocking(false);
            return;
          }
        }
      }

      await clockIn.mutateAsync({
        projectId: selectedProjectId,
        personnelId,
        geoData,
      });

      onOpenChange(false);
      setSelectedProjectId("");
      setGeofenceError(null);
      setDistanceFromSite(null);
      setLateBlockInfo(null);
    } catch (error) {
      // Handle late clock-in block error
      if (error instanceof Error && error.message.startsWith("LATE_CLOCK_IN_BLOCKED:")) {
        const parts = error.message.split(":");
        const minutesLate = parseInt(parts[1], 10);
        const scheduledTime = parts[2];
        setLateBlockInfo({ minutesLate, scheduledTime });
      }
      // Other errors handled by mutation
    } finally {
      setIsClocking(false);
    }
  }, [selectedProjectId, personnelId, requiresLocation, isLocationDenied, requestLocation, clockIn, onOpenChange, hasGeofenceCoordinates, projectGeofence]);

  // Reset state when modal closes
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSelectedProjectId("");
      setGeofenceError(null);
      setDistanceFromSite(null);
      setLateBlockInfo(null);
    }
    onOpenChange(open);
  }, [onOpenChange]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Clock In
            </DialogTitle>
            <DialogDescription>
              Select the project you're working on today
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {projects.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No clock-enabled projects available
              </p>
            ) : (
              <RadioGroup
                value={selectedProjectId}
                onValueChange={(value) => {
                  setSelectedProjectId(value);
                  setGeofenceError(null);
                  setDistanceFromSite(null);
                }}
                className="space-y-3"
              >
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className={`flex items-center space-x-3 rounded-lg border p-4 transition-colors ${
                      selectedProjectId === project.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value={project.id} id={project.id} />
                    <Label
                      htmlFor={project.id}
                      className="flex-1 cursor-pointer flex items-center justify-between"
                    >
                      <span className="font-medium">{project.name}</span>
                      {project.require_clock_location && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          Location Required
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {/* Geofence warning when project requires location but has no coordinates */}
            {selectedProjectId && requiresLocation && !loadingGeofence && !hasGeofenceCoordinates && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <Navigation className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700">
                  This project requires location but has no job site coordinates configured. 
                  Location will be captured but geofence verification is disabled.
                </AlertDescription>
              </Alert>
            )}

            {/* Geofence error when user is outside the radius */}
            {geofenceError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{geofenceError}</AlertDescription>
              </Alert>
            )}

            {/* Late clock-in block error */}
            {lateBlockInfo && (
              <Alert variant="destructive" className="border-destructive">
                <Ban className="h-4 w-4" />
                <AlertTitle>Clock-In Blocked</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    You are <strong>{lateBlockInfo.minutesLate} minutes late</strong> for your 
                    scheduled start time of <strong>{formatScheduledTime(lateBlockInfo.scheduledTime)}</strong>.
                  </p>
                  <p className="text-sm">
                    Clock-ins are only allowed within 10 minutes of your scheduled start time. 
                    Your supervisor has been notified. Please contact them for assistance.
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isClocking}
            >
              Cancel
            </Button>
            <Button
              onClick={handleClockIn}
              disabled={!selectedProjectId || isClocking || projects.length === 0 || loadingGeofence}
            >
              {isClocking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {requiresLocation ? "Verifying Location..." : "Clocking In..."}
                </>
              ) : (
                "Start Working"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LocationPermissionDialog
        open={showLocationHelp}
        onOpenChange={setShowLocationHelp}
      />
    </>
  );
}

```

### `src/components/portal/ClockStatusCard.tsx`

```tsx
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Coffee,
  LogOut,
  Play,
  Loader2,
  MapPin,
  AlertTriangle,
} from "lucide-react";
import {
  ClockEntry,
  useClockOut,
  useStartLunch,
  useEndLunch,
  formatTime24h,
  formatDuration,
} from "@/integrations/supabase/hooks/useTimeClock";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useLocationMonitor } from "@/hooks/useLocationMonitor";
import { useProjectGeofence } from "@/integrations/supabase/hooks/useProjectGeofence";
import { LocationPermissionDialog } from "./LocationPermissionDialog";
import { ClockInModal } from "./ClockInModal";
import { TrackingStatusIndicator } from "@/components/location/TrackingStatusIndicator";

interface Project {
  id: string;
  name: string;
  time_clock_enabled: boolean;
  require_clock_location: boolean;
}

interface ClockStatusCardProps {
  personnelId: string;
  projects: Project[];
  activeEntry: ClockEntry | null;
}

export function ClockStatusCard({
  personnelId,
  projects,
  activeEntry,
}: ClockStatusCardProps) {
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [showLocationHelp, setShowLocationHelp] = useState(false);
  const [isActioning, setIsActioning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [lunchElapsed, setLunchElapsed] = useState(0);

  const clockOut = useClockOut();
  const startLunch = useStartLunch();
  const endLunch = useEndLunch();
  const { requestLocation, permissionState } = useGeolocation(false);

  // Get project geofence data for location monitoring
  const { data: projectGeofence } = useProjectGeofence(activeEntry?.project_id);

  // Location monitoring hook - tracks location while clocked in
  const { isMonitoring, isNative, isNativeTracking, lastLocation } =
    useLocationMonitor(
      activeEntry
        ? {
            id: activeEntry.id,
            project_id: activeEntry.project_id,
            is_on_lunch: activeEntry.is_on_lunch ?? false,
            clock_blocked_until:
              (activeEntry as any).clock_blocked_until ?? null,
          }
        : null,
      projectGeofence
        ? {
            require_clock_location: projectGeofence.require_clock_location,
            site_lat: projectGeofence.site_lat,
            site_lng: projectGeofence.site_lng,
            geofence_radius_miles: projectGeofence.geofence_radius_miles,
          }
        : null
    );

  const isClockedIn = !!activeEntry;
  const isOnLunch = activeEntry?.is_on_lunch ?? false;
  const activeProject = activeEntry?.project;
  const requiresLocation = activeProject?.require_clock_location ?? false;
  const isLocationDenied = permissionState === "denied";
  const hasAlreadyTakenLunch =
    (activeEntry?.lunch_duration_minutes || 0) > 0 ||
    !!activeEntry?.lunch_end_at;

  // Check if clock-in is blocked (auto-clocked-out user)
  const clockBlockedUntil = (activeEntry as any)?.clock_blocked_until;
  const isBlocked =
    clockBlockedUntil && new Date(clockBlockedUntil) > new Date();

  // Update elapsed time every second
  useEffect(() => {
    if (!activeEntry?.clock_in_at) {
      setElapsedTime(0);
      return;
    }

    const updateElapsed = () => {
      const clockIn = new Date(activeEntry.clock_in_at);
      const now = new Date();
      const totalSeconds = Math.floor(
        (now.getTime() - clockIn.getTime()) / 1000
      );
      // Subtract lunch duration if applicable
      const lunchSeconds = (activeEntry.lunch_duration_minutes || 0) * 60;
      setElapsedTime(Math.max(0, totalSeconds - lunchSeconds));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeEntry?.clock_in_at, activeEntry?.lunch_duration_minutes]);

  // Update lunch elapsed time
  useEffect(() => {
    if (!activeEntry?.lunch_start_at || !activeEntry.is_on_lunch) {
      setLunchElapsed(0);
      return;
    }

    const updateLunchElapsed = () => {
      const lunchStart = new Date(activeEntry.lunch_start_at!);
      const now = new Date();
      const seconds = Math.floor((now.getTime() - lunchStart.getTime()) / 1000);
      setLunchElapsed(seconds);
    };

    updateLunchElapsed();
    const interval = setInterval(updateLunchElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeEntry?.lunch_start_at, activeEntry?.is_on_lunch]);

  const handleStartLunch = useCallback(async () => {
    if (!activeEntry) return;

    setIsActioning(true);
    try {
      await startLunch.mutateAsync({
        entryId: activeEntry.id,
        personnelId,
        projectId: activeEntry.project_id,
      });
    } finally {
      setIsActioning(false);
    }
  }, [activeEntry, personnelId, startLunch]);

  const handleEndLunch = useCallback(async () => {
    if (!activeEntry || !activeEntry.lunch_start_at) return;

    setIsActioning(true);
    try {
      await endLunch.mutateAsync({
        entryId: activeEntry.id,
        personnelId,
        projectId: activeEntry.project_id,
        lunchStartAt: activeEntry.lunch_start_at,
      });
    } finally {
      setIsActioning(false);
    }
  }, [activeEntry, personnelId, endLunch]);

  const handleClockOut = useCallback(async () => {
    if (!activeEntry) return;

    // Check location if required
    if (requiresLocation && isLocationDenied) {
      setShowLocationHelp(true);
      return;
    }

    setIsActioning(true);
    try {
      let geoData = {
        lat: null as number | null,
        lng: null as number | null,
        accuracy: null as number | null,
        source: null as "device" | "ip_fallback" | null,
        capturedAt: null as string | null,
        error: null as string | null,
      };

      if (requiresLocation) {
        const locationResult = await requestLocation();
        if (locationResult.error || !locationResult.lat) {
          if (locationResult.error?.includes("denied")) {
            setShowLocationHelp(true);
            setIsActioning(false);
            return;
          }
        }
        geoData = locationResult;
      }

      await clockOut.mutateAsync({
        entryId: activeEntry.id,
        personnelId,
        projectId: activeEntry.project_id,
        clockInAt: activeEntry.clock_in_at,
        lunchDurationMinutes: activeEntry.lunch_duration_minutes || 0,
        geoData,
      });
    } finally {
      setIsActioning(false);
    }
  }, [
    activeEntry,
    personnelId,
    requiresLocation,
    isLocationDenied,
    requestLocation,
    clockOut,
  ]);

  const formatElapsedTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Empty state - no clock-enabled projects assigned
  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Time Clock
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-2">
              No clock-enabled projects assigned
            </p>
            <p className="text-sm text-muted-foreground">
              Contact your supervisor to get assigned to a project.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card
        className={`${
          isClockedIn
            ? isOnLunch
              ? "border-amber-500/50 bg-amber-500/5"
              : "border-green-500/50 bg-green-500/5"
            : ""
        }`}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Time Clock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isClockedIn ? (
            // Not clocked in state
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                You're not clocked in
              </p>
              <Button
                size="lg"
                onClick={() => setShowClockInModal(true)}
                className="min-w-[150px]"
              >
                <Play className="mr-2 h-4 w-4" />
                Clock In
              </Button>
            </div>
          ) : isOnLunch ? (
            // On lunch break state
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <span className="font-medium text-amber-600">
                  On Lunch Break
                </span>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Project</span>
                  <span className="font-medium">{activeProject?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lunch started</span>
                  <span className="font-medium">
                    {activeEntry.lunch_start_at
                      ? formatTime24h(activeEntry.lunch_start_at)
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">
                    Lunch duration
                  </span>
                  <span className="font-mono text-lg font-bold text-amber-600">
                    {formatElapsedTime(lunchElapsed)}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleEndLunch}
                disabled={isActioning}
                className="w-full"
                variant="default"
              >
                {isActioning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resuming...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Resume Working
                  </>
                )}
              </Button>
            </div>
          ) : (
            // Clocked in and working state
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="font-medium text-green-600">
                  Currently Working
                </span>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Project</span>
                  <span className="font-medium">{activeProject?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Clocked in at</span>
                  <span className="font-medium">
                    {formatTime24h(activeEntry.clock_in_at)}
                  </span>
                </div>
                {(activeEntry.lunch_duration_minutes || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lunch taken</span>
                    <span className="font-medium">
                      {formatDuration(activeEntry.lunch_duration_minutes || 0)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">
                    Time worked
                  </span>
                  <span className="font-mono text-2xl font-bold text-green-600">
                    {formatElapsedTime(elapsedTime)}
                  </span>
                </div>
              </div>

              {requiresLocation && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Location captured at clock in/out
                  </div>
                  <TrackingStatusIndicator
                    isTracking={isMonitoring}
                    isNative={isNative}
                    isNativeTracking={isNativeTracking}
                    lastLocation={lastLocation}
                  />
                </div>
              )}

              <div className="flex gap-2">
                {!hasAlreadyTakenLunch && (
                  <Button
                    onClick={handleStartLunch}
                    disabled={isActioning}
                    variant="outline"
                    className="flex-1"
                  >
                    {isActioning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Coffee className="mr-2 h-4 w-4" />
                        Lunch
                      </>
                    )}
                  </Button>
                )}
                <Button
                  onClick={handleClockOut}
                  disabled={isActioning}
                  variant="destructive"
                  className={hasAlreadyTakenLunch ? "w-full" : "flex-1"}
                >
                  {isActioning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <LogOut className="mr-2 h-4 w-4" />
                      Clock Out
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ClockInModal
        open={showClockInModal}
        onOpenChange={setShowClockInModal}
        projects={projects}
        personnelId={personnelId}
      />

      <LocationPermissionDialog
        open={showLocationHelp}
        onOpenChange={setShowLocationHelp}
      />
    </>
  );
}

```

### `src/components/portal/InlineClockControls.tsx`

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Loader2, AlertTriangle } from "lucide-react";
import { useClockIn, useClockOut, useOpenClockEntry, formatTime24h } from "@/integrations/supabase/hooks/useTimeClock";
import { useGeolocation } from "@/hooks/useGeolocation";
import { toast } from "sonner";
import { LocationPermissionDialog } from "./LocationPermissionDialog";

interface InlineClockControlsProps {
  project: {
    id: string;
    name: string;
    require_clock_location?: boolean;
  };
  personnelId: string;
  hasOtherOpenEntry: boolean;
}

export function InlineClockControls({ project, personnelId, hasOtherOpenEntry }: InlineClockControlsProps) {
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  
  const { data: openEntry, isLoading } = useOpenClockEntry(personnelId, project.id);
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const { geoData, isRequesting, permissionState, requestLocation, hasLocation } = useGeolocation(false);

  const requiresLocation = project.require_clock_location !== false;
  const isLocationDenied = permissionState === "denied";
  const isLocationPrompt = permissionState === "prompt" || permissionState === null;

  const getLocation = (): Promise<{
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
    source: "device" | "ip_fallback" | null;
    capturedAt: string | null;
    error: string | null;
  }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: null, lng: null, accuracy: null, source: null, capturedAt: null, error: "Geolocation not supported" });
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            source: "device",
            capturedAt: new Date().toISOString(),
            error: null,
          });
        },
        (err) => resolve({ lat: null, lng: null, accuracy: null, source: null, capturedAt: null, error: err.message }),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handleClockIn = async () => {
    if (hasOtherOpenEntry) {
      toast.error("Already clocked into another project. Clock out first.");
      return;
    }

    // If location is required and denied, show the assistance dialog
    if (requiresLocation && isLocationDenied) {
      setShowLocationDialog(true);
      return;
    }

    setIsGettingLocation(true);
    const locationData = await getLocation();
    
    if (requiresLocation && !locationData.lat) {
      setIsGettingLocation(false);
      // Show dialog for assistance
      setShowLocationDialog(true);
      return;
    }
    
    setIsGettingLocation(false);

    clockIn.mutate({
      personnelId,
      projectId: project.id,
      geoData: locationData,
    });
  };

  const handleClockOut = async () => {
    if (!openEntry) return;

    setIsGettingLocation(true);
    const locationData = await getLocation();
    setIsGettingLocation(false);

    clockOut.mutate({
      entryId: openEntry.id,
      personnelId,
      projectId: project.id,
      clockInAt: openEntry.clock_in_at!,
      geoData: locationData,
    });
  };

  const handleLocationDialogRequest = () => {
    requestLocation();
  };

  const isPending = clockIn.isPending || clockOut.isPending || isGettingLocation;

  if (isLoading) {
    return (
      <div className="mt-2 p-2 bg-secondary/30 rounded flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <>
      <div className="mt-2 p-2 bg-secondary/30 rounded">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {openEntry ? (
              <span className="text-green-600 dark:text-green-400 font-medium">
                Clocked in at {formatTime24h(openEntry.clock_in_at!)}
              </span>
            ) : (
              <span className="text-muted-foreground">Not clocked in</span>
            )}
          </div>
          
          {openEntry ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleClockOut();
              }}
              disabled={isPending}
              className="h-7 text-xs"
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Clock Out"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleClockIn();
              }}
              disabled={isPending || hasOtherOpenEntry}
              className="h-7 text-xs"
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Clock In"}
            </Button>
          )}
        </div>
        
        {requiresLocation && (
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {openEntry?.clock_in_lat ? "Location captured" : "Location required"}
            </div>
            
            {/* Show warning and enable button if location is denied */}
            {!openEntry && isLocationDenied && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLocationDialog(true);
                }}
                className="flex items-center gap-1 text-xs text-destructive hover:underline"
              >
                <AlertTriangle className="h-3 w-3" />
                Enable Location
              </button>
            )}
          </div>
        )}
      </div>

      <LocationPermissionDialog
        open={showLocationDialog}
        onOpenChange={setShowLocationDialog}
      />
    </>
  );
}
```

### `src/components/portal/LocationPermissionDialog.tsx`

```tsx
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface LocationPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationPermissionDialog({
  open,
  onOpenChange,
}: LocationPermissionDialogProps) {
  const [expanded, setExpanded] = useState<string | undefined>(undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Location Access Required
          </DialogTitle>
          <DialogDescription>
            Location access is required for this project. Please enable it in your browser settings to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            To enable location access, follow the instructions for your browser:
          </p>

          <Accordion
            type="single"
            collapsible
            value={expanded}
            onValueChange={setExpanded}
            className="w-full"
          >
            <AccordionItem value="chrome">
              <AccordionTrigger className="text-sm">
                Google Chrome
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click the lock/info icon in the address bar</li>
                  <li>Select "Site settings"</li>
                  <li>Find "Location" and change it to "Allow"</li>
                  <li>Refresh the page</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="safari">
              <AccordionTrigger className="text-sm">
                Safari (Mac/iOS)
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p className="font-medium">On Mac:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Safari menu → Settings → Websites</li>
                  <li>Click "Location" in the sidebar</li>
                  <li>Find this website and select "Allow"</li>
                </ol>
                <p className="font-medium mt-2">On iPhone/iPad:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Settings → Safari → Location</li>
                  <li>Select "Ask" or "Allow"</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="firefox">
              <AccordionTrigger className="text-sm">
                Firefox
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click the lock icon in the address bar</li>
                  <li>Click "Connection secure" or site info</li>
                  <li>Click "More information"</li>
                  <li>Go to "Permissions" tab</li>
                  <li>Find "Access Your Location" and select "Allow"</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="edge">
              <AccordionTrigger className="text-sm">
                Microsoft Edge
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click the lock icon in the address bar</li>
                  <li>Click "Permissions for this site"</li>
                  <li>Find "Location" and change it to "Allow"</li>
                  <li>Refresh the page</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

```

### `src/components/portal/PhotoUploadRequired.tsx`

```tsx
import { useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PhotoUpload } from "@/components/personnel/PhotoUpload";
import { useUpdatePersonnelPhoto } from "@/integrations/supabase/hooks/usePortal";

interface PhotoUploadRequiredProps {
  personnelId: string;
}

export function PhotoUploadRequired({ personnelId }: PhotoUploadRequiredProps) {
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const updatePhoto = useUpdatePersonnelPhoto();

  const handlePhotoSaved = async (url: string) => {
    await updatePhoto.mutateAsync(url);
    setPhotoUrl(url);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Camera className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Profile Photo Required</CardTitle>
          <CardDescription className="text-base">
            A profile photo is required for identification and badge printing.
            Please upload a clear headshot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <PhotoUpload
            currentPhotoUrl={photoUrl}
            onPhotoChange={setPhotoUrl}
            onPhotoSaved={handlePhotoSaved}
            personnelId={personnelId}
          />
        </CardContent>
      </Card>
    </div>
  );
}

```

### `src/components/portal/PortalAssetCard.tsx`

```tsx
import { useState } from "react";
import { 
  Car, 
  Key, 
  Badge as BadgeIcon, 
  Wrench, 
  MapPin, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  Laptop,
  Package,
  ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { PortalAssignedAsset } from "@/integrations/supabase/hooks/usePortalAssets";

const assetTypeConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  vehicle: { icon: Car, label: "Vehicle" },
  key: { icon: Key, label: "Key" },
  badge: { icon: BadgeIcon, label: "Badge" },
  tool: { icon: Wrench, label: "Tool" },
  device: { icon: Laptop, label: "Device" },
  equipment: { icon: Package, label: "Equipment" },
  location: { icon: MapPin, label: "Location" },
  other: { icon: Package, label: "Other" },
};

interface PortalAssetCardProps {
  assignment: PortalAssignedAsset;
  showProject?: boolean;
}

export function PortalAssetCard({ assignment, showProject = false }: PortalAssetCardProps) {
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const asset = assignment.asset;
  
  if (!asset) return null;
  
  const config = assetTypeConfig[asset.type] || assetTypeConfig.other;
  const Icon = config.icon;
  
  const hasInstructions = asset.instructions || asset.access_instructions || asset.gate_code;
  
  const googleMapsUrl = asset.address 
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(asset.address)}`
    : null;

  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{asset.label}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {config.label}
              </Badge>
              {showProject && assignment.project && (
                <Badge variant="secondary" className="text-xs">
                  {assignment.project.name}
                </Badge>
              )}
            </div>
            {asset.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {asset.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Address with maps link */}
      {asset.address && (
        <div className="mt-3 flex items-start gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm">{asset.address}</p>
            {googleMapsUrl && (
              <a 
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
              >
                Open in Maps
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Operating Hours */}
      {asset.operating_hours && (
        <div className="mt-2 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{asset.operating_hours}</p>
        </div>
      )}

      {/* Collapsible Instructions */}
      {hasInstructions && (
        <Collapsible open={instructionsOpen} onOpenChange={setInstructionsOpen} className="mt-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between h-8 px-2">
              <span className="text-xs font-medium">
                {instructionsOpen ? "Hide" : "View"} Instructions
              </span>
              {instructionsOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2 p-3 rounded-lg bg-muted/50">
            {asset.gate_code && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Gate Code</p>
                <p className="text-sm font-mono">{asset.gate_code}</p>
              </div>
            )}
            {asset.access_instructions && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Access Instructions</p>
                <p className="text-sm whitespace-pre-wrap">{asset.access_instructions}</p>
              </div>
            )}
            {asset.instructions && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Instructions</p>
                <p className="text-sm whitespace-pre-wrap">{asset.instructions}</p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Assignment Notes */}
      {assignment.notes && (
        <div className="mt-3 p-2 rounded bg-muted/50">
          <p className="text-xs text-muted-foreground">{assignment.notes}</p>
        </div>
      )}
    </div>
  );
}

```

### `src/components/portal/PortalLayout.tsx`

```tsx
import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Home, 
  Clock, 
  Briefcase, 
  Receipt, 
  Bell, 
  Settings, 
  LogOut,
  Menu,
  FileText,
  FolderOpen,
  Timer,
  Package,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentPersonnel, usePersonnelNotifications } from "@/integrations/supabase/hooks/usePortal";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PersonnelAvatar } from "@/components/personnel/PersonnelAvatar";
import { useIsMobile, useIsWideTablet } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

const navItems = [
  { href: "/portal", label: "Dashboard", icon: Home },
  { href: "/portal/time-clock", label: "Time Clock", icon: Timer },
  { href: "/portal/hours", label: "My Hours", icon: Clock },
  { href: "/portal/projects", label: "My Projects", icon: Briefcase },
  { href: "/portal/assets", label: "My Assets", icon: Package },
  { href: "/portal/documents", label: "My Documents", icon: FolderOpen },
  { href: "/portal/reimbursements", label: "Reimbursements", icon: Receipt },
  { href: "/portal/tax-forms", label: "Tax Forms", icon: FileText },
  { href: "/portal/notifications", label: "Notifications", icon: Bell },
  { href: "/portal/settings", label: "Settings", icon: Settings },
];

interface PortalLayoutProps {
  children: ReactNode;
}

export function PortalLayout({ children }: PortalLayoutProps) {
  const { signOut } = useAuth();
  const location = useLocation();
  const { data: personnel } = useCurrentPersonnel();
  const { data: notifications } = usePersonnelNotifications(personnel?.id);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const isMobile = useIsMobile();
  const isWideTablet = useIsWideTablet();
  
  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  // On tablet, default to collapsed sidebar for more content space
  const isCollapsed = isWideTablet ? sidebarCollapsed : false;
  const sidebarWidth = isCollapsed ? "w-16" : "w-64";
  const mainMargin = isCollapsed ? "md:ml-16" : "md:ml-64";

  const NavContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <div className="flex flex-col h-full">
      <div className={cn("p-4 border-b", collapsed && "px-2")}>
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          {personnel && (
            <PersonnelAvatar
              photoUrl={personnel.photo_url}
              firstName={personnel.first_name}
              lastName={personnel.last_name}
              size={collapsed ? "sm" : "md"}
            />
          )}
          {!collapsed && (
            <div className="min-w-0">
              <h2 className="font-semibold text-lg truncate">Personnel Portal</h2>
              {personnel && (
                <p className="text-sm text-muted-foreground truncate">
                  {personnel.first_name} {personnel.last_name}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      
      <nav className={cn("flex-1 p-4 space-y-1", collapsed && "px-2")}>
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            
            const linkContent = (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md text-sm font-medium transition-colors min-h-[44px]",
                  collapsed ? "justify-center px-2 py-3" : "px-3 py-2",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-muted"
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="truncate">{item.label}</span>
                    {item.href === "/portal/notifications" && unreadCount > 0 && (
                      <span className="ml-auto bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </>
                )}
                {collapsed && item.href === "/portal/notifications" && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs w-5 h-5 flex items-center justify-center rounded-full">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <div className="relative">{linkContent}</div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </TooltipProvider>
      </nav>
      
      <div className={cn("p-4 border-t", collapsed && "px-2")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="w-full min-h-[44px]"
                onClick={signOut}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign Out</TooltipContent>
          </Tooltip>
        ) : (
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 min-h-[44px]"
            onClick={signOut}
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Desktop/Tablet Sidebar */}
        {!isMobile && (
          <aside className={cn(
            "fixed inset-y-0 left-0 flex flex-col border-r bg-card transition-all duration-300 z-30",
            sidebarWidth
          )}>
            <NavContent collapsed={isCollapsed} />
            
            {/* Collapse toggle for tablets */}
            {isWideTablet && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute -right-3 top-20 h-6 w-6 rounded-full border bg-card shadow-md"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronLeft className="h-3 w-3" />
                )}
              </Button>
            )}
          </aside>
        )}
        
        {/* Mobile Header */}
        {isMobile && (
          <header className="sticky top-0 z-50 flex items-center justify-between p-4 border-b bg-card">
            <h2 className="font-semibold">Personnel Portal</h2>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <NavContent />
              </SheetContent>
            </Sheet>
          </header>
        )}
        
        {/* Main Content */}
        <main className={cn(
          "min-h-screen transition-all duration-300",
          !isMobile && mainMargin
        )}>
          <div className="p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

```

### `src/components/portal/PortalProtectedRoute.tsx`

```tsx
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentPersonnel } from "@/integrations/supabase/hooks/usePortal";
import { Loader2 } from "lucide-react";
import { PhotoUploadRequired } from "./PhotoUploadRequired";

interface PortalProtectedRouteProps {
  children: ReactNode;
}

export function PortalProtectedRoute({ children }: PortalProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { data: personnel, isLoading: personnelLoading } = useCurrentPersonnel();

  if (authLoading || personnelLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/portal/login" replace />;
  }

  if (!personnel) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">
            Your account is not linked to a personnel record.
          </p>
        </div>
      </div>
    );
  }

  // Require profile photo before allowing portal access
  if (!personnel.photo_url) {
    return <PhotoUploadRequired personnelId={personnel.id} />;
  }

  return <>{children}</>;
}

```

### `src/components/portal/ProjectClockCard.tsx`

```tsx
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { useOpenClockEntry, useClockIn, useClockOut, formatDateTime24h } from "@/integrations/supabase/hooks/useTimeClock";
import { useGeolocation } from "@/hooks/useGeolocation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProjectClockCardProps {
  project: {
    id: string;
    name: string;
    time_clock_enabled: boolean;
    require_clock_location: boolean;
  };
  personnelId: string;
  hasOtherOpenEntry: boolean;
}

export function ProjectClockCard({ project, personnelId, hasOtherOpenEntry }: ProjectClockCardProps) {
  const { data: openEntry, isLoading: entryLoading } = useOpenClockEntry(personnelId, project.id);
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const { geoData, isRequesting: geoRequesting, requestLocation, hasLocation } = useGeolocation(false);
  const [isClocking, setIsClocking] = useState(false);

  const isClockedIn = !!openEntry;

  const handleClockIn = useCallback(async () => {
    setIsClocking(true);
    
    // Request location first
    requestLocation();
    
    // Wait for location result
    const waitForLocation = () => new Promise<typeof geoData>((resolve) => {
      const checkLocation = setInterval(() => {
        // We need to use a ref or state to get the latest geoData
        // For simplicity, we'll request and wait
      }, 100);
      
      // Use a timeout approach instead
      setTimeout(() => {
        clearInterval(checkLocation);
        resolve(geoData);
      }, 3000);
    });

    // Instead, we'll handle this in a useEffect-like manner
    // For now, let's use the geolocation API directly
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const locationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            source: "device" as const,
            capturedAt: new Date().toISOString(),
            error: null,
          };
          
          try {
            await clockIn.mutateAsync({
              projectId: project.id,
              personnelId,
              geoData: locationData,
            });
          } catch (error) {
            // Error handled by mutation
          } finally {
            setIsClocking(false);
          }
        },
        (error) => {
          if (project.require_clock_location) {
            toast.error("Location is required to clock in for this project");
            setIsClocking(false);
          } else {
            // Allow clock in without location
            clockIn.mutateAsync({
              projectId: project.id,
              personnelId,
              geoData: {
                lat: null,
                lng: null,
                accuracy: null,
                source: null,
                capturedAt: null,
                error: error.message,
              },
            }).finally(() => setIsClocking(false));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } else {
      if (project.require_clock_location) {
        toast.error("Geolocation is not supported by this browser");
        setIsClocking(false);
      } else {
        // Allow clock in without location
        await clockIn.mutateAsync({
          projectId: project.id,
          personnelId,
          geoData: {
            lat: null,
            lng: null,
            accuracy: null,
            source: null,
            capturedAt: null,
            error: "Geolocation not supported",
          },
        });
        setIsClocking(false);
      }
    }
  }, [project, personnelId, clockIn, requestLocation, geoData]);

  const handleClockOut = useCallback(async () => {
    if (!openEntry) return;
    
    setIsClocking(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const locationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            source: "device" as const,
            capturedAt: new Date().toISOString(),
            error: null,
          };
          
          try {
            await clockOut.mutateAsync({
              entryId: openEntry.id,
              personnelId,
              projectId: project.id,
              clockInAt: openEntry.clock_in_at,
              geoData: locationData,
            });
          } catch (error) {
            // Error handled by mutation
          } finally {
            setIsClocking(false);
          }
        },
        (error) => {
          if (project.require_clock_location) {
            toast.error("Location is required to clock out for this project");
            setIsClocking(false);
          } else {
            clockOut.mutateAsync({
              entryId: openEntry.id,
              personnelId,
              projectId: project.id,
              clockInAt: openEntry.clock_in_at,
              geoData: {
                lat: null,
                lng: null,
                accuracy: null,
                source: null,
                capturedAt: null,
                error: error.message,
              },
            }).finally(() => setIsClocking(false));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } else {
      if (project.require_clock_location) {
        toast.error("Geolocation is not supported by this browser");
        setIsClocking(false);
      } else {
        await clockOut.mutateAsync({
          entryId: openEntry.id,
          personnelId,
          projectId: project.id,
          clockInAt: openEntry.clock_in_at,
          geoData: {
            lat: null,
            lng: null,
            accuracy: null,
            source: null,
            capturedAt: null,
            error: "Geolocation not supported",
          },
        });
        setIsClocking(false);
      }
    }
  }, [openEntry, project, personnelId, clockOut]);

  const canClockIn = !isClockedIn && !hasOtherOpenEntry && !entryLoading;
  const canClockOut = isClockedIn && !entryLoading;

  return (
    <Card className={cn(
      "transition-all duration-200",
      isClockedIn && "border-green-500/50 bg-green-500/5"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{project.name}</span>
          {isClockedIn && (
            <span className="text-sm font-normal text-green-600 flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Active
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Clock Status */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {entryLoading ? (
            <span className="text-muted-foreground">Loading...</span>
          ) : isClockedIn && openEntry ? (
            <span className="text-foreground">
              Clocked in {formatDateTime24h(openEntry.clock_in_at)}
            </span>
          ) : (
            <span className="text-muted-foreground">Not clocked in</span>
          )}
        </div>

        {/* Location indicator for active clock */}
        {isClockedIn && openEntry && (
          <div className="flex items-center gap-2 text-sm">
            {openEntry.clock_in_lat && openEntry.clock_in_lng ? (
              <>
                <MapPin className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Location captured</span>
                {openEntry.clock_in_accuracy && (
                  <span className="text-muted-foreground text-xs">
                    (±{Math.round(openEntry.clock_in_accuracy)}m)
                  </span>
                )}
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-amber-500">No location captured</span>
              </>
            )}
          </div>
        )}

        {/* Warning if has other open entry */}
        {hasOtherOpenEntry && !isClockedIn && (
          <div className="flex items-center gap-2 text-sm text-amber-500">
            <AlertTriangle className="h-4 w-4" />
            <span>You have an active clock on another project</span>
          </div>
        )}

        {/* Clock Actions */}
        <div className="flex gap-2">
          {!isClockedIn ? (
            <Button
              onClick={handleClockIn}
              disabled={!canClockIn || isClocking}
              className="flex-1"
            >
              {isClocking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Clocking In...
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Clock In
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleClockOut}
              disabled={!canClockOut || isClocking}
              variant="destructive"
              className="flex-1"
            >
              {isClocking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Clocking Out...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Clock Out
                </>
              )}
            </Button>
          )}
        </div>

        {/* Location requirement notice */}
        {project.require_clock_location && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            Location required for clock in/out
          </p>
        )}
      </CardContent>
    </Card>
  );
}

```

### `src/components/portal/ProjectWeeklyPayHistory.tsx`

```tsx
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { 
  getAllPayPeriodsFromEntries, 
  calculatePayPeriodTotals,
  PayPeriod 
} from "@/lib/payPeriodUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TimeEntry {
  id: string;
  entry_date: string;
  regular_hours: number | null;
  overtime_hours: number | null;
  hourly_rate?: number | null;
  hours?: number | null;
  is_holiday?: boolean;
}

interface ProjectWeeklyPayHistoryProps {
  timeEntries: TimeEntry[];
  hourlyRate: number | null;
  overtimeMultiplier?: number;
  holidayMultiplier?: number;
}

export function ProjectWeeklyPayHistory({ 
  timeEntries, 
  hourlyRate, 
  overtimeMultiplier = 1.5,
  holidayMultiplier = 2.0
}: ProjectWeeklyPayHistoryProps) {
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>("");
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());

  // Get all pay periods from time entries
  const payPeriods = useMemo(() => {
    return getAllPayPeriodsFromEntries(timeEntries);
  }, [timeEntries]);

  // Default to most recent period expanded
  const selectedPeriod = useMemo(() => {
    if (!payPeriods.length) return null;
    if (!selectedPeriodKey) return payPeriods[0];
    return payPeriods.find(p => format(p.weekStart, "yyyy-MM-dd") === selectedPeriodKey) || payPeriods[0];
  }, [payPeriods, selectedPeriodKey]);

  // Calculate totals for selected period
  const periodTotals = useMemo(() => {
    if (!selectedPeriod) return null;
    return calculatePayPeriodTotals(timeEntries, selectedPeriod, hourlyRate || 0, overtimeMultiplier, 40, holidayMultiplier);
  }, [timeEntries, selectedPeriod, hourlyRate, overtimeMultiplier, holidayMultiplier]);

  const togglePeriodExpanded = (periodKey: string) => {
    const newExpanded = new Set(expandedPeriods);
    if (newExpanded.has(periodKey)) {
      newExpanded.delete(periodKey);
    } else {
      newExpanded.add(periodKey);
    }
    setExpandedPeriods(newExpanded);
  };

  if (payPeriods.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Pay Period History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No time entries logged for this project yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Pay Period History
          </CardTitle>
          <Select 
            value={selectedPeriodKey || (payPeriods[0] ? format(payPeriods[0].weekStart, "yyyy-MM-dd") : "")}
            onValueChange={setSelectedPeriodKey}
          >
            <SelectTrigger className="w-full sm:w-[220px] h-9">
              <SelectValue placeholder="Select pay period" />
            </SelectTrigger>
            <SelectContent>
              {payPeriods.map((period) => (
                <SelectItem 
                  key={format(period.weekStart, "yyyy-MM-dd")} 
                  value={format(period.weekStart, "yyyy-MM-dd")}
                >
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedPeriod && periodTotals && (
          <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
            {/* Payment Date */}
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-muted-foreground">Payment Date:</span>
              <span className="font-medium text-primary">
                {format(selectedPeriod.paymentDate, "EEEE, MMM d, yyyy")}
              </span>
            </div>

            {/* Weekly Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center mb-4">
              <div className="p-2 bg-background rounded-lg">
                <div className="text-lg font-bold">{periodTotals.daysWorked}</div>
                <div className="text-xs text-muted-foreground">Days Worked</div>
              </div>
              <div className="p-2 bg-background rounded-lg">
                <div className="text-lg font-bold">{periodTotals.regularHours.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Regular Hours</div>
              </div>
              <div className="p-2 bg-background rounded-lg">
                <div className="text-lg font-bold text-amber-600">{periodTotals.overtimeHours.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">OT Hours</div>
              </div>
              {periodTotals.holidayHours > 0 && (
                <div className="p-2 bg-background rounded-lg">
                  <div className="text-lg font-bold text-purple-600">{periodTotals.holidayHours.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">HO Hours</div>
                </div>
              )}
              <div className="p-2 bg-background rounded-lg">
                <div className="text-lg font-bold">{periodTotals.totalHours.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Total Hours</div>
              </div>
            </div>

            {/* Pay Breakdown */}
            {hourlyRate !== null && hourlyRate > 0 && (
              <div className="flex flex-wrap items-center gap-2 justify-center text-sm bg-background p-3 rounded-lg mb-4">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>{formatCurrency(periodTotals.regularPay)}</span>
                <span className="text-muted-foreground">+</span>
                <span className="text-amber-600">{formatCurrency(periodTotals.overtimePay)}</span>
                <span className="text-xs text-muted-foreground">(1.5x)</span>
                {periodTotals.holidayPay > 0 && (
                  <>
                    <span className="text-muted-foreground">+</span>
                    <span className="text-purple-600">{formatCurrency(periodTotals.holidayPay)}</span>
                    <span className="text-xs text-muted-foreground">(2x)</span>
                  </>
                )}
                <span className="text-muted-foreground">=</span>
                <span className="font-bold text-primary text-lg">{formatCurrency(periodTotals.totalPay)}</span>
              </div>
            )}

            {/* Daily Breakdown */}
            <Collapsible 
              open={expandedPeriods.has(format(selectedPeriod.weekStart, "yyyy-MM-dd"))}
              onOpenChange={() => togglePeriodExpanded(format(selectedPeriod.weekStart, "yyyy-MM-dd"))}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm font-medium hover:bg-background/50 rounded-lg transition-colors">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Daily Breakdown
                </span>
                {expandedPeriods.has(format(selectedPeriod.weekStart, "yyyy-MM-dd")) ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[80px]">Day</TableHead>
                        <TableHead className="w-[100px]">Date</TableHead>
                        <TableHead className="text-right">Regular</TableHead>
                        <TableHead className="text-right">OT</TableHead>
                        <TableHead className="text-right">HO</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {periodTotals.dailyBreakdown.map((day) => {
                        // Note: daily pay is now calculated in the totals using snapshotted rates
                        // For display, we show the hours breakdown only (pay is in the period totals)
                        const hasHours = day.totalHours > 0;
                        return (
                          <TableRow 
                            key={format(day.date, "yyyy-MM-dd")}
                            className={hasHours ? "" : "opacity-50"}
                          >
                            <TableCell className="font-medium">{day.dayName}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(day.date, "MMM d")}
                            </TableCell>
                            <TableCell className="text-right">
                              {hasHours ? `${day.regularHours.toFixed(1)}h` : "-"}
                            </TableCell>
                            <TableCell className="text-right text-amber-600">
                              {day.overtimeHours > 0 ? `${day.overtimeHours.toFixed(1)}h` : "-"}
                            </TableCell>
                            <TableCell className="text-right text-purple-600">
                              {day.holidayHours > 0 ? `${day.holidayHours.toFixed(1)}h` : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {hasHours ? `${day.totalHours.toFixed(1)}h` : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Past Pay Periods Summary List */}
          {payPeriods.length > 1 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Past Pay Periods</h4>
            {payPeriods.slice(1, 5).map((period) => {
              const totals = calculatePayPeriodTotals(timeEntries, period, hourlyRate || 0, overtimeMultiplier, 40, holidayMultiplier);
              return (
                <div 
                  key={format(period.weekStart, "yyyy-MM-dd")} 
                  className="p-3 rounded-lg border bg-card cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => setSelectedPeriodKey(format(period.weekStart, "yyyy-MM-dd"))}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{period.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {totals.daysWorked} day{totals.daysWorked !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{totals.totalHours.toFixed(1)}h total</span>
                    {hourlyRate !== null && hourlyRate > 0 && (
                      <span className="font-medium text-primary">{formatCurrency(totals.totalPay)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

```

### `src/components/portal/ReceiptUpload.tsx`

```tsx
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, X, FileImage, Loader2 } from "lucide-react";

interface ReceiptUploadProps {
  personnelId: string;
  onUpload: (url: string) => void;
  existingUrl?: string | null;
}

export function ReceiptUpload({ personnelId, onUpload, existingUrl }: ReceiptUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload an image (JPEG, PNG, GIF, WebP) or PDF.");
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File is too large. Maximum size is 5MB.");
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const timestamp = Date.now();
      const filePath = `reimbursement-receipts/${personnelId}/${timestamp}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("document-attachments")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("document-attachments")
        .getPublicUrl(filePath);

      setPreviewUrl(publicUrl);
      onUpload(publicUrl);
      toast.success("Receipt uploaded successfully");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload receipt");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleClear = () => {
    setPreviewUrl(null);
    onUpload("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isImage = previewUrl && !previewUrl.endsWith(".pdf");

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {previewUrl ? (
        <div className="relative">
          {isImage ? (
            <div className="relative w-full h-32 rounded-lg overflow-hidden border bg-muted">
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted">
              <FileImage className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground truncate flex-1">
                PDF Receipt
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6"
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full h-24 border-dashed"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Uploading...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Click to upload receipt (Max 5MB)
              </span>
            </div>
          )}
        </Button>
      )}
    </div>
  );
}

```

## Vendor Portal — Pages

### `src/pages/vendor-portal/AcceptVendorInvitation.tsx`

```tsx
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useVendorInvitationByToken } from "@/integrations/supabase/hooks/useVendorPortal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, XCircle, Building2 } from "lucide-react";

export default function AcceptVendorInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { data: invitation, isLoading: invitationLoading, error } = useVendorInvitationByToken(token);
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isExpired = invitation && new Date(invitation.expires_at) < new Date();

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    
    if (!invitation || !token) return;
    
    setLoading(true);

    try {
      // Call edge function to handle invitation acceptance securely
      const { data, error: fnError } = await supabase.functions.invoke("accept-vendor-invitation", {
        body: { token, password },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      if (data?.isExistingUser) {
        toast.success("Account linked successfully!");
        navigate("/vendor");
      } else {
        toast.success("Account created successfully! Please check your email to verify.");
        navigate("/vendor/login");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  if (invitationLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Invitation</h2>
            <p className="text-muted-foreground text-center mb-4">
              This invitation link is invalid or has already been used.
            </p>
            <Button variant="outline" onClick={() => navigate("/vendor/login")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invitation Expired</h2>
            <p className="text-muted-foreground text-center mb-4">
              This invitation has expired. Please contact your administrator for a new invitation.
            </p>
            <Button variant="outline" onClick={() => navigate("/vendor/login")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome!</CardTitle>
          <CardDescription>
            You've been invited to join the Vendor Portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg mb-6">
            <p className="text-sm text-muted-foreground">Invitation for:</p>
            <p className="font-medium">{invitation.vendor?.name}</p>
            <p className="text-sm text-muted-foreground">{invitation.email}</p>
          </div>
          
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Create Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Account
            </Button>
          </form>
          
          <p className="text-sm text-center text-muted-foreground mt-6">
            Already have an account?{" "}
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/vendor/login")}>
              Sign in
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

```

### `src/pages/vendor-portal/VendorBillDetail.tsx`

```tsx
import { SEO } from "@/components/SEO";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VendorPortalLayout } from "@/components/vendor-portal/VendorPortalLayout";
import { useParams, useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useVendorBill } from "@/integrations/supabase/hooks/useVendorPortal";
import { format } from "date-fns";
import { formatLocalDate } from "@/lib/dateUtils";

export default function VendorBillDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: bill, isLoading } = useVendorBill(id);

  if (isLoading) {
    return (
      <VendorPortalLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </VendorPortalLayout>
    );
  }

  if (!bill) {
    return (
      <VendorPortalLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Bill Not Found</h2>
          <p className="text-muted-foreground mb-4">
            This bill doesn't exist or you don't have access to view it.
          </p>
          <Button onClick={() => navigate("/vendor/bills")}>
            Back to Bills
          </Button>
        </div>
      </VendorPortalLayout>
    );
  }

  return (
    <>
      <SEO
        title={`Bill ${bill.number}`}
        description={`View details for bill ${bill.number}`}
      />
      <VendorPortalLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/vendor/bills")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{bill.number}</h1>
                <StatusBadge status={bill.status} />
              </div>
              <p className="text-muted-foreground">
                PO: {(bill.purchase_orders as any)?.number} - {(bill.purchase_orders as any)?.project_name}
              </p>
            </div>
          </div>

          {/* Bill Info */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Bill Date</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-medium">
                  {formatLocalDate(bill.bill_date, "MMM d, yyyy")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Due Date</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-medium">
                  {formatLocalDate(bill.due_date, "MMM d, yyyy")}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(bill.total)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Description</th>
                      <th className="text-right py-2 font-medium">Qty</th>
                      <th className="text-right py-2 font-medium">Unit Price</th>
                      <th className="text-right py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.vendor_bill_line_items?.map((item: any) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-2">{item.description}</td>
                        <td className="text-right py-2">{item.quantity}</td>
                        <td className="text-right py-2">{formatCurrency(item.unit_price)}</td>
                        <td className="text-right py-2 font-medium">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td colSpan={3} className="text-right py-2">Total</td>
                      <td className="text-right py-2">{formatCurrency(bill.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {bill.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{bill.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Submission Info */}
          {bill.submitted_at && (
            <Card>
              <CardHeader>
                <CardTitle>Submission Info</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Submitted on {format(new Date(bill.submitted_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </VendorPortalLayout>
    </>
  );
}

```

### `src/pages/vendor-portal/VendorBillsList.tsx`

```tsx
import { SEO } from "@/components/SEO";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VendorPortalLayout } from "@/components/vendor-portal/VendorPortalLayout";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import { FileText } from "lucide-react";
import { formatLocalDate } from "@/lib/dateUtils";
import {
  useVendorBills,
  VendorBill,
} from "@/integrations/supabase/hooks/useVendorPortal";

export default function VendorBillsList() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");

  const { data: bills, isLoading } = useVendorBills();

  const filteredBills = useMemo(() => {
    if (!bills) return [];
    if (!search) return bills;
    
    const searchLower = search.toLowerCase();
    return bills.filter(
      (bill) =>
        bill.number.toLowerCase().includes(searchLower) ||
        bill.po_number.toLowerCase().includes(searchLower)
    );
  }, [bills, search]);

  const columns: Column<VendorBill>[] = useMemo(
    () => [
      { key: "number", header: "Bill #" },
      { key: "po_number", header: "PO #" },
      {
        key: "status",
        header: "Status",
        render: (bill) => <StatusBadge status={bill.status as any} />,
      },
      {
        key: "total",
        header: "Amount",
        render: (bill) => (
          <span className="font-medium">{formatCurrency(bill.total)}</span>
        ),
      },
      {
        key: "bill_date",
        header: "Bill Date",
        render: (bill) => (
          <span>{formatLocalDate(bill.bill_date, "MMM d, yyyy")}</span>
        ),
      },
      {
        key: "submitted_at",
        header: "Submitted",
        render: (bill) => (
          <span>
            {bill.submitted_at
              ? formatLocalDate(bill.submitted_at, "MMM d, yyyy")
              : "—"}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <>
      <SEO
        title="My Bills"
        description="View all your submitted bills."
      />
      <VendorPortalLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">My Bills</h1>
              <p className="text-muted-foreground">View all your submitted bills and their status.</p>
            </div>
            <Button onClick={() => navigate("/vendor/bills/new")}>
              <FileText className="h-4 w-4 mr-2" />
              New Bill
            </Button>
          </div>

          <div className="max-w-sm">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search bills..."
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading bills...
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "No bills match your search." : "You haven't submitted any bills yet."}
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {filteredBills.map((bill) => (
                <Card
                  key={bill.id}
                  className="p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => navigate(`/vendor/bills/${bill.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-medium text-foreground">
                        {bill.number}
                      </span>
                      <p className="text-sm text-muted-foreground">
                        PO: {bill.po_number}
                      </p>
                    </div>
                    <StatusBadge status={bill.status as any} />
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                      {formatLocalDate(bill.bill_date, "MMM d, yyyy")}
                    </span>
                    <span className="text-primary font-semibold">
                      {formatCurrency(bill.total)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <DataTable
              data={filteredBills}
              columns={columns}
              onRowClick={(bill) => navigate(`/vendor/bills/${bill.id}`)}
            />
          )}
        </div>
      </VendorPortalLayout>
    </>
  );
}

```

### `src/pages/vendor-portal/VendorDashboard.tsx`

```tsx
import { SEO } from "@/components/SEO";
import { StatCard } from "@/components/dashboard/StatCard";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { VendorPortalLayout } from "@/components/vendor-portal/VendorPortalLayout";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/utils";
import {
  FileText,
  DollarSign,
  ClipboardList,
  ListChecks,
} from "lucide-react";
import {
  useVendorPurchaseOrders,
  useVendorBills,
  VendorPurchaseOrder,
  VendorBill,
} from "@/integrations/supabase/hooks/useVendorPortal";

export default function VendorDashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const {
    data: purchaseOrders,
    isLoading: poLoading,
    refetch: refetchPOs,
    isFetching: isFetchingPOs,
  } = useVendorPurchaseOrders();

  const {
    data: bills,
    isLoading: billsLoading,
    refetch: refetchBills,
    isFetching: isFetchingBills,
  } = useVendorBills();

  const handleRefresh = async () => {
    await Promise.all([refetchPOs(), refetchBills()]);
  };

  const isRefreshing = isFetchingPOs || isFetchingBills;
  const isLoading = poLoading || billsLoading;

  const stats = useMemo(() => {
    if (!purchaseOrders || !bills) {
      return {
        openPOs: 0,
        totalContractValue: 0,
        billedToDate: 0,
        remainingToBill: 0,
        pendingBills: 0,
        approvedBills: 0,
      };
    }

    const openPOs = purchaseOrders.filter((po) => 
      po.status !== "closed" && po.status !== "cancelled"
    ).length;

    const totalContractValue = purchaseOrders.reduce(
      (sum, po) => sum + (po.revised_total ?? 0),
      0
    );

    const billedToDate = purchaseOrders.reduce(
      (sum, po) => sum + (po.billed_to_date ?? 0),
      0
    );

    const remainingToBill = purchaseOrders.reduce(
      (sum, po) => sum + (po.remaining_to_bill ?? 0),
      0
    );

    const pendingBills = bills.filter(
      (b) => b.status === "open" || b.status === "draft"
    ).length;

    const approvedBills = bills.filter((b) => b.status === "paid").length;

    return {
      openPOs,
      totalContractValue,
      billedToDate,
      remainingToBill,
      pendingBills,
      approvedBills,
    };
  }, [purchaseOrders, bills]);

  const recentPOs = useMemo(
    () => purchaseOrders?.slice(0, 5) ?? [],
    [purchaseOrders]
  );

  const recentBills = useMemo(
    () => bills?.slice(0, 5) ?? [],
    [bills]
  );

  const poColumns: Column<VendorPurchaseOrder>[] = useMemo(
    () => [
      { key: "number", header: "PO #" },
      { key: "project_name", header: "Project" },
      {
        key: "status",
        header: "Status",
        render: (po) => <StatusBadge status={po.status as any} />,
      },
      {
        key: "revised_total",
        header: "Revised Total",
        render: (po) => (
          <span className="font-medium">
            {formatCurrency(po.revised_total)}
          </span>
        ),
      },
      {
        key: "remaining_to_bill",
        header: "Remaining",
        render: (po) => (
          <span className="text-primary font-semibold">
            {formatCurrency(po.remaining_to_bill)}
          </span>
        ),
      },
    ],
    []
  );

  const billColumns: Column<VendorBill>[] = useMemo(
    () => [
      { key: "number", header: "Bill #" },
      { key: "po_number", header: "PO #" },
      {
        key: "status",
        header: "Status",
        render: (bill) => <StatusBadge status={bill.status as any} />,
      },
      {
        key: "total",
        header: "Amount",
        render: (bill) => (
          <span className="font-medium">{formatCurrency(bill.total)}</span>
        ),
      },
    ],
    []
  );

  return (
    <>
      <SEO
        title="Vendor Dashboard"
        description="View your purchase orders, change order impact, and billing status."
        keywords="vendor portal, purchase orders, billing, change orders"
      />
      <VendorPortalLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground">See your POs, billing progress, and submit bills.</p>
            </div>
            <Button
              onClick={() => navigate("/vendor/bills/new")}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              {!isMobile && "New Bill"}
            </Button>
          </div>
          
          <PullToRefreshWrapper
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          >
            {/* Stats - 2 cols on mobile/tablet portrait, 4 cols on tablet landscape+ */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4 mb-4 sm:mb-8">
              <StatCard
                title="Open POs"
                value={isLoading ? "..." : stats.openPOs}
                change={`${purchaseOrders?.length ?? 0} total POs`}
                changeType="neutral"
                icon={ClipboardList}
              />
              <StatCard
                title="Contract Value"
                value={
                  isLoading ? "..." : formatCurrency(stats.totalContractValue)
                }
                change={`Billed ${formatCurrency(stats.billedToDate)}`}
                changeType="positive"
                icon={DollarSign}
              />
              <StatCard
                title="Remaining to Bill"
                value={
                  isLoading ? "..." : formatCurrency(stats.remainingToBill)
                }
                change="Based on approved POs/COs"
                changeType="neutral"
                icon={ListChecks}
              />
              <StatCard
                title="Pending Bills"
                value={isLoading ? "..." : stats.pendingBills}
                change={
                  stats.approvedBills > 0
                    ? `${stats.approvedBills} paid`
                    : "No paid bills yet"
                }
                changeType="neutral"
                icon={FileText}
              />
            </div>

            {/* Recent POs + Bills */}
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
              {/* Recent POs */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base sm:text-lg font-semibold text-foreground">
                    Your Purchase Orders
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/vendor/pos")}
                    className="text-xs sm:text-sm"
                  >
                    View all
                  </Button>
                </div>

                {isLoading ? (
                  <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                    Loading POs...
                  </div>
                ) : recentPOs.length === 0 ? (
                  <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                    No POs assigned to you yet.
                  </div>
                ) : isMobile ? (
                  <div className="space-y-3">
                    {recentPOs.map((po) => (
                      <Card
                        key={po.id}
                        className="p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => navigate(`/vendor/pos/${po.id}`)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-medium text-foreground">
                              {po.number}
                            </span>
                            <p className="text-sm text-muted-foreground">
                              {po.project_name}
                            </p>
                        </div>
                        <StatusBadge status={po.status as any} />
                      </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">
                            Remaining:{" "}
                            {formatCurrency(po.remaining_to_bill ?? 0)}
                          </span>
                          <span className="text-primary font-semibold">
                            {formatCurrency(po.revised_total ?? 0)}
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <DataTable
                    data={recentPOs}
                    columns={poColumns}
                    onRowClick={(po) => navigate(`/vendor/pos/${po.id}`)}
                  />
                )}
              </div>

              {/* Recent Bills */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base sm:text-lg font-semibold text-foreground">
                    Your Bills
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/vendor/bills")}
                    className="text-xs sm:text-sm"
                  >
                    View all
                  </Button>
                </div>

                {isLoading ? (
                  <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                    Loading bills...
                  </div>
                ) : recentBills.length === 0 ? (
                  <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                    You haven't submitted any bills yet.
                  </div>
                ) : isMobile ? (
                  <div className="space-y-3">
                    {recentBills.map((bill) => (
                      <Card
                        key={bill.id}
                        className="p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => navigate(`/vendor/bills/${bill.id}`)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-medium text-foreground">
                              {bill.number}
                            </span>
                            <p className="text-sm text-muted-foreground">
                              PO: {bill.po_number}
                            </p>
                        </div>
                        <StatusBadge status={bill.status as any} />
                      </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">
                            {bill.submitted_at
                              ? new Date(bill.submitted_at).toLocaleDateString()
                              : "Not submitted"}
                          </span>
                          <span className="text-primary font-semibold">
                            {formatCurrency(bill.total)}
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <DataTable
                    data={recentBills}
                    columns={billColumns}
                    onRowClick={(bill) => navigate(`/vendor/bills/${bill.id}`)}
                  />
                )}
              </div>
            </div>
          </PullToRefreshWrapper>
        </div>
      </VendorPortalLayout>
    </>
  );
}

```

### `src/pages/vendor-portal/VendorLogin.tsx`

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Building2, ArrowRightLeft } from "lucide-react";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { AppleIcon } from "@/components/icons/AppleIcon";
import { PortalSwitcherModal } from "@/components/PortalSwitcherModal";
import { usePortalSwitcher } from "@/hooks/usePortalSwitcher";
import { NetworkErrorBanner } from "@/components/auth/NetworkErrorBanner";
import { withTimeout, isNetworkError, classifyNetworkError } from "@/utils/authNetwork";

export default function VendorLogin() {
  const navigate = useNavigate();
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [showNetworkError, setShowNetworkError] = useState(false);
  const {
    isOpen: isPortalSwitcherOpen,
    setIsOpen: setPortalSwitcherOpen,
    openSwitcher,
  } = usePortalSwitcher();

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setShowNetworkError(false);

    try {
      console.info(`[VendorLogin] signIn: start | origin: ${window.location.origin}`);

      const signInPromise = supabase.auth.signInWithPassword({
        email,
        password,
      });

      const { error } = await withTimeout(signInPromise, 15000, "Sign in");

      if (error) throw error;

      console.info("[VendorLogin] signIn: success, checking vendor link");
      
      // Check if user is linked to vendor
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: vendor } = await supabase
          .from("vendors")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (vendor) {
          navigate("/vendor");
        } else {
          toast.error("Your account is not linked to a vendor record");
          await supabase.auth.signOut();
        }
      }
    } catch (error: unknown) {
      console.error("[VendorLogin] signIn: exception", error);
      if (isNetworkError(error)) {
        const networkErr = classifyNetworkError(error);
        setShowNetworkError(true);
        toast.error(networkErr.userMessage);
      } else {
        toast.error((error as Error).message || "Failed to sign in");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setShowNetworkError(false);
    if (email && password) {
      handleLogin();
    }
  };

  const handleGoogleLogin = async () => {
    setIsOAuthLoading(true);
    setShowNetworkError(false);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        if (isNetworkError(error) || error.message.includes("Can't reach")) {
          setShowNetworkError(true);
        }
        throw error;
      }
      // AuthCallback will handle the redirect
    } catch (error: unknown) {
      toast.error((error as Error).message || "Failed to sign in with Google");
      setIsOAuthLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsOAuthLoading(true);
    setShowNetworkError(false);
    try {
      const { error } = await signInWithApple();
      if (error) {
        if (isNetworkError(error) || error.message.includes("Can't reach")) {
          setShowNetworkError(true);
        }
        throw error;
      }
      // AuthCallback will handle the redirect
    } catch (error: unknown) {
      toast.error((error as Error).message || "Failed to sign in with Apple");
      setIsOAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Vendor Portal</CardTitle>
          <CardDescription>
            Sign in to view your purchase orders and submit bills
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isOAuthLoading || loading}
            >
              {isOAuthLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <GoogleIcon className="h-4 w-4 mr-2" />
              )}
              Continue with Google
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleAppleLogin}
              disabled={isOAuthLoading || loading}
            >
              {isOAuthLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <AppleIcon className="h-4 w-4 mr-2" />
              )}
              Continue with Apple
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || isOAuthLoading}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Sign In
              </Button>
            </form>
          </div>

          {/* Network Error Banner */}
          {showNetworkError && (
            <NetworkErrorBanner onRetry={handleRetry} isRetrying={loading} />
          )}

          <p className="text-sm text-center text-muted-foreground mt-6">
            Don't have an account? Contact your administrator to receive an
            invitation.
          </p>

          {/* Portal Switcher */}
          <div className="pt-4 mt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={openSwitcher}
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Switch Portal
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Portal Switcher Modal */}
      <PortalSwitcherModal
        open={isPortalSwitcherOpen}
        onOpenChange={setPortalSwitcherOpen}
      />
    </div>
  );
}

```

### `src/pages/vendor-portal/VendorNewBill.tsx`

```tsx
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VendorPortalLayout } from "@/components/vendor-portal/VendorPortalLayout";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { useVendorPurchaseOrders, useVendorPurchaseOrder, useCreateVendorBill } from "@/integrations/supabase/hooks/useVendorPortal";
import { format } from "date-fns";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_cost: number;
  total: number;
  po_line_item_id?: string;
}

export default function VendorNewBill() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPoId = searchParams.get("po");

  const { data: purchaseOrders, isLoading: posLoading } = useVendorPurchaseOrders();
  const [selectedPoId, setSelectedPoId] = useState(preselectedPoId || "");
  const { data: selectedPO, isLoading: poLoading } = useVendorPurchaseOrder(selectedPoId || undefined);
  const createBill = useCreateVendorBill();

  const [billDate, setBillDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, unit_cost: 0, total: 0 },
  ]);

  // Populate line items from PO when selected
  useEffect(() => {
    if (selectedPO?.po_line_items && selectedPO.po_line_items.length > 0) {
      setLineItems(
        selectedPO.po_line_items.map((item: any) => ({
          id: crypto.randomUUID(),
          description: item.description,
          quantity: item.quantity,
          unit_cost: item.unit_cost || item.unit_price || 0,
          total: item.total,
          po_line_item_id: item.id,
        }))
      );
    }
  }, [selectedPO]);

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "unit_cost") {
          updated.total = updated.quantity * updated.unit_cost;
        }
        return updated;
      })
    );
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", quantity: 1, unit_cost: 0, total: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const total = lineItems.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPoId) {
      return;
    }

    const validLineItems = lineItems.filter((item) => item.description && item.quantity > 0);
    
    if (validLineItems.length === 0) {
      return;
    }

    await createBill.mutateAsync({
      purchase_order_id: selectedPoId,
      bill_date: billDate,
      due_date: dueDate,
      notes,
      line_items: validLineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total: item.total,
        po_line_item_id: item.po_line_item_id,
      })),
    });

    navigate("/vendor/bills");
  };

  return (
    <>
      <SEO
        title="Submit New Bill"
        description="Submit a new bill for a purchase order"
      />
      <VendorPortalLayout>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => navigate("/vendor/bills")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Submit New Bill</h1>
              <p className="text-muted-foreground">Create a bill against a purchase order</p>
            </div>
          </div>

          {/* PO Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Purchase Order</CardTitle>
            </CardHeader>
            <CardContent>
              {posLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading purchase orders...
                </div>
              ) : (
                <Select value={selectedPoId} onValueChange={setSelectedPoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a purchase order" />
                  </SelectTrigger>
                  <SelectContent>
                    {purchaseOrders?.map((po) => (
                      <SelectItem key={po.id} value={po.id}>
                        {po.number} - {po.project_name} ({formatCurrency(po.remaining_to_bill)} remaining)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {selectedPO && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <div className="grid gap-2 sm:grid-cols-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Value:</span>
                      <p className="font-medium">{formatCurrency(selectedPO.revised_total)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Billed to Date:</span>
                      <p className="font-medium">{formatCurrency(selectedPO.billed_to_date)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Remaining:</span>
                      <p className="font-medium text-primary">{formatCurrency(selectedPO.remaining_to_bill)}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bill Info */}
          <Card>
            <CardHeader>
              <CardTitle>Bill Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="billDate">Bill Date</Label>
                  <Input
                    id="billDate"
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes for this bill..."
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lineItems.map((item, index) => (
                  <div key={item.id} className="grid gap-3 sm:grid-cols-12 items-end p-3 border rounded-lg">
                    <div className="sm:col-span-5 space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                        placeholder="Description"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs">Unit Cost</Label>
                      <Input
                        type="number"
                        value={item.unit_cost}
                        onChange={(e) => updateLineItem(item.id, "unit_cost", parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs">Total</Label>
                      <div className="h-9 flex items-center font-medium">
                        {formatCurrency(item.total)}
                      </div>
                    </div>
                    <div className="sm:col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(item.id)}
                        disabled={lineItems.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/vendor/bills")}>
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedPoId || createBill.isPending}>
              {createBill.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Bill
            </Button>
          </div>
        </form>
      </VendorPortalLayout>
    </>
  );
}

```

### `src/pages/vendor-portal/VendorPODetail.tsx`

```tsx
import { SEO } from "@/components/SEO";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VendorPortalLayout } from "@/components/vendor-portal/VendorPortalLayout";
import { useParams, useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { useVendorPurchaseOrder } from "@/integrations/supabase/hooks/useVendorPortal";
import { format } from "date-fns";

export default function VendorPODetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: po, isLoading } = useVendorPurchaseOrder(id);

  if (isLoading) {
    return (
      <VendorPortalLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </VendorPortalLayout>
    );
  }

  if (!po) {
    return (
      <VendorPortalLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Purchase Order Not Found</h2>
          <p className="text-muted-foreground mb-4">
            This purchase order doesn't exist or you don't have access to view it.
          </p>
          <Button onClick={() => navigate("/vendor/pos")}>
            Back to Purchase Orders
          </Button>
        </div>
      </VendorPortalLayout>
    );
  }

  return (
    <>
      <SEO
        title={`PO ${po.number}`}
        description={`View details for purchase order ${po.number}`}
      />
      <VendorPortalLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/vendor/pos")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{po.number}</h1>
                  <StatusBadge status={po.status} />
                </div>
                <p className="text-muted-foreground">{po.project_name}</p>
              </div>
            </div>
            <Button onClick={() => navigate(`/vendor/bills/new?po=${po.id}`)}>
              <FileText className="h-4 w-4 mr-2" />
              Submit Bill
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Original PO</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(po.total)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Change Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(po.total_addendum_amount || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Billed to Date</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(po.billed_to_date)}</p>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Remaining to Bill</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{formatCurrency(po.remaining_to_bill)}</p>
              </CardContent>
            </Card>
          </div>

          {/* PO Details */}
          <Card>
            <CardHeader>
              <CardTitle>Purchase Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{po.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">
                    {po.due_date ? format(new Date(po.due_date), "MMM d, yyyy") : "Not set"}
                  </p>
                </div>
                {po.notes && (
                  <div className="sm:col-span-2">
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="font-medium">{po.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Description</th>
                      <th className="text-right py-2 font-medium">Qty</th>
                      <th className="text-right py-2 font-medium">Unit Price</th>
                      <th className="text-right py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.po_line_items?.map((item: any) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-2">{item.description}</td>
                        <td className="text-right py-2">{item.quantity}</td>
                        <td className="text-right py-2">{formatCurrency(item.unit_price)}</td>
                        <td className="text-right py-2 font-medium">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td colSpan={3} className="text-right py-2">Subtotal</td>
                      <td className="text-right py-2">{formatCurrency(po.subtotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Change Orders / Addendums */}
          {po.po_addendums && po.po_addendums.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Change Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {po.po_addendums.map((addendum: any) => (
                    <div key={addendum.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{addendum.number || 'Addendum'}</p>
                        <p className="text-sm text-muted-foreground">{addendum.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(addendum.amount)}</p>
                        <StatusBadge status={addendum.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </VendorPortalLayout>
    </>
  );
}

```

### `src/pages/vendor-portal/VendorPOsList.tsx`

```tsx
import { SEO } from "@/components/SEO";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import { VendorPortalLayout } from "@/components/vendor-portal/VendorPortalLayout";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import {
  useVendorPurchaseOrders,
  VendorPurchaseOrder,
} from "@/integrations/supabase/hooks/useVendorPortal";

export default function VendorPOsList() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");

  const { data: purchaseOrders, isLoading } = useVendorPurchaseOrders();

  const filteredPOs = useMemo(() => {
    if (!purchaseOrders) return [];
    if (!search) return purchaseOrders;
    
    const searchLower = search.toLowerCase();
    return purchaseOrders.filter(
      (po) =>
        po.number.toLowerCase().includes(searchLower) ||
        po.project_name.toLowerCase().includes(searchLower) ||
        po.customer_name.toLowerCase().includes(searchLower)
    );
  }, [purchaseOrders, search]);

  const columns: Column<VendorPurchaseOrder>[] = useMemo(
    () => [
      { key: "number", header: "PO #" },
      { key: "project_name", header: "Project" },
      { key: "customer_name", header: "Customer" },
      {
        key: "status",
        header: "Status",
        render: (po) => <StatusBadge status={po.status as any} />,
      },
      {
        key: "revised_total",
        header: "Total Value",
        render: (po) => (
          <span className="font-medium">
            {formatCurrency(po.revised_total)}
          </span>
        ),
      },
      {
        key: "billed_to_date",
        header: "Billed",
        render: (po) => (
          <span className="text-muted-foreground">
            {formatCurrency(po.billed_to_date)}
          </span>
        ),
      },
      {
        key: "remaining_to_bill",
        header: "Remaining",
        render: (po) => (
          <span className="text-primary font-semibold">
            {formatCurrency(po.remaining_to_bill)}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <>
      <SEO
        title="My Purchase Orders"
        description="View all your assigned purchase orders."
      />
      <VendorPortalLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">My Purchase Orders</h1>
            <p className="text-muted-foreground">View all your assigned purchase orders and billing progress.</p>
          </div>

          <div className="max-w-sm">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search POs..."
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading purchase orders...
            </div>
          ) : filteredPOs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "No purchase orders match your search." : "No purchase orders assigned to you yet."}
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {filteredPOs.map((po) => (
                <Card
                  key={po.id}
                  className="p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => navigate(`/vendor/pos/${po.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-medium text-foreground">
                        {po.number}
                      </span>
                      <p className="text-sm text-muted-foreground">
                        {po.project_name}
                      </p>
                    </div>
                    <StatusBadge status={po.status as any} />
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                      Remaining: {formatCurrency(po.remaining_to_bill)}
                    </span>
                    <span className="text-primary font-semibold">
                      {formatCurrency(po.revised_total)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <DataTable
              data={filteredPOs}
              columns={columns}
              onRowClick={(po) => navigate(`/vendor/pos/${po.id}`)}
            />
          )}
        </div>
      </VendorPortalLayout>
    </>
  );
}

```

### `src/pages/vendor-portal/VendorSettings.tsx`

```tsx
import { VendorPortalLayout } from "@/components/vendor-portal/VendorPortalLayout";
import { useCurrentVendor } from "@/integrations/supabase/hooks/useVendorPortal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Building2 } from "lucide-react";
import { DeleteAccountSection } from "@/components/settings/DeleteAccountSection";

export default function VendorSettings() {
  const { data: vendor, isLoading } = useCurrentVendor();

  if (isLoading) {
    return (
      <VendorPortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </VendorPortalLayout>
    );
  }

  return (
    <VendorPortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>

        {/* Profile Info Card */}
        {vendor && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Your vendor details (contact admin to make changes)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {vendor.company && (
                  <div>
                    <p className="text-sm text-muted-foreground">Company</p>
                    <p className="font-medium">{vendor.company}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{vendor.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{vendor.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{vendor.phone || "Not set"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Danger Zone - Account Deletion */}
        <DeleteAccountSection />
      </div>
    </VendorPortalLayout>
  );
}

```

## Vendor Portal — Components

### `src/components/vendor-portal/VendorPortalLayout.tsx`

```tsx
import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Home, 
  ClipboardList, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentVendor } from "@/integrations/supabase/hooks/useVendorPortal";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile, useIsWideTablet } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

const navItems = [
  { href: "/vendor", label: "Dashboard", icon: Home },
  { href: "/vendor/pos", label: "My POs", icon: ClipboardList },
  { href: "/vendor/bills", label: "My Bills", icon: FileText },
  { href: "/vendor/settings", label: "Settings", icon: Settings },
];

interface VendorPortalLayoutProps {
  children: ReactNode;
}

export function VendorPortalLayout({ children }: VendorPortalLayoutProps) {
  const { signOut } = useAuth();
  const location = useLocation();
  const { data: vendor } = useCurrentVendor();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const isMobile = useIsMobile();
  const isWideTablet = useIsWideTablet();

  // On tablet, default to collapsed sidebar for more content space
  const isCollapsed = isWideTablet ? sidebarCollapsed : false;
  const sidebarWidth = isCollapsed ? "w-16" : "w-64";
  const mainMargin = isCollapsed ? "md:ml-16" : "md:ml-64";

  const NavContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <div className="flex flex-col h-full">
      <div className={cn("p-4 border-b", collapsed && "px-2 py-4")}>
        {!collapsed ? (
          <>
            <h2 className="font-semibold text-lg">Vendor Portal</h2>
            {vendor && (
              <p className="text-sm text-muted-foreground truncate">
                {vendor.name}
              </p>
            )}
          </>
        ) : (
          <div className="flex justify-center">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-semibold text-sm">
                {vendor?.name?.charAt(0) || "V"}
              </span>
            </div>
          </div>
        )}
      </div>
      
      <nav className={cn("flex-1 p-4 space-y-1", collapsed && "px-2")}>
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== "/vendor" && location.pathname.startsWith(item.href));
            const Icon = item.icon;
            
            const linkContent = (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md text-sm font-medium transition-colors min-h-[44px]",
                  collapsed ? "justify-center px-2 py-3" : "px-3 py-2",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-muted"
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </TooltipProvider>
      </nav>
      
      <div className={cn("p-4 border-t", collapsed && "px-2")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="w-full min-h-[44px]"
                onClick={signOut}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign Out</TooltipContent>
          </Tooltip>
        ) : (
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 min-h-[44px]"
            onClick={signOut}
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Desktop/Tablet Sidebar */}
        {!isMobile && (
          <aside className={cn(
            "fixed inset-y-0 left-0 flex flex-col border-r bg-card transition-all duration-300 z-30",
            sidebarWidth
          )}>
            <NavContent collapsed={isCollapsed} />
            
            {/* Collapse toggle for tablets */}
            {isWideTablet && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute -right-3 top-20 h-6 w-6 rounded-full border bg-card shadow-md"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronLeft className="h-3 w-3" />
                )}
              </Button>
            )}
          </aside>
        )}
        
        {/* Mobile Header */}
        {isMobile && (
          <header className="sticky top-0 z-50 flex items-center justify-between p-4 border-b bg-card">
            <h2 className="font-semibold">Vendor Portal</h2>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <NavContent />
              </SheetContent>
            </Sheet>
          </header>
        )}
        
        {/* Main Content */}
        <main className={cn(
          "min-h-screen transition-all duration-300",
          !isMobile && mainMargin
        )}>
          <div className="p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

```

### `src/components/vendor-portal/VendorProtectedRoute.tsx`

```tsx
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentVendor } from "@/integrations/supabase/hooks/useVendorPortal";
import { Loader2 } from "lucide-react";

interface VendorProtectedRouteProps {
  children: ReactNode;
}

export function VendorProtectedRoute({ children }: VendorProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { data: vendor, isLoading: vendorLoading } = useCurrentVendor();

  if (authLoading || vendorLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/vendor/login" replace />;
  }

  if (!vendor) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">
            Your account is not linked to a vendor record.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

```

## Subcontractor Portal — Pages

### `src/pages/subcontractor-portal/SubcontractorBillDetail.tsx`

```tsx
import { SEO } from "@/components/SEO";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubcontractorPortalLayout } from "@/components/subcontractor-portal/SubcontractorPortalLayout";
import { useNavigate, useParams } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";
import { formatLocalDate } from "@/lib/dateUtils";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useSubcontractorBill } from "@/integrations/supabase/hooks/useSubcontractorPortal";

export default function SubcontractorBillDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data: bill, isLoading } = useSubcontractorBill(id);

  if (isLoading) {
    return (
      <SubcontractorPortalLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </SubcontractorPortalLayout>
    );
  }

  if (!bill) {
    return (
      <SubcontractorPortalLayout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Bill not found.</p>
          <Button
            variant="ghost"
            onClick={() => navigate("/subcontractor/bills")}
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Bills
          </Button>
        </div>
      </SubcontractorPortalLayout>
    );
  }

  const poInfo = bill.purchase_orders as any;

  return (
    <>
      <SEO title={`Bill ${bill.number}`} description="Bill details" />
      <SubcontractorPortalLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/subcontractor/bills")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{bill.number}</h1>
                <StatusBadge status={bill.status as any} />
              </div>
              <p className="text-muted-foreground">
                PO: {poInfo?.number} • {poInfo?.project_name}
              </p>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Bill Total</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(bill.total || 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Paid Amount</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(bill.paid_amount || 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p
                  className={`text-2xl font-bold ${
                    (bill.remaining_amount || 0) > 0 ? "text-destructive" : ""
                  }`}
                >
                  {formatCurrency(bill.remaining_amount || 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="text-2xl font-bold">
                  {formatLocalDate(bill.due_date)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Line Items</CardTitle>
              </CardHeader>
              <CardContent>
                {bill.vendor_bill_line_items &&
                bill.vendor_bill_line_items.length > 0 ? (
                  <div className="space-y-3">
                    {bill.vendor_bill_line_items.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-start border-b pb-2 last:border-0"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {item.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} × {formatCurrency(item.unit_cost)}
                          </p>
                        </div>
                        <p className="font-medium">
                          {formatCurrency(item.total)}
                        </p>
                      </div>
                    ))}
                    <div className="pt-2 border-t flex justify-between">
                      <span className="font-medium">Total</span>
                      <span className="font-bold">
                        {formatCurrency(bill.total)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No line items.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Payment History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                {bill.vendor_bill_payments &&
                bill.vendor_bill_payments.length > 0 ? (
                  <div className="space-y-3">
                    {bill.vendor_bill_payments.map((payment: any) => (
                      <div
                        key={payment.id}
                        className="flex justify-between items-start border-b pb-2 last:border-0"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {formatLocalDate(payment.payment_date)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {payment.payment_method}
                            {payment.reference_number &&
                              ` • Ref: ${payment.reference_number}`}
                          </p>
                        </div>
                        <p className="font-medium text-green-600">
                          +{formatCurrency(payment.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No payments recorded yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {bill.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{bill.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </SubcontractorPortalLayout>
    </>
  );
}

```

### `src/pages/subcontractor-portal/SubcontractorBillsList.tsx`

```tsx
import { SEO } from "@/components/SEO";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubcontractorPortalLayout } from "@/components/subcontractor-portal/SubcontractorPortalLayout";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/utils";
import { formatLocalDate } from "@/lib/dateUtils";
import { FileText, Search } from "lucide-react";
import {
  useSubcontractorBills,
  SubcontractorBill,
} from "@/integrations/supabase/hooks/useSubcontractorPortal";

export default function SubcontractorBillsList() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");

  const { data: bills, isLoading } = useSubcontractorBills();

  const filteredBills = useMemo(() => {
    if (!bills) return [];
    if (!search) return bills;
    
    const lower = search.toLowerCase();
    return bills.filter(
      (bill) =>
        bill.number.toLowerCase().includes(lower) ||
        bill.po_number.toLowerCase().includes(lower)
    );
  }, [bills, search]);

  const columns: Column<SubcontractorBill>[] = useMemo(
    () => [
      { key: "number", header: "Bill #" },
      { key: "po_number", header: "PO #" },
      {
        key: "bill_date",
        header: "Date",
        render: (bill) => formatLocalDate(bill.bill_date, "MMM d, yyyy"),
      },
      {
        key: "status",
        header: "Status",
        render: (bill) => <StatusBadge status={bill.status as any} />,
      },
      {
        key: "total",
        header: "Amount",
        render: (bill) => formatCurrency(bill.total),
      },
      {
        key: "paid_amount",
        header: "Paid",
        render: (bill) => formatCurrency(bill.paid_amount || 0),
      },
      {
        key: "remaining_amount",
        header: "Remaining",
        render: (bill) => (
          <span className={bill.remaining_amount > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
            {formatCurrency(bill.remaining_amount || 0)}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <>
      <SEO
        title="My Bills"
        description="View all your submitted bills and payment status."
      />
      <SubcontractorPortalLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">My Bills</h1>
              <p className="text-muted-foreground">View all your submitted bills and track payments.</p>
            </div>
            <Button onClick={() => navigate("/subcontractor/bills/new")}>
              <FileText className="h-4 w-4 mr-2" />
              {!isMobile && "New Bill"}
            </Button>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredBills.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "No bills match your search." : "You haven't submitted any bills yet."}
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {filteredBills.map((bill) => (
                <Card
                  key={bill.id}
                  className="p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => navigate(`/subcontractor/bills/${bill.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-medium text-foreground">{bill.number}</span>
                      <p className="text-sm text-muted-foreground">PO: {bill.po_number}</p>
                    </div>
                    <StatusBadge status={bill.status as any} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Total</p>
                      <p className="font-medium">{formatCurrency(bill.total)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Paid</p>
                      <p className="font-medium">{formatCurrency(bill.paid_amount || 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Due</p>
                      <p className={bill.remaining_amount > 0 ? "font-medium text-destructive" : "font-medium"}>
                        {formatCurrency(bill.remaining_amount || 0)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <DataTable
              data={filteredBills}
              columns={columns}
              onRowClick={(bill) => navigate(`/subcontractor/bills/${bill.id}`)}
            />
          )}
        </div>
      </SubcontractorPortalLayout>
    </>
  );
}

```

### `src/pages/subcontractor-portal/SubcontractorCompletionDetail.tsx`

```tsx
import { useParams } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { SubcontractorPortalLayout } from "@/components/subcontractor-portal/SubcontractorPortalLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useContractorCompletionBill } from "@/integrations/supabase/hooks/useContractorCompletions";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  submitted: { label: "Submitted", variant: "outline", icon: Clock },
  field_verified: { label: "Field Verified", variant: "secondary", icon: CheckCircle2 },
  pm_approved: { label: "PM Approved", variant: "secondary", icon: CheckCircle2 },
  accounting_approved: { label: "Approved for Payment", variant: "default", icon: CheckCircle2 },
  paid: { label: "Paid", variant: "default", icon: CheckCircle2 },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
};

export default function SubcontractorCompletionDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: bill, isLoading } = useContractorCompletionBill(id);

  if (isLoading) {
    return (
      <SubcontractorPortalLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </SubcontractorPortalLayout>
    );
  }

  if (!bill) {
    return (
      <SubcontractorPortalLayout>
        <Card className="p-8 text-center text-muted-foreground">
          Completion bill not found.
        </Card>
      </SubcontractorPortalLayout>
    );
  }

  const config = statusConfig[bill.status] || statusConfig.submitted;
  const StatusIcon = config.icon;

  const timelineSteps = [
    { label: "Submitted", date: bill.submitted_at, done: true },
    { label: "Field Verified", date: bill.verified_at, done: !!bill.verified_at },
    { label: "PM Approved", date: bill.approved_at, done: !!bill.approved_at },
    { label: "Payment Processed", date: bill.accounting_approved_at, done: !!bill.accounting_approved_at },
    { label: "Paid", date: bill.paid_at, done: !!bill.paid_at },
  ];

  return (
    <>
      <SEO title={`Completion - Unit ${bill.room_unit_number}`} />
      <SubcontractorPortalLayout>
        <div className="space-y-6 max-w-3xl">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                Unit {bill.room_unit_number}
              </h1>
              <p className="text-muted-foreground">{bill.project_name}</p>
            </div>
            <Badge variant={config.variant} className="gap-1">
              <StatusIcon className="h-3 w-3" />
              {config.label}
            </Badge>
          </div>

          {bill.status === "rejected" && bill.rejection_notes && (
            <Card className="p-4 border-destructive/50 bg-destructive/5">
              <p className="text-sm font-medium text-destructive">Rejection Reason:</p>
              <p className="text-sm text-foreground mt-1">{bill.rejection_notes}</p>
            </Card>
          )}

          {/* Timeline */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Approval Timeline</h3>
            <div className="space-y-3">
              {timelineSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                      step.done
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <span className="text-xs">{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm ${step.done ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                  {step.date && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(step.date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Line Items */}
          <Card>
            <div className="p-4 border-b">
              <h3 className="font-semibold">Line Items</h3>
            </div>
            <div className="divide-y">
              {bill.items?.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {formatCurrency(item.unit_cost)}
                    </p>
                  </div>
                  <span className="font-semibold">{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t bg-muted/30 flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-lg">{formatCurrency(bill.total_amount)}</span>
            </div>
          </Card>
        </div>
      </SubcontractorPortalLayout>
    </>
  );
}

```

### `src/pages/subcontractor-portal/SubcontractorCompletionHistory.tsx`

```tsx
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { SubcontractorPortalLayout } from "@/components/subcontractor-portal/SubcontractorPortalLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useContractorCompletionBills } from "@/integrations/supabase/hooks/useContractorCompletions";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "outline",
  field_verified: "secondary",
  pm_approved: "secondary",
  accounting_approved: "default",
  paid: "default",
  rejected: "destructive",
};

const statusLabel: Record<string, string> = {
  submitted: "Submitted",
  field_verified: "Verified",
  pm_approved: "Approved",
  accounting_approved: "Processing",
  paid: "Paid",
  rejected: "Rejected",
};

export default function SubcontractorCompletionHistory() {
  const navigate = useNavigate();
  const { data: bills, isLoading } = useContractorCompletionBills();

  return (
    <>
      <SEO title="Completion History" />
      <SubcontractorPortalLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Completion History</h1>
            <p className="text-muted-foreground">View all your submitted completions and their status.</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !bills || bills.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No completions submitted yet.
            </Card>
          ) : (
            <div className="space-y-3">
              {bills.map((bill) => (
                <Card
                  key={bill.id}
                  className="p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => navigate(`/subcontractor/completions/${bill.id}`)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="font-medium text-foreground">
                        Unit {bill.room_unit_number}
                      </span>
                      <span className="text-sm text-muted-foreground ml-2">
                        {bill.project_name}
                      </span>
                    </div>
                    <Badge variant={statusVariant[bill.status] || "outline"}>
                      {statusLabel[bill.status] || bill.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {new Date(bill.submitted_at).toLocaleDateString()}
                    </span>
                    <span className="font-semibold text-primary">
                      {formatCurrency(bill.total_amount)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </SubcontractorPortalLayout>
    </>
  );
}

```

### `src/pages/subcontractor-portal/SubcontractorCompletions.tsx`

```tsx
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { SubcontractorPortalLayout } from "@/components/subcontractor-portal/SubcontractorPortalLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle2, Loader2, Building2 } from "lucide-react";
import {
  useContractorRooms,
  useSubmitCompletion,
  ContractorRoom,
  RoomScopeItemWithBilling,
} from "@/integrations/supabase/hooks/useContractorCompletions";
import { toast } from "sonner";

export default function SubcontractorCompletions() {
  const navigate = useNavigate();
  const { data: rooms, isLoading } = useContractorRooms();
  const submitMutation = useSubmitCompletion();

  // Track selected items and quantities per room
  const [selections, setSelections] = useState<
    Record<string, { selected: boolean; quantity: number }>
  >({});

  // Group rooms by project
  const roomsByProject = useMemo(() => {
    if (!rooms) return {};
    const grouped: Record<string, ContractorRoom[]> = {};
    rooms.forEach((room) => {
      const key = room.project_name;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(room);
    });
    return grouped;
  }, [rooms]);

  const toggleItem = (itemId: string, remaining: number) => {
    setSelections((prev) => ({
      ...prev,
      [itemId]: prev[itemId]?.selected
        ? { selected: false, quantity: 0 }
        : { selected: true, quantity: remaining },
    }));
  };

  const updateQuantity = (itemId: string, qty: number) => {
    setSelections((prev) => ({
      ...prev,
      [itemId]: { selected: true, quantity: qty },
    }));
  };

  const getSelectedItemsForRoom = (room: ContractorRoom) => {
    return room.scope_items.filter(
      (item) => selections[item.id]?.selected && selections[item.id]?.quantity > 0
    );
  };

  const handleSubmit = async (room: ContractorRoom) => {
    const selected = getSelectedItemsForRoom(room);
    if (selected.length === 0) {
      toast.error("Please select at least one item to submit");
      return;
    }

    // Validate quantities
    for (const item of selected) {
      const qty = selections[item.id].quantity;
      const remaining = item.allocated_quantity - item.billed_quantity;
      if (qty > remaining) {
        toast.error(
          `Quantity for "${item.scope_description || item.scope_code}" exceeds remaining balance (${remaining})`
        );
        return;
      }
    }

    await submitMutation.mutateAsync({
      room_id: room.id,
      project_id: room.project_id,
      items: selected.map((item) => ({
        room_scope_item_id: item.id,
        job_order_line_item_id: item.job_order_line_item_id,
        description: item.scope_description || item.scope_code || "Scope item",
        quantity: selections[item.id].quantity,
        unit_cost: item.unit_cost,
      })),
    });

    // Clear selections for this room
    const cleared = { ...selections };
    room.scope_items.forEach((item) => delete cleared[item.id]);
    setSelections(cleared);
  };

  const calcRoomTotal = (room: ContractorRoom) => {
    return getSelectedItemsForRoom(room).reduce((sum, item) => {
      return sum + selections[item.id].quantity * item.unit_cost;
    }, 0);
  };

  return (
    <>
      <SEO title="My Rooms" description="View assigned rooms and submit completions." />
      <SubcontractorPortalLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">My Rooms</h1>
              <p className="text-muted-foreground">
                Select completed scope items and submit for billing.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/subcontractor/completions/history")}
            >
              View History
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !rooms || rooms.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No rooms assigned to you yet.</p>
            </Card>
          ) : (
            Object.entries(roomsByProject).map(([projectName, projectRooms]) => (
              <div key={projectName} className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{projectName}</h2>

                {projectRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    selections={selections}
                    onToggle={toggleItem}
                    onQuantityChange={updateQuantity}
                    onSubmit={() => handleSubmit(room)}
                    isSubmitting={submitMutation.isPending}
                    selectedTotal={calcRoomTotal(room)}
                    selectedCount={getSelectedItemsForRoom(room).length}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </SubcontractorPortalLayout>
    </>
  );
}

function RoomCard({
  room,
  selections,
  onToggle,
  onQuantityChange,
  onSubmit,
  isSubmitting,
  selectedTotal,
  selectedCount,
}: {
  room: ContractorRoom;
  selections: Record<string, { selected: boolean; quantity: number }>;
  onToggle: (id: string, remaining: number) => void;
  onQuantityChange: (id: string, qty: number) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  selectedTotal: number;
  selectedCount: number;
}) {
  const hasSelectableItems = room.scope_items.some(
    (item) => item.allocated_quantity - item.billed_quantity > 0
  );

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-semibold text-foreground">
              Unit {room.unit_number}
            </span>
            {room.floor_number && (
              <span className="text-sm text-muted-foreground ml-2">
                Floor {room.floor_number}
              </span>
            )}
          </div>
          <Badge variant="outline">{room.status}</Badge>
        </div>
      </div>

      <div className="divide-y">
        {room.scope_items.map((item) => {
          const remaining = item.allocated_quantity - item.billed_quantity;
          const isFullyBilled = remaining <= 0;
          const isSelected = selections[item.id]?.selected || false;
          const currentQty = selections[item.id]?.quantity || 0;

          return (
            <div
              key={item.id}
              className={`p-3 flex items-center gap-3 ${
                isFullyBilled ? "opacity-60 bg-muted/20" : ""
              }`}
            >
              {isFullyBilled ? (
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              ) : (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggle(item.id, remaining)}
                />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.scope_description || item.scope_code || "Scope Item"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isFullyBilled
                    ? `Fully billed (${item.billed_quantity}/${item.allocated_quantity})`
                    : `${item.billed_quantity}/${item.allocated_quantity} billed • ${remaining} remaining`}
                  {item.unit_cost > 0 && ` • ${formatCurrency(item.unit_cost)}/unit`}
                </p>
              </div>

              {!isFullyBilled && isSelected && (
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    type="number"
                    min={1}
                    max={remaining}
                    value={currentQty}
                    onChange={(e) =>
                      onQuantityChange(
                        item.id,
                        Math.min(Number(e.target.value), remaining)
                      )
                    }
                    className="w-20 h-8 text-sm"
                  />
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(currentQty * item.unit_cost)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasSelectableItems && (
        <div className="p-4 border-t bg-muted/10 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedCount > 0 ? (
              <>
                {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected •{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(selectedTotal)}
                </span>
              </>
            ) : (
              "Select items to submit"
            )}
          </div>
          <Button
            onClick={onSubmit}
            disabled={selectedCount === 0 || isSubmitting}
            size="sm"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Completion
          </Button>
        </div>
      )}
    </Card>
  );
}

```

### `src/pages/subcontractor-portal/SubcontractorDashboard.tsx`

```tsx
import { SEO } from "@/components/SEO";
import { StatCard } from "@/components/dashboard/StatCard";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { SubcontractorPortalLayout } from "@/components/subcontractor-portal/SubcontractorPortalLayout";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/utils";
import {
  FileText,
  DollarSign,
  ClipboardList,
  AlertTriangle,
  Building2,
} from "lucide-react";
import {
  useSubcontractorPurchaseOrders,
  useSubcontractorBills,
  useSubcontractorBackCharges,
  SubcontractorPurchaseOrder,
  SubcontractorBill,
} from "@/integrations/supabase/hooks/useSubcontractorPortal";
import { useContractorRooms } from "@/integrations/supabase/hooks/useContractorCompletions";

export default function SubcontractorDashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const {
    data: purchaseOrders,
    isLoading: poLoading,
    refetch: refetchPOs,
    isFetching: isFetchingPOs,
  } = useSubcontractorPurchaseOrders();

  const {
    data: bills,
    isLoading: billsLoading,
    refetch: refetchBills,
    isFetching: isFetchingBills,
  } = useSubcontractorBills();

  const {
    data: backCharges,
    isLoading: backChargesLoading,
    refetch: refetchBackCharges,
    isFetching: isFetchingBackCharges,
  } = useSubcontractorBackCharges();

  const { data: rooms, isLoading: roomsLoading } = useContractorRooms();

  const handleRefresh = async () => {
    await Promise.all([refetchPOs(), refetchBills(), refetchBackCharges()]);
  };

  const isRefreshing = isFetchingPOs || isFetchingBills || isFetchingBackCharges;
  const isLoading = poLoading || billsLoading || backChargesLoading;

  const stats = useMemo(() => {
    if (!purchaseOrders || !bills) {
      return {
        openPOs: 0,
        totalContractValue: 0,
        billedToDate: 0,
        remainingToBill: 0,
        totalBackCharges: 0,
        pendingBills: 0,
        paidBills: 0,
      };
    }

    const openPOs = purchaseOrders.filter((po) => 
      po.status !== "closed" && po.status !== "cancelled"
    ).length;

    const totalContractValue = purchaseOrders.reduce(
      (sum, po) => sum + (po.revised_total ?? 0),
      0
    );

    const billedToDate = purchaseOrders.reduce(
      (sum, po) => sum + (po.billed_to_date ?? 0),
      0
    );

    const remainingToBill = purchaseOrders.reduce(
      (sum, po) => sum + (po.remaining_to_bill ?? 0),
      0
    );

    const totalBackCharges = backCharges?.reduce(
      (sum, charge) => sum + charge.amount,
      0
    ) || 0;

    const pendingBills = bills.filter(
      (b) => b.status === "open" || b.status === "draft"
    ).length;

    const paidBills = bills.filter((b) => b.status === "paid").length;

    return {
      openPOs,
      totalContractValue,
      billedToDate,
      remainingToBill,
      totalBackCharges,
      pendingBills,
      paidBills,
    };
  }, [purchaseOrders, bills, backCharges]);

  const recentPOs = useMemo(
    () => purchaseOrders?.slice(0, 5) ?? [],
    [purchaseOrders]
  );

  const recentBills = useMemo(
    () => bills?.slice(0, 5) ?? [],
    [bills]
  );

  const poColumns: Column<SubcontractorPurchaseOrder>[] = useMemo(
    () => [
      { key: "number", header: "PO #" },
      { key: "project_name", header: "Project" },
      {
        key: "status",
        header: "Status",
        render: (po) => <StatusBadge status={po.status as any} />,
      },
      {
        key: "remaining_to_bill",
        header: "Remaining",
        render: (po) => (
          <span className="text-primary font-semibold">
            {formatCurrency(po.remaining_to_bill)}
          </span>
        ),
      },
    ],
    []
  );

  const billColumns: Column<SubcontractorBill>[] = useMemo(
    () => [
      { key: "number", header: "Bill #" },
      { key: "po_number", header: "PO #" },
      {
        key: "status",
        header: "Status",
        render: (bill) => <StatusBadge status={bill.status as any} />,
      },
      {
        key: "total",
        header: "Amount",
        render: (bill) => (
          <span className="font-medium">{formatCurrency(bill.total)}</span>
        ),
      },
    ],
    []
  );

  return (
    <>
      <SEO
        title="Subcontractor Dashboard"
        description="View your purchase orders, back charges, and billing status."
        keywords="subcontractor portal, purchase orders, billing, back charges"
      />
      <SubcontractorPortalLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground">View your POs, billing progress, and back charges.</p>
            </div>
            <Button
              onClick={() => navigate("/subcontractor/bills/new")}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              {!isMobile && "New Bill"}
            </Button>
          </div>
          
          <PullToRefreshWrapper
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          >
            {/* Stats */}
            <div className="grid gap-3 sm:gap-6 grid-cols-2 md:grid-cols-5 mb-4 sm:mb-8">
              <div className="cursor-pointer" onClick={() => navigate("/subcontractor/completions")}>
                <StatCard
                  title="My Rooms"
                  value={roomsLoading ? "..." : rooms?.length ?? 0}
                  change="Assigned units"
                  changeType="neutral"
                  icon={Building2}
                />
              </div>
              <StatCard
                title="Open POs"
                value={isLoading ? "..." : stats.openPOs}
                change={`${purchaseOrders?.length ?? 0} total POs`}
                changeType="neutral"
                icon={ClipboardList}
              />
              <StatCard
                title="Contract Value"
                value={isLoading ? "..." : formatCurrency(stats.totalContractValue)}
                change={`Billed ${formatCurrency(stats.billedToDate)}`}
                changeType="positive"
                icon={DollarSign}
              />
              <StatCard
                title="Remaining to Bill"
                value={isLoading ? "..." : formatCurrency(stats.remainingToBill)}
                change="Based on approved POs"
                changeType="neutral"
                icon={FileText}
              />
              <StatCard
                title="Back Charges"
                value={isLoading ? "..." : formatCurrency(stats.totalBackCharges)}
                change={stats.totalBackCharges > 0 ? "Applied to POs" : "No back charges"}
                changeType={stats.totalBackCharges > 0 ? "negative" : "neutral"}
                icon={AlertTriangle}
              />
            </div>

            {/* Recent POs + Bills */}
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
              {/* Recent POs */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base sm:text-lg font-semibold text-foreground">
                    Your Purchase Orders
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/subcontractor/purchase-orders")}
                    className="text-xs sm:text-sm"
                  >
                    View all
                  </Button>
                </div>

                {isLoading ? (
                  <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                    Loading POs...
                  </div>
                ) : recentPOs.length === 0 ? (
                  <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                    No POs assigned to you yet.
                  </div>
                ) : isMobile ? (
                  <div className="space-y-3">
                    {recentPOs.map((po) => (
                      <Card
                        key={po.id}
                        className="p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => navigate(`/subcontractor/purchase-orders/${po.id}`)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-medium text-foreground">{po.number}</span>
                            <p className="text-sm text-muted-foreground">{po.project_name}</p>
                          </div>
                          <StatusBadge status={po.status as any} />
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">
                            Remaining: {formatCurrency(po.remaining_to_bill ?? 0)}
                          </span>
                          <span className="text-primary font-semibold">
                            {formatCurrency(po.revised_total ?? 0)}
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <DataTable
                    data={recentPOs}
                    columns={poColumns}
                    onRowClick={(po) => navigate(`/subcontractor/purchase-orders/${po.id}`)}
                  />
                )}
              </div>

              {/* Recent Bills */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base sm:text-lg font-semibold text-foreground">
                    Your Bills
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/subcontractor/bills")}
                    className="text-xs sm:text-sm"
                  >
                    View all
                  </Button>
                </div>

                {isLoading ? (
                  <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                    Loading bills...
                  </div>
                ) : recentBills.length === 0 ? (
                  <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                    You haven't submitted any bills yet.
                  </div>
                ) : isMobile ? (
                  <div className="space-y-3">
                    {recentBills.map((bill) => (
                      <Card
                        key={bill.id}
                        className="p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => navigate(`/subcontractor/bills/${bill.id}`)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-medium text-foreground">{bill.number}</span>
                            <p className="text-sm text-muted-foreground">PO: {bill.po_number}</p>
                          </div>
                          <StatusBadge status={bill.status as any} />
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">
                            {bill.submitted_at
                              ? new Date(bill.submitted_at).toLocaleDateString()
                              : "Not submitted"}
                          </span>
                          <span className="text-primary font-semibold">
                            {formatCurrency(bill.total)}
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <DataTable
                    data={recentBills}
                    columns={billColumns}
                    onRowClick={(bill) => navigate(`/subcontractor/bills/${bill.id}`)}
                  />
                )}
              </div>
            </div>
          </PullToRefreshWrapper>
        </div>
      </SubcontractorPortalLayout>
    </>
  );
}

```

### `src/pages/subcontractor-portal/SubcontractorLogin.tsx`

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, HardHat } from "lucide-react";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { NetworkErrorBanner } from "@/components/auth/NetworkErrorBanner";
import { withTimeout, isNetworkError, classifyNetworkError } from "@/utils/authNetwork";

export default function SubcontractorLogin() {
  const navigate = useNavigate();
  const { signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [showNetworkError, setShowNetworkError] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setShowNetworkError(false);

    try {
      console.info(`[SubcontractorLogin] signIn: start | origin: ${window.location.origin}`);

      const signInPromise = supabase.auth.signInWithPassword({
        email,
        password,
      });

      const { error } = await withTimeout(signInPromise, 15000, "Sign in");

      if (error) throw error;

      console.info("[SubcontractorLogin] signIn: success, checking contractor link");
      
      // Check if user is linked to a contractor
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: vendor } = await supabase
          .from("vendors")
          .select("id, vendor_type")
          .eq("user_id", user.id)
          .eq("vendor_type", "contractor")
          .single();

        if (vendor) {
          navigate("/subcontractor");
        } else {
          toast.error("Your account is not linked to a subcontractor record");
          await supabase.auth.signOut();
        }
      }
    } catch (error: unknown) {
      console.error("[SubcontractorLogin] signIn: exception", error);
      if (isNetworkError(error)) {
        const networkErr = classifyNetworkError(error);
        setShowNetworkError(true);
        toast.error(networkErr.userMessage);
      } else {
        toast.error((error as Error).message || "Failed to sign in");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setShowNetworkError(false);
    if (email && password) {
      handleLogin();
    }
  };

  const handleGoogleLogin = async () => {
    setIsOAuthLoading(true);
    setShowNetworkError(false);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        if (isNetworkError(error) || error.message.includes("Can't reach")) {
          setShowNetworkError(true);
        }
        throw error;
      }
      // AuthCallback will handle the redirect
    } catch (error: unknown) {
      toast.error((error as Error).message || "Failed to sign in with Google");
      setIsOAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
            <HardHat className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Subcontractor Portal</CardTitle>
          <CardDescription>
            Sign in to view your purchase orders, submit bills, and track payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isOAuthLoading || loading}
            >
              {isOAuthLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <GoogleIcon className="h-4 w-4 mr-2" />
              )}
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={loading || isOAuthLoading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Sign In
              </Button>
            </form>
          </div>

          {/* Network Error Banner */}
          {showNetworkError && (
            <NetworkErrorBanner onRetry={handleRetry} isRetrying={loading} />
          )}
          
          <p className="text-sm text-center text-muted-foreground mt-6">
            Don't have an account? Contact your administrator to receive an invitation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

```

### `src/pages/subcontractor-portal/SubcontractorNewBill.tsx`

```tsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubcontractorPortalLayout } from "@/components/subcontractor-portal/SubcontractorPortalLayout";
import { POBackChargesDisplay } from "@/components/subcontractor-portal/POBackChargesDisplay";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
import {
  useSubcontractorPurchaseOrders,
  useSubcontractorPurchaseOrder,
  usePOBackCharges,
  useCreateSubcontractorBill,
} from "@/integrations/supabase/hooks/useSubcontractorPortal";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_cost: number;
  total: number;
  po_line_item_id?: string;
}

export default function SubcontractorNewBill() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPO = searchParams.get("po");

  const [selectedPOId, setSelectedPOId] = useState(preselectedPO || "");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, unit_cost: 0, total: 0 },
  ]);

  const { data: purchaseOrders, isLoading: posLoading } = useSubcontractorPurchaseOrders();
  const { data: selectedPO } = useSubcontractorPurchaseOrder(selectedPOId || undefined);
  const { data: backCharges } = usePOBackCharges(selectedPOId || undefined);
  const createBill = useCreateSubcontractorBill();

  // Set default due date to 30 days from bill date
  useEffect(() => {
    if (billDate) {
      const due = new Date(billDate);
      due.setDate(due.getDate() + 30);
      setDueDate(due.toISOString().split("T")[0]);
    }
  }, [billDate]);

  const availablePOs = purchaseOrders?.filter(
    (po) => po.status !== "closed" && po.status !== "cancelled" && po.remaining_to_bill > 0
  ) || [];

  const totalBackCharges = backCharges?.reduce((sum, c) => sum + c.amount, 0) || 0;
  const netRemaining = selectedPO ? (selectedPO.remaining_to_bill || 0) - totalBackCharges : 0;

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: crypto.randomUUID(), description: "", quantity: 1, unit_cost: 0, total: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "unit_cost") {
          updated.total = updated.quantity * updated.unit_cost;
        }
        return updated;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPOId) return;
    if (lineItems.some((item) => !item.description)) {
      return;
    }

    await createBill.mutateAsync({
      purchase_order_id: selectedPOId,
      bill_date: billDate,
      due_date: dueDate,
      notes: notes || undefined,
      line_items: lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total: item.total,
        po_line_item_id: item.po_line_item_id,
      })),
    });

    navigate("/subcontractor/bills");
  };

  return (
    <>
      <SEO title="Create New Bill" description="Submit a new bill against a purchase order." />
      <SubcontractorPortalLayout>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => navigate("/subcontractor/bills")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Create New Bill</h1>
              <p className="text-muted-foreground">Submit a bill against one of your purchase orders.</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* PO Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Select Purchase Order</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedPOId} onValueChange={setSelectedPOId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a PO to bill against" />
                    </SelectTrigger>
                    <SelectContent>
                      {posLoading ? (
                        <SelectItem value="__loading__" disabled>Loading...</SelectItem>
                      ) : availablePOs.length === 0 ? (
                        <SelectItem value="__empty__" disabled>No POs available to bill</SelectItem>
                      ) : (
                        availablePOs.map((po) => (
                          <SelectItem key={po.id} value={po.id}>
                            {po.number} - {po.project_name} ({formatCurrency(po.remaining_to_bill)} remaining)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Bill Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Bill Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="billDate">Bill Date</Label>
                      <Input
                        id="billDate"
                        type="date"
                        value={billDate}
                        onChange={(e) => setBillDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dueDate">Due Date</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes about this bill..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Line Items */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Line Items</CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {lineItems.map((item, index) => (
                    <div key={item.id} className="grid gap-3 sm:grid-cols-12 items-end border-b pb-4 last:border-0">
                      <div className="sm:col-span-5 space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                          placeholder="Work description"
                          required
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs">Unit Cost</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) => updateLineItem(item.id, "unit_cost", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs">Total</Label>
                        <Input value={formatCurrency(item.total)} disabled />
                      </div>
                      <div className="sm:col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(item.id)}
                          disabled={lineItems.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  <div className="pt-4 border-t flex justify-between items-center">
                    <span className="font-medium">Subtotal</span>
                    <span className="text-xl font-bold">{formatCurrency(subtotal)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* PO Summary */}
              {selectedPO && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">PO Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Original Total</span>
                      <span>{formatCurrency(selectedPO.total || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Addendums</span>
                      <span>{formatCurrency(selectedPO.total_addendum_amount || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Billed to Date</span>
                      <span>{formatCurrency(selectedPO.billed_to_date || 0)}</span>
                    </div>
                    {totalBackCharges > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Back Charges</span>
                        <span className="text-destructive">-{formatCurrency(totalBackCharges)}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t flex justify-between">
                      <span className="font-medium">Available to Bill</span>
                      <span className="font-bold text-primary">{formatCurrency(netRemaining)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Back Charges */}
              {selectedPOId && backCharges && backCharges.length > 0 && (
                <POBackChargesDisplay backCharges={backCharges} showTotal={false} />
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="w-full"
                disabled={!selectedPOId || subtotal <= 0 || createBill.isPending}
              >
                {createBill.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Bill
              </Button>
            </div>
          </div>
        </form>
      </SubcontractorPortalLayout>
    </>
  );
}

```

### `src/pages/subcontractor-portal/SubcontractorPODetail.tsx`

```tsx
import { SEO } from "@/components/SEO";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubcontractorPortalLayout } from "@/components/subcontractor-portal/SubcontractorPortalLayout";
import { POBackChargesDisplay } from "@/components/subcontractor-portal/POBackChargesDisplay";
import { useNavigate, useParams } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import {
  useSubcontractorPurchaseOrder,
  usePOBackCharges,
} from "@/integrations/supabase/hooks/useSubcontractorPortal";

export default function SubcontractorPODetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data: po, isLoading: poLoading } = useSubcontractorPurchaseOrder(id);
  const { data: backCharges, isLoading: backChargesLoading } = usePOBackCharges(id);

  const isLoading = poLoading || backChargesLoading;

  if (isLoading) {
    return (
      <SubcontractorPortalLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </SubcontractorPortalLayout>
    );
  }

  if (!po) {
    return (
      <SubcontractorPortalLayout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Purchase order not found.</p>
          <Button
            variant="ghost"
            onClick={() => navigate("/subcontractor/purchase-orders")}
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to POs
          </Button>
        </div>
      </SubcontractorPortalLayout>
    );
  }

  const totalBackCharges = backCharges?.reduce((sum, c) => sum + c.amount, 0) || 0;
  const netRemaining = (po.remaining_to_bill || 0) - totalBackCharges;

  return (
    <>
      <SEO title={`PO ${po.number}`} description="Purchase order details" />
      <SubcontractorPortalLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/subcontractor/purchase-orders")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{po.number}</h1>
                  <StatusBadge status={po.status as any} />
                </div>
                <p className="text-muted-foreground">{po.project_name}</p>
              </div>
            </div>
            <Button
              onClick={() => navigate(`/subcontractor/bills/new?po=${id}`)}
              disabled={netRemaining <= 0}
            >
              <FileText className="h-4 w-4 mr-2" />
              Create Bill
            </Button>
          </div>

          {/* Financial Summary */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Original Total</p>
                <p className="text-2xl font-bold">{formatCurrency(po.total || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Addendums</p>
                <p className="text-2xl font-bold">{formatCurrency(po.total_addendum_amount || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Billed to Date</p>
                <p className="text-2xl font-bold">{formatCurrency(po.billed_to_date || 0)}</p>
              </CardContent>
            </Card>
            <Card className="border-primary">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Net Remaining</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(netRemaining)}</p>
                {totalBackCharges > 0 && (
                  <p className="text-xs text-destructive">-{formatCurrency(totalBackCharges)} back charges</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Line Items</CardTitle>
              </CardHeader>
              <CardContent>
                {po.po_line_items && po.po_line_items.length > 0 ? (
                  <div className="space-y-3">
                    {po.po_line_items.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-start border-b pb-2 last:border-0">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} × {formatCurrency(item.unit_cost)}
                          </p>
                        </div>
                        <p className="font-medium">{formatCurrency(item.total)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No line items.</p>
                )}
              </CardContent>
            </Card>

            {/* Back Charges */}
            <POBackChargesDisplay backCharges={backCharges || []} />
          </div>

          {/* Addendums */}
          {po.po_addendums && po.po_addendums.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Addendums / Change Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {po.po_addendums.map((addendum: any) => (
                    <div key={addendum.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{addendum.number || "Addendum"}</p>
                          <p className="text-sm text-muted-foreground">{addendum.description}</p>
                        </div>
                        <p className="font-semibold">{formatCurrency(addendum.amount || 0)}</p>
                      </div>
                      {addendum.po_addendum_line_items && addendum.po_addendum_line_items.length > 0 && (
                        <div className="mt-2 pt-2 border-t space-y-1">
                          {addendum.po_addendum_line_items.map((item: any) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{item.description}</span>
                              <span>{formatCurrency(item.total)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </SubcontractorPortalLayout>
    </>
  );
}

```

### `src/pages/subcontractor-portal/SubcontractorPOList.tsx`

```tsx
import { SEO } from "@/components/SEO";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubcontractorPortalLayout } from "@/components/subcontractor-portal/SubcontractorPortalLayout";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/utils";
import { Search } from "lucide-react";
import {
  useSubcontractorPurchaseOrders,
  SubcontractorPurchaseOrder,
} from "@/integrations/supabase/hooks/useSubcontractorPortal";

export default function SubcontractorPOList() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");

  const { data: purchaseOrders, isLoading } = useSubcontractorPurchaseOrders();

  const filteredPOs = useMemo(() => {
    if (!purchaseOrders) return [];
    if (!search) return purchaseOrders;
    
    const lower = search.toLowerCase();
    return purchaseOrders.filter(
      (po) =>
        po.number.toLowerCase().includes(lower) ||
        po.project_name.toLowerCase().includes(lower) ||
        po.customer_name.toLowerCase().includes(lower)
    );
  }, [purchaseOrders, search]);

  const columns: Column<SubcontractorPurchaseOrder>[] = useMemo(
    () => [
      { key: "number", header: "PO #" },
      { key: "project_name", header: "Project" },
      { key: "customer_name", header: "Customer" },
      {
        key: "status",
        header: "Status",
        render: (po) => <StatusBadge status={po.status as any} />,
      },
      {
        key: "revised_total",
        header: "Total",
        render: (po) => formatCurrency(po.revised_total),
      },
      {
        key: "billed_to_date",
        header: "Billed",
        render: (po) => formatCurrency(po.billed_to_date),
      },
      {
        key: "remaining_to_bill",
        header: "Remaining",
        render: (po) => (
          <span className="text-primary font-semibold">
            {formatCurrency(po.remaining_to_bill)}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <>
      <SEO
        title="My Purchase Orders"
        description="View all your assigned purchase orders."
      />
      <SubcontractorPortalLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">My Purchase Orders</h1>
            <p className="text-muted-foreground">View all POs assigned to you and their billing status.</p>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search POs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredPOs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "No POs match your search." : "No purchase orders assigned to you yet."}
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {filteredPOs.map((po) => (
                <Card
                  key={po.id}
                  className="p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => navigate(`/subcontractor/purchase-orders/${po.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-medium text-foreground">{po.number}</span>
                      <p className="text-sm text-muted-foreground">{po.project_name}</p>
                    </div>
                    <StatusBadge status={po.status as any} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Total</p>
                      <p className="font-medium">{formatCurrency(po.revised_total)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Billed</p>
                      <p className="font-medium">{formatCurrency(po.billed_to_date)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Remaining</p>
                      <p className="font-semibold text-primary">{formatCurrency(po.remaining_to_bill)}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <DataTable
              data={filteredPOs}
              columns={columns}
              onRowClick={(po) => navigate(`/subcontractor/purchase-orders/${po.id}`)}
            />
          )}
        </div>
      </SubcontractorPortalLayout>
    </>
  );
}

```

## Subcontractor Portal — Components

### `src/components/subcontractor-portal/POBackChargesDisplay.tsx`

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, MinusCircle, RefreshCw } from "lucide-react";
import { POBackCharge } from "@/integrations/supabase/hooks/useSubcontractorPortal";

interface POBackChargesDisplayProps {
  backCharges: POBackCharge[];
  showTotal?: boolean;
}

const chargeTypeConfig = {
  deduction: {
    label: "Deduction",
    icon: MinusCircle,
    variant: "destructive" as const,
    description: "Quality issues or incomplete work",
  },
  penalty: {
    label: "Penalty",
    icon: AlertTriangle,
    variant: "destructive" as const,
    description: "Late completion or safety violations",
  },
  adjustment: {
    label: "Adjustment",
    icon: RefreshCw,
    variant: "secondary" as const,
    description: "Scope changes or credits",
  },
};

export function POBackChargesDisplay({ backCharges, showTotal = true }: POBackChargesDisplayProps) {
  const totalBackCharges = backCharges.reduce((sum, charge) => sum + charge.amount, 0);
  
  if (backCharges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Back Charges</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No back charges applied to this PO.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Back Charges</CardTitle>
          {showTotal && (
            <span className="text-lg font-bold text-destructive">
              -{formatCurrency(totalBackCharges)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {backCharges.map((charge) => {
          const config = chargeTypeConfig[charge.charge_type];
          const Icon = config.icon;
          
          return (
            <div
              key={charge.id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
            >
              <div className="mt-0.5">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={config.variant} className="text-xs">
                    {config.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(charge.applied_date).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm font-medium">{charge.description}</p>
                {charge.notes && (
                  <p className="text-xs text-muted-foreground mt-1">{charge.notes}</p>
                )}
              </div>
              <div className="text-sm font-semibold text-destructive">
                -{formatCurrency(charge.amount)}
              </div>
            </div>
          );
        })}
        
        {showTotal && backCharges.length > 1 && (
          <div className="pt-2 border-t flex justify-between items-center">
            <span className="text-sm font-medium">Total Back Charges</span>
            <span className="text-base font-bold text-destructive">
              -{formatCurrency(totalBackCharges)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

```

### `src/components/subcontractor-portal/SubcontractorPortalLayout.tsx`

```tsx
import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Home, 
  ClipboardList, 
  FileText, 
  LogOut,
  Menu,
  HardHat
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentSubcontractor } from "@/integrations/supabase/hooks/useSubcontractorPortal";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { href: "/subcontractor", label: "Dashboard", icon: Home },
  { href: "/subcontractor/completions", label: "My Rooms", icon: HardHat },
  { href: "/subcontractor/purchase-orders", label: "My POs", icon: ClipboardList },
  { href: "/subcontractor/bills", label: "My Bills", icon: FileText },
];

interface SubcontractorPortalLayoutProps {
  children: ReactNode;
}

export function SubcontractorPortalLayout({ children }: SubcontractorPortalLayoutProps) {
  const { signOut } = useAuth();
  const location = useLocation();
  const { data: subcontractor } = useCurrentSubcontractor();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-1">
          <HardHat className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Subcontractor Portal</h2>
        </div>
        {subcontractor && (
          <p className="text-sm text-muted-foreground">
            {subcontractor.name}
          </p>
        )}
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== "/subcontractor" && location.pathname.startsWith(item.href));
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t">
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-64 md:flex-col border-r bg-card">
        <NavContent />
      </aside>
      
      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-50 flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-2">
          <HardHat className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Subcontractor Portal</h2>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <NavContent />
          </SheetContent>
        </Sheet>
      </header>
      
      {/* Main Content */}
      <main className="md:ml-64 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

```

### `src/components/subcontractor-portal/SubcontractorProtectedRoute.tsx`

```tsx
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentSubcontractor } from "@/integrations/supabase/hooks/useSubcontractorPortal";
import { Loader2 } from "lucide-react";

interface SubcontractorProtectedRouteProps {
  children: ReactNode;
}

export function SubcontractorProtectedRoute({ children }: SubcontractorProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { data: subcontractor, isLoading: subcontractorLoading } = useCurrentSubcontractor();

  if (authLoading || subcontractorLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/subcontractor/login" replace />;
  }

  if (!subcontractor) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">
            Your account is not linked to a subcontractor record.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

```

## Portal Hooks

### `src/integrations/supabase/hooks/usePortal.ts`

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Reimbursement, PersonnelNotification, PersonnelNotificationPreferences, PersonnelInvitation } from "@/types/portal";

// Get current personnel record for logged-in user
export function useCurrentPersonnel() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["current-personnel", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("personnel")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}

// Update personnel photo (for self-update by personnel)
export function useUpdatePersonnelPhoto() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (photoUrl: string) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("personnel")
        .update({ photo_url: photoUrl })
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-personnel"] });
      toast.success("Profile photo saved!");
    },
    onError: (error) => {
      toast.error("Failed to save photo: " + error.message);
    },
  });
}

// Get time entries for current personnel
export function usePersonnelTimeEntries(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["personnel-time-entries", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];
      
      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          *,
          project:projects(id, name)
        `)
        .eq("personnel_id", personnelId)
        .order("entry_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!personnelId,
  });
}

// Get ACTIVE project assignments for current personnel (for actions like clocking in)
export function usePersonnelAssignments(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["personnel-assignments", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];
      
      const { data, error } = await supabase
        .from("personnel_project_assignments")
        .select(`
          *,
          project:projects(
            id, name, status, start_date, end_date,
            description, address, city, state, zip,
            customer_po, poc_name, poc_phone, poc_email,
            customer:customers(id, name, company, phone, email)
          )
        `)
        .eq("personnel_id", personnelId)
        .eq("status", "active");
      
      if (error) throw error;
      return data;
    },
    enabled: !!personnelId,
  });
}

// Get ALL project assignments for current personnel (for viewing history)
export function usePersonnelAllAssignments(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["personnel-all-assignments", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];
      
      const { data, error } = await supabase
        .from("personnel_project_assignments")
        .select(`
          *,
          project:projects(
            id, name, status, start_date, end_date,
            description, address, city, state, zip,
            customer_po, poc_name, poc_phone, poc_email,
            customer:customers(id, name, company, phone, email)
          )
        `)
        .eq("personnel_id", personnelId)
        .order("assigned_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!personnelId,
  });
}

// Get reimbursements for current personnel
export function usePersonnelReimbursements(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["personnel-reimbursements", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];
      
      const { data, error } = await supabase
        .from("reimbursements")
        .select(`
          *,
          project:projects(id, name)
        `)
        .eq("personnel_id", personnelId)
        .order("submitted_at", { ascending: false });
      
      if (error) throw error;
      return data as Reimbursement[];
    },
    enabled: !!personnelId,
  });
}

// Add reimbursement
export function useAddReimbursement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (reimbursement: Omit<Reimbursement, "id" | "created_at" | "updated_at" | "submitted_at" | "reviewed_by" | "reviewed_at" | "paid_at">) => {
      const { data, error } = await supabase
        .from("reimbursements")
        .insert(reimbursement)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["personnel-reimbursements", variables.personnel_id] });
      toast.success("Reimbursement submitted successfully");
    },
    onError: (error) => {
      toast.error("Failed to submit reimbursement: " + error.message);
    },
  });
}

// Get notifications for current personnel
export function usePersonnelNotifications(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["personnel-notifications", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];
      
      const { data, error } = await supabase
        .from("personnel_notifications")
        .select("*")
        .eq("personnel_id", personnelId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as PersonnelNotification[];
    },
    enabled: !!personnelId,
  });
}

// Mark notification as read
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, personnelId }: { id: string; personnelId: string }) => {
      const { error } = await supabase
        .from("personnel_notifications")
        .update({ is_read: true })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["personnel-notifications", variables.personnelId] });
    },
  });
}

// Get notification preferences
export function usePersonnelNotificationPreferences(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["personnel-notification-preferences", personnelId],
    queryFn: async () => {
      if (!personnelId) return null;
      
      const { data, error } = await supabase
        .from("personnel_notification_preferences")
        .select("*")
        .eq("personnel_id", personnelId)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data as PersonnelNotificationPreferences | null;
    },
    enabled: !!personnelId,
  });
}

// Update notification preferences
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ personnelId, preferences }: { personnelId: string; preferences: Partial<PersonnelNotificationPreferences> }) => {
      const { data, error } = await supabase
        .from("personnel_notification_preferences")
        .upsert(
          {
            personnel_id: personnelId,
            ...preferences,
          },
          { onConflict: 'personnel_id' }
        )
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["personnel-notification-preferences", variables.personnelId] });
      toast.success("Preferences updated");
    },
    onError: (error) => {
      toast.error("Failed to update preferences: " + error.message);
    },
  });
}

// ============ Admin hooks for invitations ============

// Get all personnel invitations (admin)
export function usePersonnelInvitations() {
  return useQuery({
    queryKey: ["personnel-invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel_invitations")
        .select(`
          *,
          personnel:personnel(id, first_name, last_name, email)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as PersonnelInvitation[];
    },
  });
}

// Check for existing invitation for a personnel
export function usePersonnelInvitationCheck(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["personnel-invitation-check", personnelId],
    queryFn: async () => {
      if (!personnelId) return null;
      
      const { data, error } = await supabase
        .from("personnel_invitations")
        .select("id, status, created_at, expires_at")
        .eq("personnel_id", personnelId)
        .eq("status", "pending")
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!personnelId,
  });
}

// Send portal invitation
export function useSendPortalInvitation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ personnelId, email, personnelName }: { personnelId: string; email: string; personnelName: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      // Delete any existing pending invitation first
      await supabase
        .from("personnel_invitations")
        .delete()
        .eq("personnel_id", personnelId)
        .eq("status", "pending");
      
      // Create the invitation record
      const { data, error } = await supabase
        .from("personnel_invitations")
        .insert({
          personnel_id: personnelId,
          email,
          invited_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Send the invitation email via edge function
      const { error: emailError } = await supabase.functions.invoke("send-portal-invitation", {
        body: {
          personnelId,
          personnelName,
          email,
          token: data.token,
        },
      });
      
      if (emailError) {
        console.error("Failed to send invitation email:", emailError);
        throw new Error("Invitation created but failed to send email");
      }
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["personnel-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-invitation-check", variables.personnelId] });
      toast.success("Portal invitation email sent");
    },
    onError: (error) => {
      toast.error("Failed to send invitation: " + error.message);
    },
  });
}

// Revoke portal access (unlink user_id from personnel)
export function useRevokePortalAccess() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (personnelId: string) => {
      const { error } = await supabase
        .from("personnel")
        .update({ user_id: null })
        .eq("id", personnelId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      toast.success("Portal access revoked");
    },
    onError: (error) => {
      toast.error("Failed to revoke access: " + error.message);
    },
  });
}

// Get invitation by token (public)
export function useInvitationByToken(token: string | undefined) {
  return useQuery({
    queryKey: ["personnel-invitation-token", token],
    queryFn: async () => {
      if (!token) return null;
      
      const { data, error } = await supabase
        .from("personnel_invitations")
        .select(`
          *,
          personnel:personnel(id, first_name, last_name, email)
        `)
        .eq("token", token)
        .eq("status", "pending")
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data as PersonnelInvitation | null;
    },
    enabled: !!token,
  });
}

// ============ Admin hooks for reimbursements ============

// Get all reimbursements (admin)
export function useAllReimbursements(status?: string) {
  return useQuery({
    queryKey: ["all-reimbursements", status],
    queryFn: async () => {
      let query = supabase
        .from("reimbursements")
        .select(`
          *,
          project:projects(id, name),
          personnel:personnel(id, first_name, last_name)
        `)
        .order("submitted_at", { ascending: false });
      
      if (status && status !== "all") {
        query = query.eq("status", status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// Update reimbursement status (admin)
export function useUpdateReimbursementStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const updateData: Record<string, unknown> = { status };
      
      if (status === "approved" || status === "rejected") {
        updateData.reviewed_by = user?.id;
        updateData.reviewed_at = new Date().toISOString();
      }
      
      if (status === "paid") {
        updateData.paid_at = new Date().toISOString();
      }
      
      if (notes) {
        updateData.notes = notes;
      }
      
      const { error } = await supabase
        .from("reimbursements")
        .update(updateData)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-reimbursements"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-reimbursements"] });
      toast.success("Reimbursement status updated");
    },
    onError: (error) => {
      toast.error("Failed to update status: " + error.message);
    },
  });
}

// Send notification to personnel (admin)
export function useSendPersonnelNotification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (notification: { personnel_id: string; title: string; message: string; notification_type: string; metadata?: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from("personnel_notifications")
        .insert([{
          personnel_id: notification.personnel_id,
          title: notification.title,
          message: notification.message,
          notification_type: notification.notification_type,
          metadata: (notification.metadata || {}) as Record<string, unknown>,
        }] as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-notifications"] });
      toast.success("Notification sent");
    },
    onError: (error) => {
      toast.error("Failed to send notification: " + error.message);
    },
  });
}

```

### `src/integrations/supabase/hooks/usePortalAssets.ts`

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PortalAssignedAsset {
  id: string;
  project_id: string;
  asset_id: string;
  start_at: string;
  end_at: string | null;
  notes: string | null;
  project: {
    id: string;
    name: string;
  } | null;
  asset: {
    id: string;
    type: string;
    label: string;
    description: string | null;
    address: string | null;
    gate_code: string | null;
    access_instructions: string | null;
    operating_hours: string | null;
    instructions: string | null;
  } | null;
}

export function usePersonnelAssignedAssets(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["portal-assigned-assets", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];

      const { data, error } = await supabase
        .from("asset_assignments")
        .select(`
          id,
          project_id,
          asset_id,
          start_at,
          end_at,
          notes,
          projects:project_id(id, name),
          assets:asset_id(
            id,
            type,
            label,
            description,
            address,
            gate_code,
            access_instructions,
            operating_hours,
            instructions
          )
        `)
        .eq("assigned_to_personnel_id", personnelId)
        .eq("status", "active")
        .is("unassigned_at", null)
        .order("start_at", { ascending: false });

      if (error) throw error;

      // Filter expired assignments and transform data structure
      const now = new Date();
      return (data || [])
        .filter(a => {
          if (!a.end_at) return true;
          return new Date(a.end_at) > now;
        })
        .map(a => ({
          id: a.id,
          project_id: a.project_id,
          asset_id: a.asset_id,
          start_at: a.start_at,
          end_at: a.end_at,
          notes: a.notes,
          project: a.projects as PortalAssignedAsset["project"],
          asset: a.assets as PortalAssignedAsset["asset"],
        })) as PortalAssignedAsset[];
    },
    enabled: !!personnelId,
  });
}

// Get assets for a specific project
export function usePersonnelProjectAssets(personnelId: string | undefined, projectId: string | undefined) {
  return useQuery({
    queryKey: ["portal-project-assets", personnelId, projectId],
    queryFn: async () => {
      if (!personnelId || !projectId) return [];

      const { data, error } = await supabase
        .from("asset_assignments")
        .select(`
          id,
          project_id,
          asset_id,
          start_at,
          end_at,
          notes,
          assets:asset_id(
            id,
            type,
            label,
            description,
            address,
            gate_code,
            access_instructions,
            operating_hours,
            instructions
          )
        `)
        .eq("assigned_to_personnel_id", personnelId)
        .eq("project_id", projectId)
        .eq("status", "active")
        .is("unassigned_at", null)
        .order("start_at", { ascending: false });

      if (error) throw error;

      // Filter expired assignments
      const now = new Date();
      return (data || [])
        .filter(a => {
          if (!a.end_at) return true;
          return new Date(a.end_at) > now;
        })
        .map(a => ({
          id: a.id,
          project_id: a.project_id,
          asset_id: a.asset_id,
          start_at: a.start_at,
          end_at: a.end_at,
          notes: a.notes,
          project: null,
          asset: a.assets as PortalAssignedAsset["asset"],
        })) as PortalAssignedAsset[];
    },
    enabled: !!personnelId && !!projectId,
  });
}

```

### `src/integrations/supabase/hooks/useVendorPortal.ts`

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface VendorPurchaseOrder {
  id: string;
  number: string;
  project_name: string;
  project_id: string;
  customer_name: string;
  status: string;
  total: number;
  total_addendum_amount: number;
  billed_amount: number;
  revised_total: number;
  billed_to_date: number;
  remaining_to_bill: number;
  due_date: string;
  created_at: string;
}

export interface VendorBill {
  id: string;
  number: string;
  purchase_order_id: string;
  po_number: string;
  status: string;
  total: number;
  bill_date: string;
  due_date: string;
  submitted_at: string | null;
  created_at: string;
}

export interface VendorInvitation {
  id: string;
  vendor_id: string;
  email: string;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
  vendor?: {
    id: string;
    name: string;
    email: string;
  };
}

// Get current vendor record for logged-in user
export function useCurrentVendor() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["current-vendor", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}

// Get purchase orders for current vendor
export function useVendorPurchaseOrders() {
  const { data: vendor } = useCurrentVendor();
  
  return useQuery({
    queryKey: ["vendor-purchase-orders", vendor?.id],
    queryFn: async () => {
      if (!vendor?.id) return [];
      
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          id,
          number,
          project_name,
          project_id,
          customer_name,
          status,
          total,
          total_addendum_amount,
          billed_amount,
          due_date,
          created_at
        `)
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Calculate derived fields
      return (data || []).map(po => ({
        ...po,
        revised_total: (po.total || 0) + (po.total_addendum_amount || 0),
        billed_to_date: po.billed_amount || 0,
        remaining_to_bill: ((po.total || 0) + (po.total_addendum_amount || 0)) - (po.billed_amount || 0),
      })) as VendorPurchaseOrder[];
    },
    enabled: !!vendor?.id,
  });
}

// Get vendor bills for current vendor
export function useVendorBills() {
  const { data: vendor } = useCurrentVendor();
  
  return useQuery({
    queryKey: ["vendor-bills-portal", vendor?.id],
    queryFn: async () => {
      if (!vendor?.id) return [];
      
      const { data, error } = await supabase
        .from("vendor_bills")
        .select(`
          id,
          number,
          purchase_order_id,
          status,
          total,
          bill_date,
          due_date,
          submitted_at,
          created_at,
          purchase_orders!inner(number)
        `)
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(bill => ({
        ...bill,
        po_number: (bill.purchase_orders as any)?.number || '',
      })) as VendorBill[];
    },
    enabled: !!vendor?.id,
  });
}

// Get single PO detail for vendor
export function useVendorPurchaseOrder(id: string | undefined) {
  const { data: vendor } = useCurrentVendor();
  
  return useQuery({
    queryKey: ["vendor-purchase-order", id],
    queryFn: async () => {
      if (!id || !vendor?.id) return null;
      
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          po_line_items(*),
          po_addendums(*)
        `)
        .eq("id", id)
        .eq("vendor_id", vendor.id)
        .single();
      
      if (error) throw error;
      
      return {
        ...data,
        revised_total: (data.total || 0) + (data.total_addendum_amount || 0),
        billed_to_date: data.billed_amount || 0,
        remaining_to_bill: ((data.total || 0) + (data.total_addendum_amount || 0)) - (data.billed_amount || 0),
      };
    },
    enabled: !!id && !!vendor?.id,
  });
}

// Get single bill detail for vendor
export function useVendorBill(id: string | undefined) {
  const { data: vendor } = useCurrentVendor();
  
  return useQuery({
    queryKey: ["vendor-bill-portal", id],
    queryFn: async () => {
      if (!id || !vendor?.id) return null;
      
      const { data, error } = await supabase
        .from("vendor_bills")
        .select(`
          *,
          vendor_bill_line_items(*),
          purchase_orders(number, project_name)
        `)
        .eq("id", id)
        .eq("vendor_id", vendor.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!vendor?.id,
  });
}

// Create vendor bill from vendor portal
export function useCreateVendorBill() {
  const queryClient = useQueryClient();
  const { data: vendor } = useCurrentVendor();
  
  return useMutation({
    mutationFn: async (billData: {
      purchase_order_id: string;
      bill_date: string;
      due_date: string;
      notes?: string;
      line_items: Array<{
        description: string;
        quantity: number;
        unit_cost: number;
        total: number;
        po_line_item_id?: string;
      }>;
    }) => {
      if (!vendor?.id) throw new Error("Vendor not found");
      
      const subtotal = billData.line_items.reduce((sum, item) => sum + item.total, 0);
      
      // Get vendor name for the bill
      const vendorName = vendor.name || "";
      
      // Create the bill
      const { data: bill, error: billError } = await supabase
        .from("vendor_bills")
        .insert({
          vendor_id: vendor.id,
          vendor_name: vendorName,
          purchase_order_id: billData.purchase_order_id,
          bill_date: billData.bill_date,
          due_date: billData.due_date,
          notes: billData.notes,
          subtotal,
          tax_rate: 0,
          tax_amount: 0,
          total: subtotal,
          status: "open",
          number: "", // Will be auto-generated by trigger
        } as any)
        .select()
        .single();
      
      if (billError) throw billError;
      
      // Create line items
      const lineItemsToInsert = billData.line_items.map(item => ({
        bill_id: bill.id,
        description: item.description,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total: item.total,
        po_line_item_id: item.po_line_item_id,
      }));
      
      const { error: lineItemsError } = await supabase
        .from("vendor_bill_line_items")
        .insert(lineItemsToInsert);
      
      if (lineItemsError) throw lineItemsError;
      
      return bill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bills-portal"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-purchase-orders"] });
      toast.success("Bill submitted successfully");
    },
    onError: (error) => {
      toast.error("Failed to submit bill: " + error.message);
    },
  });
}

// ============ Admin hooks for vendor invitations ============

// Get invitation by token (public)
export function useVendorInvitationByToken(token: string | undefined) {
  return useQuery({
    queryKey: ["vendor-invitation-token", token],
    queryFn: async () => {
      if (!token) return null;
      
      const { data, error } = await supabase
        .from("vendor_invitations")
        .select(`
          *,
          vendor:vendors(id, name, email)
        `)
        .eq("token", token)
        .eq("status", "pending")
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data as VendorInvitation | null;
    },
    enabled: !!token,
  });
}

// Check for existing invitation for a vendor
export function useVendorInvitationCheck(vendorId: string | undefined) {
  return useQuery({
    queryKey: ["vendor-invitation-check", vendorId],
    queryFn: async () => {
      if (!vendorId) return null;
      
      const { data, error } = await supabase
        .from("vendor_invitations")
        .select("id, status, created_at, expires_at")
        .eq("vendor_id", vendorId)
        .eq("status", "pending")
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!vendorId,
  });
}

// Send vendor portal invitation
export function useSendVendorPortalInvitation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ vendorId, email, vendorName }: { vendorId: string; email: string; vendorName: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      // Delete any existing pending invitation first
      await supabase
        .from("vendor_invitations")
        .delete()
        .eq("vendor_id", vendorId)
        .eq("status", "pending");
      
      // Create the invitation record
      const { data, error } = await supabase
        .from("vendor_invitations")
        .insert({
          vendor_id: vendorId,
          email,
          invited_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Send the invitation email via edge function
      const { error: emailError } = await supabase.functions.invoke("send-vendor-portal-invitation", {
        body: {
          vendorId,
          vendorName,
          email,
          token: data.token,
        },
      });
      
      if (emailError) {
        console.error("Failed to send invitation email:", emailError);
        throw new Error("Invitation created but failed to send email");
      }
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-invitation-check", variables.vendorId] });
      toast.success("Vendor portal invitation email sent");
    },
    onError: (error) => {
      toast.error("Failed to send invitation: " + error.message);
    },
  });
}

// Revoke vendor portal access
export function useRevokeVendorPortalAccess() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (vendorId: string) => {
      const { error } = await supabase
        .from("vendors")
        .update({ user_id: null })
        .eq("id", vendorId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor portal access revoked");
    },
    onError: (error) => {
      toast.error("Failed to revoke access: " + error.message);
    },
  });
}

```

### `src/integrations/supabase/hooks/useSubcontractorPortal.ts`

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SubcontractorPurchaseOrder {
  id: string;
  number: string;
  project_name: string;
  project_id: string;
  customer_name: string;
  status: string;
  total: number;
  total_addendum_amount: number;
  billed_amount: number;
  revised_total: number;
  billed_to_date: number;
  remaining_to_bill: number;
  due_date: string;
  created_at: string;
}

export interface SubcontractorBill {
  id: string;
  number: string;
  purchase_order_id: string;
  po_number: string;
  status: string;
  total: number;
  bill_date: string;
  due_date: string;
  submitted_at: string | null;
  paid_amount: number;
  remaining_amount: number;
  created_at: string;
}

export interface POBackCharge {
  id: string;
  purchase_order_id: string;
  vendor_id: string;
  charge_type: "deduction" | "penalty" | "adjustment";
  description: string;
  amount: number;
  applied_date: string;
  notes: string | null;
  created_at: string;
}

// Get current subcontractor (vendor where vendor_type='contractor')
export function useCurrentSubcontractor() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["current-subcontractor", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("user_id", user.id)
        .eq("vendor_type", "contractor")
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}

// Get purchase orders for current subcontractor
export function useSubcontractorPurchaseOrders() {
  const { data: subcontractor } = useCurrentSubcontractor();
  
  return useQuery({
    queryKey: ["subcontractor-purchase-orders", subcontractor?.id],
    queryFn: async () => {
      if (!subcontractor?.id) return [];
      
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          id,
          number,
          project_name,
          project_id,
          customer_name,
          status,
          total,
          total_addendum_amount,
          billed_amount,
          due_date,
          created_at
        `)
        .eq("vendor_id", subcontractor.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(po => ({
        ...po,
        revised_total: (po.total || 0) + (po.total_addendum_amount || 0),
        billed_to_date: po.billed_amount || 0,
        remaining_to_bill: ((po.total || 0) + (po.total_addendum_amount || 0)) - (po.billed_amount || 0),
      })) as SubcontractorPurchaseOrder[];
    },
    enabled: !!subcontractor?.id,
  });
}

// Get single PO detail for subcontractor
export function useSubcontractorPurchaseOrder(id: string | undefined) {
  const { data: subcontractor } = useCurrentSubcontractor();
  
  return useQuery({
    queryKey: ["subcontractor-purchase-order", id],
    queryFn: async () => {
      if (!id || !subcontractor?.id) return null;
      
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          po_line_items(*),
          po_addendums(
            *,
            po_addendum_line_items(*)
          )
        `)
        .eq("id", id)
        .eq("vendor_id", subcontractor.id)
        .single();
      
      if (error) throw error;
      
      return {
        ...data,
        revised_total: (data.total || 0) + (data.total_addendum_amount || 0),
        billed_to_date: data.billed_amount || 0,
        remaining_to_bill: ((data.total || 0) + (data.total_addendum_amount || 0)) - (data.billed_amount || 0),
      };
    },
    enabled: !!id && !!subcontractor?.id,
  });
}

// Get back charges for a PO
export function usePOBackCharges(purchaseOrderId: string | undefined) {
  return useQuery({
    queryKey: ["po-back-charges", purchaseOrderId],
    queryFn: async () => {
      if (!purchaseOrderId) return [];
      
      // Using any type since po_back_charges is a newly created table
      const { data, error } = await (supabase as any)
        .from("po_back_charges")
        .select("*")
        .eq("purchase_order_id", purchaseOrderId)
        .order("applied_date", { ascending: false });
      
      if (error) throw error;
      return (data || []) as POBackCharge[];
    },
    enabled: !!purchaseOrderId,
  });
}

// Get all back charges for current subcontractor
export function useSubcontractorBackCharges() {
  const { data: subcontractor } = useCurrentSubcontractor();
  
  return useQuery({
    queryKey: ["subcontractor-back-charges", subcontractor?.id],
    queryFn: async () => {
      if (!subcontractor?.id) return [];
      
      // Using any type since po_back_charges is a newly created table
      const { data, error } = await (supabase as any)
        .from("po_back_charges")
        .select(`
          *,
          purchase_orders(number, project_name)
        `)
        .eq("vendor_id", subcontractor.id)
        .order("applied_date", { ascending: false });
      
      if (error) throw error;
      return (data || []) as POBackCharge[];
    },
    enabled: !!subcontractor?.id,
  });
}

// Get bills for current subcontractor
export function useSubcontractorBills() {
  const { data: subcontractor } = useCurrentSubcontractor();
  
  return useQuery({
    queryKey: ["subcontractor-bills", subcontractor?.id],
    queryFn: async () => {
      if (!subcontractor?.id) return [];
      
      const { data, error } = await supabase
        .from("vendor_bills")
        .select(`
          id,
          number,
          purchase_order_id,
          status,
          total,
          bill_date,
          due_date,
          submitted_at,
          paid_amount,
          remaining_amount,
          created_at,
          purchase_orders!inner(number)
        `)
        .eq("vendor_id", subcontractor.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(bill => ({
        ...bill,
        po_number: (bill.purchase_orders as any)?.number || '',
      })) as SubcontractorBill[];
    },
    enabled: !!subcontractor?.id,
  });
}

// Get single bill detail for subcontractor
export function useSubcontractorBill(id: string | undefined) {
  const { data: subcontractor } = useCurrentSubcontractor();
  
  return useQuery({
    queryKey: ["subcontractor-bill", id],
    queryFn: async () => {
      if (!id || !subcontractor?.id) return null;
      
      const { data, error } = await supabase
        .from("vendor_bills")
        .select(`
          *,
          vendor_bill_line_items(*),
          vendor_bill_payments(*),
          purchase_orders(number, project_name)
        `)
        .eq("id", id)
        .eq("vendor_id", subcontractor.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!subcontractor?.id,
  });
}

// Create bill from subcontractor portal
export function useCreateSubcontractorBill() {
  const queryClient = useQueryClient();
  const { data: subcontractor } = useCurrentSubcontractor();
  
  return useMutation({
    mutationFn: async (billData: {
      purchase_order_id: string;
      bill_date: string;
      due_date: string;
      notes?: string;
      line_items: Array<{
        description: string;
        quantity: number;
        unit_cost: number;
        total: number;
        po_line_item_id?: string;
      }>;
    }) => {
      if (!subcontractor?.id) throw new Error("Subcontractor not found");
      
      const subtotal = billData.line_items.reduce((sum, item) => sum + item.total, 0);
      const subcontractorName = subcontractor.name || "";
      
      // Create the bill
      const { data: bill, error: billError } = await supabase
        .from("vendor_bills")
        .insert({
          vendor_id: subcontractor.id,
          vendor_name: subcontractorName,
          purchase_order_id: billData.purchase_order_id,
          bill_date: billData.bill_date,
          due_date: billData.due_date,
          notes: billData.notes,
          subtotal,
          tax_rate: 0,
          tax_amount: 0,
          total: subtotal,
          status: "open",
          number: "", // Auto-generated
        } as any)
        .select()
        .single();
      
      if (billError) throw billError;
      
      // Create line items
      const lineItemsToInsert = billData.line_items.map(item => ({
        bill_id: bill.id,
        description: item.description,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total: item.total,
        po_line_item_id: item.po_line_item_id,
      }));
      
      const { error: lineItemsError } = await supabase
        .from("vendor_bill_line_items")
        .insert(lineItemsToInsert);
      
      if (lineItemsError) throw lineItemsError;
      
      return bill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcontractor-bills"] });
      queryClient.invalidateQueries({ queryKey: ["subcontractor-purchase-orders"] });
      toast.success("Bill submitted successfully");
    },
    onError: (error) => {
      toast.error("Failed to submit bill: " + error.message);
    },
  });
}

```

### `src/integrations/supabase/hooks/useTimeClock.ts`

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { GeoData } from "@/hooks/useGeolocation";

export interface ClockEntry {
  id: string;
  project_id: string;
  personnel_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_in_accuracy: number | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  clock_out_accuracy: number | null;
  entry_source: string;
  hours: number | null;
  lunch_start_at: string | null;
  lunch_end_at: string | null;
  lunch_duration_minutes: number | null;
  is_on_lunch: boolean;
  project?: {
    id: string;
    name: string;
    time_clock_enabled: boolean;
    require_clock_location: boolean;
  };
}

// Get open clock entry for a specific personnel and project
export function useOpenClockEntry(personnelId: string | undefined, projectId: string | undefined) {
  return useQuery({
    queryKey: ["open-clock-entry", personnelId, projectId],
    queryFn: async () => {
      if (!personnelId || !projectId) return null;

      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          id,
          project_id,
          personnel_id,
          clock_in_at,
          clock_out_at,
          clock_in_lat,
          clock_in_lng,
          clock_in_accuracy,
          clock_out_lat,
          clock_out_lng,
          clock_out_accuracy,
          entry_source,
          hours,
          lunch_start_at,
          lunch_end_at,
          lunch_duration_minutes,
          is_on_lunch
        `)
        .eq("personnel_id", personnelId)
        .eq("project_id", projectId)
        .not("clock_in_at", "is", null)
        .is("clock_out_at", null)
        .maybeSingle();

      if (error) throw error;
      return data as ClockEntry | null;
    },
    enabled: !!personnelId && !!projectId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Get all open clock entries for a personnel (across all projects)
export function useAllOpenClockEntries(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["all-open-clock-entries", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];

      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          id,
          project_id,
          personnel_id,
          clock_in_at,
          clock_out_at,
          clock_in_lat,
          clock_in_lng,
          clock_in_accuracy,
          entry_source,
          hours,
          lunch_start_at,
          lunch_end_at,
          lunch_duration_minutes,
          is_on_lunch,
          project:projects(id, name, time_clock_enabled, require_clock_location)
        `)
        .eq("personnel_id", personnelId)
        .not("clock_in_at", "is", null)
        .is("clock_out_at", null);

      if (error) throw error;
      return data as ClockEntry[];
    },
    enabled: !!personnelId,
    refetchInterval: 30000,
  });
}

// Get clock-enabled projects for a personnel
export function useClockEnabledProjects(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["clock-enabled-projects", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];

      const { data, error } = await supabase
        .from("personnel_project_assignments")
        .select(`
          id,
          project:projects(
            id,
            name,
            status,
            time_clock_enabled,
            require_clock_location
          )
        `)
        .eq("personnel_id", personnelId)
        .eq("status", "active");

      if (error) throw error;

      // Filter to only clock-enabled projects
      return data
        .filter((a) => a.project?.time_clock_enabled === true)
        .map((a) => a.project!);
    },
    enabled: !!personnelId,
  });
}

// Get clock history for a personnel
export function useClockHistory(personnelId: string | undefined, days: number = 14) {
  return useQuery({
    queryKey: ["clock-history", personnelId, days],
    queryFn: async () => {
      if (!personnelId) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          id,
          project_id,
          personnel_id,
          entry_date,
          clock_in_at,
          clock_out_at,
          hours,
          lunch_start_at,
          lunch_end_at,
          lunch_duration_minutes,
          is_on_lunch,
          project:projects(id, name)
        `)
        .eq("personnel_id", personnelId)
        .eq("entry_source", "clock")
        .gte("entry_date", startDate.toISOString().split("T")[0])
        .order("clock_in_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!personnelId,
  });
}

// Clock in mutation
export function useClockIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      personnelId,
      geoData,
      skipScheduleCheck,
    }: {
      projectId: string;
      personnelId: string;
      geoData: GeoData;
      skipScheduleCheck?: boolean;
    }) => {
      // Get the authenticated user's ID for RLS
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check schedule for late clock-in (unless explicitly skipped)
      if (!skipScheduleCheck) {
        const today = new Date().toISOString().split("T")[0];
        const now = new Date();
        
        const { data: schedule } = await supabase
          .from("personnel_schedules")
          .select("scheduled_start_time")
          .eq("personnel_id", personnelId)
          .eq("project_id", projectId)
          .eq("scheduled_date", today)
          .maybeSingle();

        if (schedule?.scheduled_start_time) {
          const [hours, minutes] = schedule.scheduled_start_time.split(":").map(Number);
          const scheduledTime = new Date(now);
          scheduledTime.setHours(hours, minutes, 0, 0);
          
          const diffMs = now.getTime() - scheduledTime.getTime();
          const minutesLate = diffMs / (1000 * 60);
          
          if (minutesLate > 10) {
            // Notify supervisors about the late attempt
            const attemptTime = now.toLocaleTimeString("en-US", { 
              hour: "2-digit", 
              minute: "2-digit",
              hour12: true 
            });
            
            // Fire and forget - don't block on this
            supabase.functions.invoke("notify-late-clock-attempt", {
              body: {
                personnel_id: personnelId,
                project_id: projectId,
                scheduled_start_time: schedule.scheduled_start_time,
                attempt_time: attemptTime,
                minutes_late: minutesLate,
              },
            }).catch(err => console.error("Failed to notify late clock attempt:", err));
            
            throw new Error(`LATE_CLOCK_IN_BLOCKED:${Math.round(minutesLate)}:${schedule.scheduled_start_time}`);
          }
        }
      }

      // Create a new time entry with clock-in data
      const now = new Date();
      const { data, error } = await supabase
        .from("time_entries")
        .insert([{
          project_id: projectId,
          personnel_id: personnelId,
          user_id: user.id,
          entry_date: now.toISOString().split("T")[0],
          clock_in_at: now.toISOString(),
          clock_in_lat: geoData.lat,
          clock_in_lng: geoData.lng,
          clock_in_accuracy: geoData.accuracy,
          entry_source: "clock",
          status: "pending",
          hours: 0,
          regular_hours: 0,
          overtime_hours: 0,
          is_on_lunch: false,
          lunch_duration_minutes: 0,
        } as any])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["open-clock-entry", variables.personnelId, variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-open-clock-entries", variables.personnelId] });
      queryClient.invalidateQueries({ queryKey: ["personnel-time-entries", variables.personnelId] });
      queryClient.invalidateQueries({ queryKey: ["clock-history", variables.personnelId] });
      toast.success("Clocked in successfully");
    },
    onError: (error: Error) => {
      // Don't show toast for late block - it's handled by the UI
      if (error.message.startsWith("LATE_CLOCK_IN_BLOCKED:")) {
        return;
      }
      if (error.message.includes("idx_one_open_clock_per_personnel_project")) {
        toast.error("You already have an open clock entry for this project");
      } else {
        toast.error("Failed to clock in: " + error.message);
      }
    },
  });
}

// Clock out mutation
export function useClockOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entryId,
      personnelId,
      projectId,
      clockInAt,
      lunchDurationMinutes,
      geoData,
    }: {
      entryId: string;
      personnelId: string;
      projectId: string;
      clockInAt: string;
      lunchDurationMinutes?: number;
      geoData: GeoData;
    }) => {
      const now = new Date();
      const clockIn = new Date(clockInAt);
      
      // Calculate hours worked with high precision (subtract lunch duration)
      const totalMs = now.getTime() - clockIn.getTime();
      const lunchMs = (lunchDurationMinutes || 0) * 60 * 1000;
      const workMs = totalMs - lunchMs;
      const hoursWorked = workMs / (1000 * 60 * 60);
      // Round to 4 decimal places for sub-second precision
      const preciseHours = Math.round(hoursWorked * 10000) / 10000;

      const { data, error } = await supabase
        .from("time_entries")
        .update({
          clock_out_at: now.toISOString(),
          clock_out_lat: geoData.lat,
          clock_out_lng: geoData.lng,
          clock_out_accuracy: geoData.accuracy,
          hours: preciseHours,
          regular_hours: preciseHours, // Overtime will be calculated at weekly level
          is_on_lunch: false,
        })
        .eq("id", entryId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["open-clock-entry", variables.personnelId, variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-open-clock-entries", variables.personnelId] });
      queryClient.invalidateQueries({ queryKey: ["personnel-time-entries", variables.personnelId] });
      queryClient.invalidateQueries({ queryKey: ["clock-history", variables.personnelId] });
      toast.success("Clocked out successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to clock out: " + error.message);
    },
  });
}

// Start lunch mutation
export function useStartLunch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entryId,
      personnelId,
      projectId,
    }: {
      entryId: string;
      personnelId: string;
      projectId: string;
    }) => {
      const now = new Date();

      const { data, error } = await supabase
        .from("time_entries")
        .update({
          lunch_start_at: now.toISOString(),
          is_on_lunch: true,
        })
        .eq("id", entryId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["open-clock-entry", variables.personnelId, variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-open-clock-entries", variables.personnelId] });
      toast.success("Lunch break started");
    },
    onError: (error: Error) => {
      toast.error("Failed to start lunch: " + error.message);
    },
  });
}

// End lunch mutation
export function useEndLunch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entryId,
      personnelId,
      projectId,
      lunchStartAt,
    }: {
      entryId: string;
      personnelId: string;
      projectId: string;
      lunchStartAt: string;
    }) => {
      const now = new Date();
      const lunchStart = new Date(lunchStartAt);
      
      // Calculate lunch duration in minutes
      const lunchMinutes = Math.round((now.getTime() - lunchStart.getTime()) / (1000 * 60));

      const { data, error } = await supabase
        .from("time_entries")
        .update({
          lunch_end_at: now.toISOString(),
          lunch_duration_minutes: lunchMinutes,
          is_on_lunch: false,
        })
        .eq("id", entryId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["open-clock-entry", variables.personnelId, variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-open-clock-entries", variables.personnelId] });
      toast.success("Lunch break ended - back to work!");
    },
    onError: (error: Error) => {
      toast.error("Failed to end lunch: " + error.message);
    },
  });
}

// Helper to format time in 24h format with seconds
export function formatTime24h(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// Helper to format date and time
export function formatDateTime24h(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  }) + " at " + formatTime24h(dateString);
}

// Helper to format duration in hours, minutes, and seconds
export function formatDuration(minutes: number): string {
  const totalSeconds = Math.round(minutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  if (hours === 0 && mins === 0) return `${secs}s`;
  if (hours === 0) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  if (mins === 0 && secs === 0) return `${hours}h`;
  if (secs === 0) return `${hours}h ${mins}m`;
  return `${hours}h ${mins}m ${secs}s`;
}

// Helper to format hours (decimal) to hours, minutes, seconds
export function formatHoursDetailed(hours: number): string {
  const totalSeconds = Math.round(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  if (h === 0 && m === 0) return `${s}s`;
  if (h === 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  if (m === 0 && s === 0) return `${h}h`;
  if (s === 0) return `${h}h ${m}m`;
  return `${h}h ${m}m ${s}s`;
}

```

### `src/integrations/supabase/hooks/useVendorOnboarding.ts`

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface VendorOnboardingTokenData {
  id: string;
  vendor_id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface VendorData {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  contact_name: string | null;
  contact_title: string | null;
  business_type: string | null;
  years_in_business: number | null;
  website: string | null;
  specialty: string | null;
  license_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  tax_id: string | null;
  track_1099: boolean | null;
  payment_terms: string | null;
  billing_rate: number | null;
  insurance_expiry: string | null;
  onboarding_status: string | null;
}

export interface VendorOnboardingFormData {
  // Company info
  name: string;
  company: string;
  email: string;
  phone: string;
  contact_name: string;
  contact_title: string;
  business_type: string;
  years_in_business: string;
  website: string;
  specialty: string;
  license_number: string;
  // Address
  address: string;
  city: string;
  state: string;
  zip: string;
  // Tax info
  tax_id: string;
  track_1099: boolean;
  // Banking
  bank_name: string;
  bank_account_type: string;
  bank_routing_number: string;
  bank_account_number: string;
  // W9
  w9_signature: string | null;
  // Vendor agreement
  vendor_agreement_signature: string | null;
  // Payment terms
  payment_terms: string;
  billing_rate: string;
  // Insurance
  insurance_expiry: string;
  // Work authorization
  citizenship_status: string;
  immigration_status: string;
  itin: string;
  documents: { type: string; name: string; path: string; fileType: string; fileSize: number }[];
}

export interface OnboardingValidationResult {
  isValid: boolean;
  isExpired: boolean;
  isUsed: boolean;
  token: VendorOnboardingTokenData | null;
  vendor: VendorData | null;
}

// Hook to validate onboarding token
export function useVendorOnboardingToken(token: string | undefined) {
  return useQuery({
    queryKey: ["vendor-onboarding-token", token],
    queryFn: async (): Promise<OnboardingValidationResult> => {
      if (!token) {
        return { isValid: false, isExpired: false, isUsed: false, token: null, vendor: null };
      }

      // Fetch token data
      const { data: tokenData, error: tokenError } = await supabase
        .from("vendor_onboarding_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (tokenError) {
        console.error("Error fetching token:", tokenError);
        return { isValid: false, isExpired: false, isUsed: false, token: null, vendor: null };
      }

      if (!tokenData) {
        return { isValid: false, isExpired: false, isUsed: false, token: null, vendor: null };
      }

      // Check if expired
      const isExpired = new Date(tokenData.expires_at) < new Date();
      const isUsed = !!tokenData.used_at;

      if (isExpired || isUsed) {
        return { isValid: false, isExpired, isUsed, token: tokenData, vendor: null };
      }

      // Fetch vendor data
      const { data: vendorData, error: vendorError } = await supabase
        .from("vendors")
        .select("*")
        .eq("id", tokenData.vendor_id)
        .single();

      if (vendorError) {
        console.error("Error fetching vendor:", vendorError);
        return { isValid: false, isExpired: false, isUsed: false, token: tokenData, vendor: null };
      }

      return {
        isValid: true,
        isExpired: false,
        isUsed: false,
        token: tokenData,
        vendor: vendorData,
      };
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to complete vendor onboarding
export function useCompleteVendorOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      token,
      vendorId,
      formData,
    }: {
      token: string;
      vendorId: string;
      formData: VendorOnboardingFormData;
    }) => {
      const { data, error } = await supabase.rpc("complete_vendor_onboarding", {
        p_token: token,
        p_vendor_id: vendorId,
        p_name: formData.name,
        p_company: formData.company || null,
        p_email: formData.email,
        p_phone: formData.phone || null,
        p_contact_name: formData.contact_name || null,
        p_contact_title: formData.contact_title || null,
        p_business_type: formData.business_type || null,
        p_years_in_business: formData.years_in_business ? parseInt(formData.years_in_business) : null,
        p_website: formData.website || null,
        p_specialty: formData.specialty || null,
        p_license_number: formData.license_number || null,
        p_address: formData.address || null,
        p_city: formData.city || null,
        p_state: formData.state || null,
        p_zip: formData.zip || null,
        p_tax_id: formData.tax_id || null,
        p_track_1099: formData.track_1099,
        p_bank_name: formData.bank_name || null,
        p_bank_account_type: formData.bank_account_type || null,
        p_bank_routing_number: formData.bank_routing_number || null,
        p_bank_account_number: formData.bank_account_number || null,
        p_w9_signature: formData.w9_signature,
        p_vendor_agreement_signature: formData.vendor_agreement_signature,
        p_payment_terms: formData.payment_terms || null,
        p_billing_rate: formData.billing_rate ? parseFloat(formData.billing_rate) : null,
        p_citizenship_status: formData.citizenship_status || null,
        p_immigration_status: formData.immigration_status || null,
        p_itin: formData.itin || null,
        p_documents: formData.documents && formData.documents.length > 0 ? JSON.stringify(formData.documents) : null,
      });

      if (error) {
        throw error;
      }

      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) {
        throw new Error(result.error || "Failed to complete onboarding");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor onboarding completed successfully!");
    },
    onError: (error: Error) => {
      console.error("Error completing vendor onboarding:", error);
      toast.error(error.message || "Failed to complete onboarding");
    },
  });
}

// Hook to send vendor onboarding invitation via SMS
export function useSendVendorOnboardingSMS() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vendorId,
      vendorName,
      phone,
    }: {
      vendorId: string;
      vendorName: string;
      phone: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("send-vendor-onboarding-sms", {
        body: { vendorId, vendorName, phone },
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor onboarding SMS sent successfully!");
    },
    onError: (error: Error) => {
      console.error("Error sending vendor onboarding SMS:", error);
      toast.error(error.message || "Failed to send SMS");
    },
  });
}

// Hook to send vendor onboarding invitation via email
export function useSendVendorOnboardingInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vendorId,
      vendorName,
      email,
    }: {
      vendorId: string;
      vendorName: string;
      email: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("send-vendor-onboarding-email", {
        body: { vendorId, vendorName, email },
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor onboarding invitation sent successfully!");
    },
    onError: (error: Error) => {
      console.error("Error sending vendor onboarding invitation:", error);
      toast.error(error.message || "Failed to send invitation");
    },
  });
}

```

## Edge Functions

### `supabase/functions/accept-portal-invitation/index.ts`

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return new Response(
        JSON.stringify({ error: "Token and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch the invitation by token
    const { data: invitation, error: invitationError } = await adminClient
      .from("personnel_invitations")
      .select(`
        *,
        personnel:personnel_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (invitationError || !invitation) {
      console.error("Invitation lookup error:", invitationError);
      return new Response(
        JSON.stringify({ error: "Invalid or already used invitation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This invitation has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to create the auth user
    const { data: signUpData, error: signUpError } = await adminClient.auth.admin.createUser({
      email: invitation.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        first_name: invitation.personnel?.first_name,
        last_name: invitation.personnel?.last_name,
      },
    });

    let userId: string;

    if (signUpError) {
      // Check if user already exists
      if (signUpError.message?.includes("already been registered") || signUpError.code === "email_exists") {
        console.log("User already exists, looking up existing user...");
        
        const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers();
        
        if (listError) {
          console.error("Failed to look up existing user:", listError);
          return new Response(
            JSON.stringify({ error: "Failed to look up existing user" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const existingUser = existingUsers.users.find(u => u.email === invitation.email);
        
        if (!existingUser) {
          return new Response(
            JSON.stringify({ error: "User exists but could not be found" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        userId = existingUser.id;
        console.log("Using existing user:", userId);
      } else {
        console.error("User creation error:", signUpError);
        return new Response(
          JSON.stringify({ error: signUpError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (!signUpData.user) {
      return new Response(
        JSON.stringify({ error: "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      userId = signUpData.user.id;
      console.log("Created new user:", userId);
    }

    // Link personnel to auth user
    const { error: linkError } = await adminClient
      .from("personnel")
      .update({ user_id: userId })
      .eq("id", invitation.personnel_id);

    if (linkError) {
      console.error("Personnel link error:", linkError);
      return new Response(
        JSON.stringify({ error: "Failed to link personnel record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Remove any automatically-assigned role (personnel don't need roles in user_roles)
    const { error: deleteRoleError } = await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (deleteRoleError) {
      console.error("Role deletion error:", deleteRoleError);
      // Non-fatal, continue
    }

    // Mark invitation as accepted
    const { error: inviteUpdateError } = await adminClient
      .from("personnel_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (inviteUpdateError) {
      console.error("Invitation update error:", inviteUpdateError);
    }

    console.log("Personnel invitation accepted successfully for:", invitation.email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Account created successfully",
        email: invitation.email
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Unexpected error:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

```

### `supabase/functions/accept-vendor-invitation/index.ts`

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return new Response(
        JSON.stringify({ error: "Token and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Admin client to bypass RLS
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    // Regular client for auth operations
    const anonClient = createClient(supabaseUrl, anonKey);

    console.log("Fetching vendor invitation with token:", token);

    // Get the invitation
    const { data: invitation, error: invitationError } = await adminClient
      .from("vendor_invitations")
      .select("*, vendor:vendors(*)")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (invitationError || !invitation) {
      console.error("Invitation error:", invitationError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired invitation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Invitation has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found invitation for email:", invitation.email);

    let userId: string;

    // Try to create new user using admin client
    const { data: signUpData, error: signUpError } = await adminClient.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      user_metadata: {
        vendor_name: invitation.vendor?.name,
      },
    });

    if (signUpError) {
      console.log("Signup error:", signUpError.message);
      // If user already exists, look them up
      if (signUpError.message?.includes("already been registered") || signUpError.code === "email_exists") {
        console.log("User already exists, looking up existing user...");
        
        const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers();
        
        if (listError) {
          console.error("Failed to look up existing user:", listError);
          return new Response(
            JSON.stringify({ error: "Failed to look up existing user" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const existingUser = existingUsers.users.find(u => u.email === invitation.email);
        
        if (!existingUser) {
          return new Response(
            JSON.stringify({ error: "User exists but could not be found" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        userId = existingUser.id;
        console.log("Using existing user:", userId);
      } else {
        throw signUpError;
      }
    } else {
      if (!signUpData.user) {
        return new Response(
          JSON.stringify({ error: "Failed to create user" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = signUpData.user.id;
      console.log("Created new user:", userId);
    }

    console.log("User ID:", userId);

    // Link vendor to auth user
    const { error: linkError } = await adminClient
      .from("vendors")
      .update({ user_id: userId })
      .eq("id", invitation.vendor_id);

    if (linkError) {
      console.error("Link vendor error:", linkError);
      throw linkError;
    }

    // IMPORTANT: Remove any auto-assigned role for this user
    // Vendors should NOT have a role in user_roles - they are identified by vendors.user_id
    const { error: deleteRoleError } = await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (deleteRoleError) {
      console.error("Delete role error:", deleteRoleError);
      // Not critical, continue
    }

    console.log("Removed any existing roles for vendor user");

    // Mark invitation as accepted
    const { error: updateInviteError } = await adminClient
      .from("vendor_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (updateInviteError) {
      console.error("Update invitation error:", updateInviteError);
      throw updateInviteError;
    }

    console.log("Vendor invitation accepted successfully");

    return new Response(
      JSON.stringify({
        success: true,
        vendorId: invitation.vendor_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in accept-vendor-invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

```

### `supabase/functions/send-portal-invitation/index.ts`

```ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PortalInvitationRequest {
  personnelId: string;
  personnelName: string;
  email: string;
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header - please log in again" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError?.message || "No user found");
      return new Response(
        JSON.stringify({ error: "Session expired - please log out and log back in" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify user is admin or manager
    const { data: userRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!userRole || !["admin", "manager"].includes(userRole.role)) {
      throw new Error("Only admins and managers can send portal invitations");
    }

    const { personnelName, email, token }: PortalInvitationRequest = await req.json();

    const siteUrl = Deno.env.get("SITE_URL") || "https://xfjjvznxkcckuwxmcsdc.lovableproject.com";
    const inviteLink = `${siteUrl}/portal/accept-invite/${token}`;

    console.log(`Sending portal invitation to: ${email} for ${personnelName}`);

    const emailResponse = await resend.emails.send({
      from: "Fairfield <admin@fairfieldrg.com>",
      to: [email],
      subject: "You're invited to access your Personnel Portal",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Your Portal!</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${personnelName},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">You've been invited to access your Personnel Portal. This portal gives you direct access to:</p>
            
            <ul style="font-size: 15px; margin-bottom: 25px; padding-left: 20px;">
              <li style="margin-bottom: 8px;">📊 View your work hours and projects</li>
              <li style="margin-bottom: 8px;">💰 Track your pay and earnings</li>
              <li style="margin-bottom: 8px;">📝 Submit expense reimbursements</li>
              <li style="margin-bottom: 8px;">🔔 Manage your notification preferences</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">Access My Portal</a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-bottom: 15px;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 13px; color: #667eea; word-break: break-all; background: #f3f4f6; padding: 12px; border-radius: 6px;">${inviteLink}</p>
            
            <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 13px; color: #9ca3af; margin: 0;">⏰ This invitation expires in 7 days.</p>
            </div>
          </div>
          
          <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 20px;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      console.error("Email failed to send:", emailResponse.error);
      throw new Error(`Failed to send email: ${emailResponse.error.message}`);
    }

    console.log("Portal invitation email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending portal invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

```

### `supabase/functions/send-vendor-portal-invitation/index.ts`

```ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VendorPortalInvitationRequest {
  vendorId: string;
  vendorName: string;
  email: string;
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Verify user is admin or manager
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || !["admin", "manager"].includes(roleData.role)) {
      throw new Error("Only admins and managers can send vendor portal invitations");
    }

    const { vendorName, email, token }: VendorPortalInvitationRequest = await req.json();

    const siteUrl = Deno.env.get("SITE_URL") || "https://lovable.dev";
    const inviteLink = `${siteUrl}/vendor/accept-invite/${token}`;

    console.log("Sending vendor portal invitation to:", email);
    console.log("Invite link:", inviteLink);

    const emailResponse = await resend.emails.send({
      from: "Fairfield <admin@fairfieldrg.com>",
      to: [email],
      subject: "You've Been Invited to the Vendor Portal",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to the Vendor Portal!</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi <strong>${vendorName}</strong>,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">You've been invited to access our Vendor Portal. This gives you convenient access to:</p>
            
            <ul style="font-size: 16px; margin-bottom: 25px; padding-left: 20px;">
              <li style="margin-bottom: 10px;">📋 <strong>View your Purchase Orders</strong> - See all POs assigned to you</li>
              <li style="margin-bottom: 10px;">📄 <strong>Submit Bills</strong> - Create and submit bills against your POs</li>
              <li style="margin-bottom: 10px;">💰 <strong>Track Payments</strong> - Monitor payment status in real-time</li>
              <li style="margin-bottom: 10px;">📊 <strong>View Project Details</strong> - Access relevant project information</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-size: 16px; font-weight: bold;">Access Vendor Portal</a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 25px;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #888; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">${inviteLink}</p>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              This invitation link will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      console.error("Email failed to send:", emailResponse.error);
      throw new Error(`Failed to send email: ${emailResponse.error.message}`);
    }

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending vendor portal invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

```

### `supabase/functions/notify-invitation-accepted/index.ts`

```ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  invitationId: string;
  newUserEmail: string;
  newUserName: string;
  role: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { invitationId, newUserEmail, newUserName, role }: NotificationRequest = await req.json();

    console.log("Processing invitation acceptance notification:", {
      invitationId,
      newUserEmail,
      newUserName,
      role,
    });

    // Get the invitation details including who sent it
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .select("invited_by")
      .eq("id", invitationId)
      .single();

    if (inviteError) {
      console.error("Error fetching invitation:", inviteError);
      throw new Error("Failed to fetch invitation details");
    }

    // Get the admin's profile (email)
    const { data: adminProfile, error: adminError } = await supabase
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", invitation.invited_by)
      .single();

    if (adminError || !adminProfile?.email) {
      console.error("Error fetching admin profile:", adminError);
      throw new Error("Failed to fetch admin details");
    }

    const adminName = adminProfile.first_name && adminProfile.last_name 
      ? `${adminProfile.first_name} ${adminProfile.last_name}`
      : adminProfile.email;

    // Send notification email to admin
    const emailResponse = await resend.emails.send({
      from: "Fairfield <admin@fairfieldrg.com>",
      to: [adminProfile.email],
      subject: "User Invitation Accepted",
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb; margin-bottom: 16px;">Invitation Accepted</h2>
          <p style="color: #374151; margin-bottom: 16px;">
            Hi ${adminName},
          </p>
          <p style="color: #374151; margin-bottom: 16px;">
            Great news! A user has accepted your invitation and created their account.
          </p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">New User Details:</p>
            <p style="margin: 4px 0; color: #111827;"><strong>Name:</strong> ${newUserName}</p>
            <p style="margin: 4px 0; color: #111827;"><strong>Email:</strong> ${newUserEmail}</p>
            <p style="margin: 4px 0; color: #111827;"><strong>Role:</strong> <span style="text-transform: capitalize;">${role}</span></p>
            <p style="margin: 4px 0; color: #111827;"><strong>Joined:</strong> ${new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>
          <p style="color: #374151; margin-bottom: 16px;">
            The user can now access the system with their assigned ${role} role.
          </p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
            Best regards,<br>
            Fairfield Team
          </p>
        </div>
      `,
    });

    console.log("Notification email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in notify-invitation-accepted function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

```
