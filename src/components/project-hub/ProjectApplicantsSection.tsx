import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  Users,
  UserCheck,
  UserX,
  Eye,
  Loader2,
  Mail,
  ChevronDown,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SecureAvatar } from "@/components/ui/secure-avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Application,
  useApplications,
  useApproveApplicationWithType,
  useRejectApplication,
  ApprovalRecordType,
} from "@/integrations/supabase/hooks/useStaffingApplications";
import { ApplicationDetailDialog } from "@/components/staffing/ApplicationDetailDialog";
import {
  ApprovalTypeSelectionDialog,
  RecordType,
} from "@/components/personnel/ApprovalTypeSelectionDialog";
import { PersonnelAssignmentDialog } from "@/components/time-tracking/PersonnelAssignmentDialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ProjectApplicantsSectionProps {
  projectId: string;
}

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

// Helper to get profile picture from application answers
const getProfilePicture = (application: Application): string | null => {
  // First check the applicant's photo_url
  if (application.applicants?.photo_url) {
    return application.applicants.photo_url;
  }

  // Fall back to checking answers for file type fields
  const answers = application.answers as Record<string, unknown>;
  if (!answers) return null;

  for (const value of Object.values(answers)) {
    if (
      typeof value === "string" &&
      (value.startsWith("data:image") || value.includes("/storage/"))
    ) {
      return value;
    }
  }
  return null;
};

