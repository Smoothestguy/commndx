import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, 
  Plus,
  Copy,
  ExternalLink,
  FileText,
  Pencil,
  Settings,
  Download,
  FileSpreadsheet,
  File,
  Table as TableIcon,
  Check,
  MapPin,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import {
  useApplications,
  useTaskOrders,
  useJobPostings,
  useCreateTaskOrder,
  useCreateJobPosting,
  useUpdateJobPosting,
  useUpdateTaskOrder,
  useApproveApplicationWithType,
  useRejectApplication,
  useRevokeApproval,
  useReverseApprovalWithReason,
  Application,
  TaskOrder,
} from "@/integrations/supabase/hooks/useStaffingApplications";
import { useToggleApplicationContacted } from "@/integrations/supabase/hooks/useApplicationNotes";
import { useApplicationFormTemplates } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { toast } from "sonner";
import { ApplicationsTable } from "@/components/staffing/ApplicationsTable";
import { TablePagination } from "@/components/shared/TablePagination";
import { ApplicationDetailDialog } from "@/components/staffing/ApplicationDetailDialog";
import {
  exportApplicationsToCSV,
  exportApplicationsToExcel,
  exportApplicationsToPDF,
} from "@/utils/applicationExportUtils";
import { ApprovalTypeSelectionDialog, RecordType } from "@/components/personnel/ApprovalTypeSelectionDialog";
import { ReverseApprovalDialog } from "@/components/personnel/ReverseApprovalDialog";

const EXPERIENCE_OPTIONS = [
  { key: "all", label: "All Experience" },
  { key: "Event setup / teardown", label: "Event Setup / Tear down" },
  { key: "Tent installation", label: "Tent Installation" },
  { key: "Forklift / equipment operation", label: "Forklift / Equipment" },
  { key: "None of the above", label: "No Prior Experience" },
];

// Helper to find experience array from application answers
const findExperienceArray = (
  answers: Record<string, unknown> | null,
  formTemplates: Array<{ id: string; fields: Array<{ id: string; type: string; label: string }> }> | undefined,
  formTemplateId: string | null | undefined
): string[] | null => {
  if (!answers || !formTemplates || !formTemplateId) return null;
  
  const template = formTemplates.find(t => t.id === formTemplateId);
  if (!template) return null;
  
  // Find multiselect field with "experience" in the label
  const experienceField = template.fields.find(
    f => f.type === "multiselect" && f.label.toLowerCase().includes("experience")
  );
  
  if (!experienceField) return null;
  
  const value = answers[experienceField.id];
  return Array.isArray(value) ? value : null;
};

