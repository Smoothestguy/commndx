import { useState } from "react";
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
  useApproveApplication,
  useRejectApplication,
  Application,
  TaskOrder,
} from "@/integrations/supabase/hooks/useStaffingApplications";
import { useApplicationFormTemplates } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { toast } from "sonner";
import { ApplicationsTable } from "@/components/staffing/ApplicationsTable";
import { ApplicationDetailDialog } from "@/components/staffing/ApplicationDetailDialog";
import {
  exportApplicationsToCSV,
  exportApplicationsToExcel,
  exportApplicationsToPDF,
} from "@/utils/applicationExportUtils";


export default function StaffingApplications() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditPostingDialog, setShowEditPostingDialog] = useState(false);
  const [showEditTaskOrderDialog, setShowEditTaskOrderDialog] = useState(false);
  const [editingPosting, setEditingPosting] = useState<{ id: string; formTemplateId: string | null } | null>(null);
  const [editingTaskOrder, setEditingTaskOrder] = useState<TaskOrder | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
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
  const approveApplication = useApproveApplication();
  const rejectApplication = useRejectApplication();

  // Filter applications by search
  const filteredApplications = applications?.filter((app) => {
    const applicant = app.applicants;
    if (!applicant) return false;
    const fullName = `${applicant.first_name} ${applicant.last_name}`.toLowerCase();
    const email = applicant.email.toLowerCase();
    const searchLower = search.toLowerCase();
    return fullName.includes(searchLower) || email.includes(searchLower);
  });


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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/staffing/form-templates")}>
            <FileText className="h-4 w-4 mr-2" />
            Form Templates
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Task Order
          </Button>
        </div>
      </div>

      {/* Active Postings */}
      {jobPostings && jobPostings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Job Postings</CardTitle>
            <CardDescription>Share these links to collect applications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {jobPostings.filter(p => p.is_open).map((posting) => (
                <div
                  key={posting.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => window.open(`/apply/${posting.public_token}`, "_blank")}
                >
                  <div>
                    <p className="font-medium">{posting.project_task_orders?.title}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">
                        {posting.project_task_orders?.projects?.name}
                      </p>
                      {posting.form_template_id && (
                        <Badge variant="outline" className="text-xs">
                          {formTemplates?.find(t => t.id === posting.form_template_id)?.name || "Custom Form"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/staffing/applications/posting/${posting.id}`)}
                      title="View all entries"
                    >
                      <TableIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditTaskOrder(posting)}
                      title="Edit task order details"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditPosting(posting)}
                      title="Edit form template"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyApplicationLink(posting.public_token)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy Link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`/apply/${posting.public_token}`, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
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
      <ApplicationsTable
        applications={filteredApplications || []}
        isLoading={isLoading}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onViewApplication={(app) => {
          setSelectedApp(app);
          setShowDetailDialog(true);
        }}
        onApprove={(app) => {
          approveApplication.mutateAsync({
            applicationId: app.id,
            notes: "",
          }).then(() => {
            toast.success("Application approved! Applicant added to Personnel.");
          }).catch(() => {
            toast.error("Failed to approve application");
          });
        }}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task Order</DialogTitle>
            <DialogDescription>
              Create a staffing request and generate an application link
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
            <div className="grid grid-cols-2 gap-4">
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
          <DialogFooter>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task Order</DialogTitle>
            <DialogDescription>
              Update the task order details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
            <div className="grid grid-cols-2 gap-4">
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
          <DialogFooter>
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