export function ProjectApplicantsSection({
  projectId,
}: ProjectApplicantsSectionProps) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");
  const [selectedApplication, setSelectedApplication] =
    useState<Application | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [pendingApprovalApp, setPendingApprovalApp] =
    useState<Application | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [newlyCreatedPersonnelId, setNewlyCreatedPersonnelId] = useState<
    string | null
  >(null);

  const { data: applications = [], isLoading } = useApplications({
    projectId,
  });

  const approveWithType = useApproveApplicationWithType();
  const rejectApplication = useRejectApplication();

  // Split applications into pending and approved
  const { pendingApplications, approvedApplications } = useMemo(() => {
    const pending = applications.filter((app) =>
      ["submitted", "reviewing", "needs_info", "updated"].includes(app.status)
    );
    const approved = applications.filter((app) => app.status === "approved");
    return { pendingApplications: pending, approvedApplications: approved };
  }, [applications]);

  const handleViewApplication = (application: Application) => {
    setSelectedApplication(application);
    setIsDetailDialogOpen(true);
  };

  const handleApproveClick = (application: Application) => {
    setPendingApprovalApp(application);
    setIsApprovalDialogOpen(true);
  };

  const handleApprovalConfirm = async (recordType: RecordType) => {
    if (!pendingApprovalApp) return;

    try {
      const result = await approveWithType.mutateAsync({
        applicationId: pendingApprovalApp.id,
        recordType: recordType as ApprovalRecordType,
      });

      setIsApprovalDialogOpen(false);
      setPendingApprovalApp(null);

      // Get the created personnel ID from the result if available
      const personnelId = (result as any)?.createdPersonnel?.id;

      if (personnelId && (recordType === "personnel" || recordType === "personnel_vendor")) {
        // Show success toast with action to assign to project
        toast.success(
          `${pendingApprovalApp.applicants?.first_name} ${pendingApprovalApp.applicants?.last_name} approved!`,
          {
            action: {
              label: "Assign to Project",
              onClick: () => {
                setNewlyCreatedPersonnelId(personnelId);
                setIsAssignDialogOpen(true);
              },
            },
            duration: 8000,
          }
        );
      } else {
        toast.success("Application approved successfully");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to approve application");
    }
  };

  const handleReject = async (application: Application) => {
    try {
      await rejectApplication.mutateAsync({
        applicationId: application.id,
      });
      toast.success("Application rejected");
    } catch (error: any) {
      toast.error(error.message || "Failed to reject application");
    }
  };

  const handleAssignmentChange = () => {
    queryClient.invalidateQueries({
      queryKey: ["personnel-project-assignments", "by-project", projectId],
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const totalApplicants =
    pendingApplications.length + approvedApplications.length;

  const renderApplicationRow = (application: Application) => {
    const applicant = application.applicants;
    const profilePic = getProfilePicture(application);
    const taskOrder = application.job_postings?.project_task_orders;
    const positionTitle = taskOrder?.title || "Unknown Position";

    if (!applicant) return null;

    const initials = `${applicant.first_name[0]}${applicant.last_name[0]}`;

    return (
      <TableRow key={application.id}>
        <TableCell>
          <div className="flex items-center gap-3">
            <SecureAvatar
              bucket="application-files"
              photoUrl={profilePic}
              className="h-9 w-9"
              fallback={<span className="text-xs">{initials}</span>}
              alt={`${applicant.first_name} ${applicant.last_name}`}
            />
            <div>
              <p className="font-medium">
                {applicant.first_name} {applicant.last_name}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {applicant.email}
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <span className="text-sm">{positionTitle}</span>
        </TableCell>
        <TableCell>
          <Badge className={cn("capitalize", statusColors[application.status])}>
            {application.status.replace("_", " ")}
          </Badge>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {format(new Date(application.created_at), "MMM d, yyyy")}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleViewApplication(application)}
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {application.status !== "approved" &&
              application.status !== "rejected" && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-green-600 hover:text-green-700 hover:bg-green-100"
                    onClick={() => handleApproveClick(application)}
                    title="Approve"
                  >
                    <UserCheck className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleReject(application)}
                    title="Reject"
                  >
                    <UserX className="h-4 w-4" />
                  </Button>
                </>
              )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const renderMobileCard = (application: Application) => {
    const applicant = application.applicants;
    const profilePic = getProfilePicture(application);
    const taskOrder = application.job_postings?.project_task_orders;
    const positionTitle = taskOrder?.title || "Unknown Position";

    if (!applicant) return null;

    const initials = `${applicant.first_name[0]}${applicant.last_name[0]}`;

    return (
      <div
        key={application.id}
        className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <SecureAvatar
              bucket="application-files"
              photoUrl={profilePic}
              className="h-10 w-10 flex-shrink-0"
              fallback={<span>{initials}</span>}
              alt={`${applicant.first_name} ${applicant.last_name}`}
            />
            <div className="min-w-0">
              <p className="font-medium truncate">
                {applicant.first_name} {applicant.last_name}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {positionTitle}
              </p>
            </div>
          </div>
          <Badge className={cn("capitalize text-xs", statusColors[application.status])}>
            {application.status.replace("_", " ")}
          </Badge>
        </div>

        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Applied {format(new Date(application.created_at), "MMM d, yyyy")}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewApplication(application)}
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
            {application.status !== "approved" &&
              application.status !== "rejected" && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-green-600 hover:text-green-700 hover:bg-green-100"
                    onClick={() => handleApproveClick(application)}
                  >
                    <UserCheck className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleReject(application)}
                  >
                    <UserX className="h-4 w-4" />
                  </Button>
                </>
              )}
          </div>
        </div>
      </div>
    );
  };

  const renderEmptyState = (type: "pending" | "approved") => (
    <div className="text-center py-8">
      <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <p className="text-muted-foreground">
        {type === "pending"
          ? "No pending applications for this project"
          : "No approved applications yet"}
      </p>
    </div>
  );

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Project Applicants
                  {totalApplicants > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {totalApplicants}
                    </Badge>
                  )}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                  />
                </CardTitle>
                <CardDescription>
                  {pendingApplications.length} pending •{" "}
                  {approvedApplications.length} approved
                </CardDescription>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {totalApplicants === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">
                    No applicants for this project yet
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Create a job posting in Staffing to start receiving
                    applications
                  </p>
                </div>
              ) : (
                <Tabs
                  value={activeTab}
                  onValueChange={(v) => setActiveTab(v as "pending" | "approved")}
                >
                  <TabsList className="mb-4">
                    <TabsTrigger value="pending">
                      Pending
                      {pendingApplications.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {pendingApplications.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="approved">
                      Approved
                      {approvedApplications.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {approvedApplications.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="pending">
                    {pendingApplications.length === 0 ? (
                      renderEmptyState("pending")
                    ) : isMobile ? (
                      <div className="space-y-3">
                        {pendingApplications.map(renderMobileCard)}
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Applicant</TableHead>
                              <TableHead>Position</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Applied</TableHead>
                              <TableHead className="w-[120px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pendingApplications.map(renderApplicationRow)}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="approved">
                    {approvedApplications.length === 0 ? (
                      renderEmptyState("approved")
                    ) : isMobile ? (
                      <div className="space-y-3">
                        {approvedApplications.map(renderMobileCard)}
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Applicant</TableHead>
                              <TableHead>Position</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Applied</TableHead>
                              <TableHead className="w-[120px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {approvedApplications.map(renderApplicationRow)}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Application Detail Dialog */}
      <ApplicationDetailDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        application={selectedApplication}
      />

      {/* Approval Type Selection Dialog */}
      <ApprovalTypeSelectionDialog
        open={isApprovalDialogOpen}
        onOpenChange={setIsApprovalDialogOpen}
        onConfirm={handleApprovalConfirm}
        isLoading={approveWithType.isPending}
        applicantName={
          pendingApprovalApp?.applicants
            ? `${pendingApprovalApp.applicants.first_name} ${pendingApprovalApp.applicants.last_name}`
            : ""
        }
      />

      {/* Personnel Assignment Dialog */}
      <PersonnelAssignmentDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        defaultProjectId={projectId}
        onAssignmentChange={handleAssignmentChange}
      />
    </>
  );
}