export default function StaffingApplications() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [experienceFilter, setExperienceFilter] = useState<string>("all");
  const [postingFilter, setPostingFilter] = useState<string>("all");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditPostingDialog, setShowEditPostingDialog] = useState(false);
  const [showEditTaskOrderDialog, setShowEditTaskOrderDialog] = useState(false);
  const [editingPosting, setEditingPosting] = useState<{ id: string; formTemplateId: string | null } | null>(null);
  const [editingTaskOrder, setEditingTaskOrder] = useState<TaskOrder | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activePostingsOpen, setActivePostingsOpen] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Approval type selection dialog state
  const [appToApprove, setAppToApprove] = useState<Application | null>(null);
  const [showTypeSelectionDialog, setShowTypeSelectionDialog] = useState(false);
  
  // Reverse approval dialog state
  const [appToReverse, setAppToReverse] = useState<Application | null>(null);
  const [showReverseDialog, setShowReverseDialog] = useState(false);
  
  // New task order form state
  const [newTaskOrder, setNewTaskOrder] = useState({
    project_id: "",
    title: "",
    job_description: "",
    headcount_needed: 1,
    location_address: "",
    form_template_id: "",
  });

  // Edit task order form state
  const [editTaskOrderForm, setEditTaskOrderForm] = useState({
    title: "",
    job_description: "",
    headcount_needed: 1,
    location_address: "",
  });

  const { data: projects } = useProjects();
  const { data: applications, isLoading } = useApplications({
    status: statusFilter !== "all" ? statusFilter : undefined,
    projectId: projectFilter !== "all" ? projectFilter : undefined,
  });
  const { data: taskOrders } = useTaskOrders();
  const { data: jobPostings } = useJobPostings();
  const { data: formTemplates } = useApplicationFormTemplates();

  const createTaskOrder = useCreateTaskOrder();
  const createJobPosting = useCreateJobPosting();
  const updateJobPosting = useUpdateJobPosting();
  const updateTaskOrder = useUpdateTaskOrder();
  const approveApplicationWithType = useApproveApplicationWithType();
  const rejectApplication = useRejectApplication();
  const revokeApproval = useRevokeApproval();
  const reverseApproval = useReverseApprovalWithReason();
  const toggleContacted = useToggleApplicationContacted();

  // Handle toggle contacted
  const handleToggleContacted = (app: Application) => {
    const newContactedState = !app.contacted_at;
    toggleContacted.mutate(
      { applicationId: app.id, contacted: newContactedState },
      {
        onSuccess: () => {
          toast.success(newContactedState ? "Marked as contacted" : "Marked as not contacted");
        },
        onError: () => {
          toast.error("Failed to update contact status");
        },
      }
    );
  };

  // Handle approve click - opens type selection dialog
  const handleApproveClick = (app: Application) => {
    setAppToApprove(app);
    setShowTypeSelectionDialog(true);
  };

  // Handle type selection confirmation
  const handleApproveWithType = async (recordType: RecordType) => {
    if (!appToApprove) return;
    
    try {
      const result = await approveApplicationWithType.mutateAsync({
        applicationId: appToApprove.id,
        recordType,
        notes: "",
      });
      
      const typeLabels: Record<RecordType, string> = {
        personnel: "Personnel",
        vendor: "Vendor",
        customer: "Customer",
        personnel_vendor: "Personnel + Vendor",
      };
      
      toast.success(`Application approved! Created as ${typeLabels[recordType]}.`);
    } catch (error) {
      toast.error("Failed to approve application");
    } finally {
      setShowTypeSelectionDialog(false);
      setAppToApprove(null);
    }
  };

  // Get job postings that have applications for the filter dropdown
  const postingsWithApplications = useMemo(() => {
    if (!jobPostings || !applications) return [];
    const postingIdsWithApps = new Set(applications.map(app => app.job_posting_id));
    return jobPostings.filter(p => postingIdsWithApps.has(p.id));
  }, [jobPostings, applications]);

  // Identify applicants who have NEVER been approved (across all their applications)
  // These are "new" applicants whose applications should appear in the main list
  const neverApprovedApplicantIds = useMemo(() => {
    if (!applications) return new Set<string>();
    
    // Group applications by applicant
    const applicantApplications = new Map<string, Application[]>();
    for (const app of applications) {
      const existing = applicantApplications.get(app.applicant_id) || [];
      existing.push(app);
      applicantApplications.set(app.applicant_id, existing);
    }
    
    // Find applicants who have never had an approved application
    const neverApproved = new Set<string>();
    for (const [applicantId, apps] of applicantApplications) {
      const hasApproval = apps.some(a => a.status === 'approved');
      if (!hasApproval) {
        neverApproved.add(applicantId);
      }
    }
    
    return neverApproved;
  }, [applications]);

  // Filter applications by search, experience, and job posting
  // Main list shows ALL applications from applicants who have NEVER been approved
  const filteredApplications = useMemo(() => {
    return applications?.filter((app) => {
      const applicant = app.applicants;
      if (!applicant) return false;
      
      // Always show approved applications
      // For non-approved applications, only show if the applicant has never been approved before
      if (app.status !== 'approved' && !neverApprovedApplicantIds.has(app.applicant_id)) {
        return false;
      }
      
      // Job posting filter
      if (postingFilter !== "all" && app.job_posting_id !== postingFilter) {
        return false;
      }
      
      // Search filter
      const fullName = `${applicant.first_name} ${applicant.last_name}`.toLowerCase();
      const email = applicant.email.toLowerCase();
      const searchLower = search.toLowerCase();
      const matchesSearch = fullName.includes(searchLower) || email.includes(searchLower);
      if (!matchesSearch) return false;
      
      // Experience filter
      if (experienceFilter !== "all") {
        const experienceArray = findExperienceArray(
          app.answers as Record<string, unknown>,
          formTemplates as Array<{ id: string; fields: Array<{ id: string; type: string; label: string }> }>,
          app.job_postings?.form_template_id
        );
        if (!experienceArray || !experienceArray.includes(experienceFilter)) {
          return false;
        }
      }
      
      return true;
    });
  }, [applications, search, experienceFilter, postingFilter, formTemplates, neverApprovedApplicantIds]);

  // Paginated applications
  const paginatedApplications = useMemo(() => {
    if (!filteredApplications) return [];
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredApplications.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredApplications, currentPage, rowsPerPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, projectFilter, statusFilter, experienceFilter, postingFilter]);

  const handleCreateTaskOrder = async () => {
    if (!newTaskOrder.project_id || !newTaskOrder.title) {
      toast.error("Please fill in required fields");
      return;
    }

    try {
      const taskOrder = await createTaskOrder.mutateAsync({
        project_id: newTaskOrder.project_id,
        title: newTaskOrder.title,
        job_description: newTaskOrder.job_description || null,
        headcount_needed: newTaskOrder.headcount_needed,
        location_address: newTaskOrder.location_address || null,
        location_lat: null,
        location_lng: null,
        start_at: null,
        status: 'open',
      });

      // Automatically create a job posting
      const posting = await createJobPosting.mutateAsync({
        taskOrderId: taskOrder.id,
        formTemplateId: newTaskOrder.form_template_id || undefined,
      });
      
      const publicUrl = `${window.location.origin}/apply/${posting.public_token}`;
      await navigator.clipboard.writeText(publicUrl);
      
      toast.success("Task order created! Application link copied to clipboard.");
      setShowCreateDialog(false);
      setNewTaskOrder({
        project_id: "",
        title: "",
        job_description: "",
        headcount_needed: 1,
        location_address: "",
        form_template_id: "",
      });
    } catch (error) {
      toast.error("Failed to create task order");
    }
  };

  const copyApplicationLink = (token: string) => {
    const url = `${window.location.origin}/apply/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Application link copied to clipboard");
  };

  const handleEditPosting = (posting: any) => {
    setEditingPosting({
      id: posting.id,
      formTemplateId: posting.form_template_id || "",
    });
    setShowEditPostingDialog(true);
  };

  const handleEditTaskOrder = (posting: any) => {
    const taskOrder = posting.project_task_orders;
    if (!taskOrder) return;
    setEditingTaskOrder(taskOrder);
    setEditTaskOrderForm({
      title: taskOrder.title || "",
      job_description: taskOrder.job_description || "",
      headcount_needed: taskOrder.headcount_needed || 1,
      location_address: taskOrder.location_address || "",
    });
    setShowEditTaskOrderDialog(true);
  };

  const handleSaveTaskOrderEdit = async () => {
    if (!editingTaskOrder) return;
    try {
      await updateTaskOrder.mutateAsync({
        id: editingTaskOrder.id,
        title: editTaskOrderForm.title,
        job_description: editTaskOrderForm.job_description || null,
        headcount_needed: editTaskOrderForm.headcount_needed,
        location_address: editTaskOrderForm.location_address || null,
      });
      toast.success("Task order updated");
      setShowEditTaskOrderDialog(false);
      setEditingTaskOrder(null);
    } catch (error) {
      toast.error("Failed to update task order");
    }
  };

  const handleSavePostingEdit = async () => {
    if (!editingPosting) return;
    try {
      await updateJobPosting.mutateAsync({
        id: editingPosting.id,
        formTemplateId: editingPosting.formTemplateId || null,
      });
      toast.success("Job posting updated");
      setShowEditPostingDialog(false);
      setEditingPosting(null);
    } catch (error) {
      toast.error("Failed to update job posting");
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Staffing Applications</h1>
          <p className="text-muted-foreground">Review and manage job applications</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="flex-1 sm:flex-none h-10" onClick={() => navigate("/staffing/map")}>
            <MapPin className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Map View</span>
            <span className="sm:hidden">Map</span>
          </Button>
          <Button variant="outline" className="flex-1 sm:flex-none h-10" onClick={() => navigate("/staffing/form-templates")}>
            <FileText className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Form Templates</span>
            <span className="sm:hidden">Forms</span>
          </Button>
          <Button className="flex-1 sm:flex-none h-10" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">New Task Order</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Active Postings - Collapsible */}
      {jobPostings && jobPostings.filter(p => p.is_open).length > 0 && (
        <Card>
          <CardHeader 
            className="cursor-pointer select-none"
            onClick={() => setActivePostingsOpen(!activePostingsOpen)}
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Active Job Postings</CardTitle>
                <CardDescription>Share these links to collect applications</CardDescription>
              </div>
              <ChevronDown 
                className={`h-5 w-5 text-muted-foreground transition-transform ${
                  activePostingsOpen ? "rotate-180" : ""
                }`} 
              />
            </div>
          </CardHeader>
          {activePostingsOpen && (
            <CardContent>
              <div className="space-y-2">
                {jobPostings.filter(p => p.is_open).map((posting) => (
                  <div
                    key={posting.id}
                    className="p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between"
                    onClick={() => navigate(`/staffing/applications/posting/${posting.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{posting.project_task_orders?.title}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm text-muted-foreground truncate">
                          {posting.project_task_orders?.projects?.name}
                        </p>
                        {posting.form_template_id && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {formTemplates?.find(t => t.id === posting.form_template_id)?.name || "Custom Form"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div 
                      className="flex flex-wrap items-center gap-1 sm:gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50 justify-end shrink-0" 
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0"
                        onClick={() => navigate(`/staffing/applications/posting/${posting.id}`)}
                        title="View all entries"
                      >
                        <TableIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0"
                        onClick={() => handleEditTaskOrder(posting)}
                        title="Edit task order details"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0"
                        onClick={() => handleEditPosting(posting)}
                        title="Edit form template"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-2 text-xs sm:px-3 sm:text-sm"
                        onClick={() => copyApplicationLink(posting.public_token)}
                      >
                        <Copy className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Copy Link</span>
                        <span className="sm:hidden ml-1">Copy</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0"
                        onClick={() => window.open(`/apply/${posting.public_token}`, "_blank")}
                        title="Open form in new tab"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="reviewing">Reviewing</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={postingFilter} onValueChange={setPostingFilter}>
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue placeholder="All Job Postings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Job Postings</SelectItem>
                {postingsWithApplications.map((posting) => (
                  <SelectItem key={posting.id} value={posting.id}>
                    {posting.project_task_orders?.title} — {posting.project_task_orders?.projects?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Experience Filter */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground mr-2 self-center">Experience:</span>
            {EXPERIENCE_OPTIONS.map((option) => (
              <Badge
                key={option.key}
                variant={experienceFilter === option.key ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/80 transition-colors"
                onClick={() => setExperienceFilter(option.key)}
              >
                {option.label}
                {experienceFilter === option.key && <Check className="h-3 w-3 ml-1" />}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedIds.size} application(s) selected
              </span>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        const selected = (filteredApplications || []).filter(
                          (app) => selectedIds.has(app.id)
                        );
                        try {
                          exportApplicationsToCSV(selected);
                          toast.success("Exported to CSV");
                        } catch (e) {
                          toast.error("Failed to export");
                        }
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Export as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        const selected = (filteredApplications || []).filter(
                          (app) => selectedIds.has(app.id)
                        );
                        try {
                          toast.info("Generating Excel with images...");
                          await exportApplicationsToExcel(selected, formTemplates || []);
                          toast.success("Exported to Excel");
                        } catch (e) {
                          toast.error("Failed to export");
                        }
                      }}
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Export as Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const selected = (filteredApplications || []).filter(
                          (app) => selectedIds.has(app.id)
                        );
                        try {
                          exportApplicationsToPDF(selected);
                          toast.success("Exported to PDF");
                        } catch (e) {
                          toast.error("Failed to export");
                        }
                      }}
                    >
                      <File className="h-4 w-4 mr-2" />
                      Export as PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Applications Table */}
      <Card>
        <CardContent className="p-0">
          <ApplicationsTable
            applications={paginatedApplications}
        isLoading={isLoading}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onViewApplication={(app) => {
          setSelectedApp(app);
          setShowDetailDialog(true);
        }}
        onApprove={handleApproveClick}
        onReject={(app) => {
          rejectApplication.mutateAsync({
            applicationId: app.id,
            notes: "",
          }).then(() => {
            toast.success("Application rejected");
          }).catch(() => {
            toast.error("Failed to reject application");
          });
        }}
        onRevokeApproval={(app) => {
          revokeApproval.mutateAsync({
            applicationId: app.id,
          }).then(() => {
            toast.success("Approval revoked. Applicant can now reapply.");
          }).catch(() => {
            toast.error("Failed to revoke approval");
          });
        }}
        onReverseApproval={(app) => {
          setAppToReverse(app);
          setShowReverseDialog(true);
        }}
        onToggleContacted={handleToggleContacted}
          />
          <TablePagination
            currentPage={currentPage}
            totalCount={filteredApplications?.length || 0}
            rowsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={(size) => {
              setRowsPerPage(size);
              setCurrentPage(1);
            }}
          />
        </CardContent>
      </Card>

      {/* Approval Type Selection Dialog */}
      <ApprovalTypeSelectionDialog
        open={showTypeSelectionDialog}
        onOpenChange={(open) => {
          setShowTypeSelectionDialog(open);
          if (!open) setAppToApprove(null);
        }}
        onConfirm={handleApproveWithType}
        isLoading={approveApplicationWithType.isPending}
        applicantName={appToApprove ? `${appToApprove.applicants?.first_name || ''} ${appToApprove.applicants?.last_name || ''}` : ''}
      />

      {/* Reverse Approval Dialog */}
      <ReverseApprovalDialog
        open={showReverseDialog}
        onOpenChange={(open) => {
          setShowReverseDialog(open);
          if (!open) setAppToReverse(null);
        }}
        onConfirm={async (reason) => {
          if (!appToReverse) return;
          try {
            await reverseApproval.mutateAsync({
              applicationId: appToReverse.id,
              reason,
            });
            toast.success("Approval reversed. Application is now back to submitted status.");
            setShowReverseDialog(false);
            setAppToReverse(null);
          } catch (error) {
            toast.error("Failed to reverse approval");
          }
        }}
        registrantName={appToReverse ? `${appToReverse.applicants?.first_name || ''} ${appToReverse.applicants?.last_name || ''}` : ''}
        hasPersonnelRecord={true}
        hasVendorRecord={true}
        hasCustomerRecord={false}
        isLoading={reverseApproval.isPending}
      />

      {/* Application Detail Dialog */}
      <ApplicationDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        application={selectedApp}
      />

      {/* Edit Job Posting Dialog */}
      <Dialog open={showEditPostingDialog} onOpenChange={setShowEditPostingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Job Posting</DialogTitle>
            <DialogDescription>
              Change the form template for this job posting
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Application Form Template</Label>
              <Select
                value={editingPosting?.formTemplateId || "none"}
                onValueChange={(v) => setEditingPosting(prev => prev ? { ...prev, formTemplateId: v === "none" ? null : v } : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No custom form (basic fields only)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No custom form (basic fields only)</SelectItem>
                  {formTemplates?.filter(t => t.is_active).map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} ({template.fields.length} fields)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Changes will apply to new applications only
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditPostingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePostingEdit} disabled={updateJobPosting.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Order Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-h-[90vh] sm:max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Create Task Order</DialogTitle>
            <DialogDescription>
              Create a staffing request and generate an application link
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div>
              <Label>Project *</Label>
              <Select
                value={newTaskOrder.project_id}
                onValueChange={(v) => setNewTaskOrder({ ...newTaskOrder, project_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Position Title *</Label>
              <Input
                value={newTaskOrder.title}
                onChange={(e) => setNewTaskOrder({ ...newTaskOrder, title: e.target.value })}
                placeholder="e.g., General Laborer, Foreman"
              />
            </div>
            <div>
              <Label>Job Description</Label>
              <Textarea
                value={newTaskOrder.job_description}
                onChange={(e) => setNewTaskOrder({ ...newTaskOrder, job_description: e.target.value })}
                placeholder="Describe the role and requirements..."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Headcount Needed</Label>
                <Input
                  type="number"
                  min={1}
                  value={newTaskOrder.headcount_needed}
                  onChange={(e) => setNewTaskOrder({ ...newTaskOrder, headcount_needed: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={newTaskOrder.location_address}
                  onChange={(e) => setNewTaskOrder({ ...newTaskOrder, location_address: e.target.value })}
                  placeholder="Job site address"
                />
              </div>
            </div>
            <div>
              <Label>Application Form Template</Label>
              <Select
                value={newTaskOrder.form_template_id || "none"}
                onValueChange={(v) => setNewTaskOrder({ ...newTaskOrder, form_template_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No custom form (basic fields only)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No custom form (basic fields only)</SelectItem>
                  {formTemplates?.filter(t => t.is_active).map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} ({template.fields.length} fields)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Select a form template to add custom fields to the application
              </p>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTaskOrder}
              disabled={createTaskOrder.isPending}
            >
              Create & Copy Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task Order Dialog */}
      <Dialog open={showEditTaskOrderDialog} onOpenChange={setShowEditTaskOrderDialog}>
        <DialogContent className="max-h-[90vh] sm:max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Task Order</DialogTitle>
            <DialogDescription>
              Update the task order details
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div>
              <Label>Position Title *</Label>
              <Input
                value={editTaskOrderForm.title}
                onChange={(e) => setEditTaskOrderForm({ ...editTaskOrderForm, title: e.target.value })}
                placeholder="e.g., General Laborer, Foreman"
              />
            </div>
            <div>
              <Label>Job Description</Label>
              <Textarea
                value={editTaskOrderForm.job_description}
                onChange={(e) => setEditTaskOrderForm({ ...editTaskOrderForm, job_description: e.target.value })}
                placeholder="Describe the role and requirements..."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Headcount Needed</Label>
                <Input
                  type="number"
                  min={1}
                  value={editTaskOrderForm.headcount_needed}
                  onChange={(e) => setEditTaskOrderForm({ ...editTaskOrderForm, headcount_needed: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={editTaskOrderForm.location_address}
                  onChange={(e) => setEditTaskOrderForm({ ...editTaskOrderForm, location_address: e.target.value })}
                  placeholder="Job site address"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setShowEditTaskOrderDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTaskOrderEdit}
              disabled={updateTaskOrder.isPending}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
