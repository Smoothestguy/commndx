import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Users,
  Plus,
  Copy,
  ExternalLink,
  FileText
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import {
  useApplications,
  useTaskOrders,
  useJobPostings,
  useCreateTaskOrder,
  useCreateJobPosting,
  useApproveApplication,
  useRejectApplication,
  Application,
} from "@/integrations/supabase/hooks/useStaffingApplications";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  reviewing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export default function StaffingApplications() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [actionNotes, setActionNotes] = useState("");
  
  // New task order form state
  const [newTaskOrder, setNewTaskOrder] = useState({
    project_id: "",
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

  const createTaskOrder = useCreateTaskOrder();
  const createJobPosting = useCreateJobPosting();
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

  const handleApprove = async () => {
    if (!selectedApp) return;
    try {
      await approveApplication.mutateAsync({
        applicationId: selectedApp.id,
        notes: actionNotes,
      });
      toast.success("Application approved! Applicant added to Personnel.");
      setShowDetailDialog(false);
      setSelectedApp(null);
      setActionNotes("");
    } catch (error) {
      toast.error("Failed to approve application");
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    try {
      await rejectApplication.mutateAsync({
        applicationId: selectedApp.id,
        notes: actionNotes,
      });
      toast.success("Application rejected");
      setShowDetailDialog(false);
      setSelectedApp(null);
      setActionNotes("");
    } catch (error) {
      toast.error("Failed to reject application");
    }
  };

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
      const posting = await createJobPosting.mutateAsync(taskOrder.id);
      
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
                    <p className="text-sm text-muted-foreground">
                      {posting.project_task_orders?.projects?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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

      {/* Applications Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead className="hidden sm:table-cell">Position</TableHead>
                <TableHead className="hidden md:table-cell">Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Loading applications...
                  </TableCell>
                </TableRow>
              ) : filteredApplications?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No applications found
                  </TableCell>
                </TableRow>
              ) : (
                filteredApplications?.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {app.applicants?.first_name} {app.applicants?.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">{app.applicants?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div>
                        <p className="font-medium">
                          {app.job_postings?.project_task_orders?.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {app.job_postings?.project_task_orders?.projects?.name}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {format(new Date(app.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[app.status]}>
                        {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedApp(app);
                            setShowDetailDialog(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {app.status === "submitted" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600"
                              onClick={() => {
                                setSelectedApp(app);
                                setActionNotes("");
                                handleApprove();
                              }}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => {
                                setSelectedApp(app);
                                setActionNotes("");
                                handleReject();
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Application Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
            <DialogDescription>
              Review application from {selectedApp?.applicants?.first_name}{" "}
              {selectedApp?.applicants?.last_name}
            </DialogDescription>
          </DialogHeader>
          {selectedApp && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="font-medium">
                    {selectedApp.applicants?.first_name} {selectedApp.applicants?.last_name}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={statusColors[selectedApp.status]}>
                    {selectedApp.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p>{selectedApp.applicants?.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p>{selectedApp.applicants?.phone || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Home ZIP</Label>
                  <p>{selectedApp.applicants?.home_zip || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Submitted</Label>
                  <p>{format(new Date(selectedApp.created_at), "MMM d, yyyy h:mm a")}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Position</Label>
                <p className="font-medium">
                  {selectedApp.job_postings?.project_task_orders?.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedApp.job_postings?.project_task_orders?.projects?.name}
                </p>
              </div>

              {selectedApp.answers && Object.keys(selectedApp.answers).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Form Responses</Label>
                  <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                    {Object.entries(selectedApp.answers as Record<string, unknown>).map(([key, value]) => (
                      <div key={key}>
                        <p className="text-xs font-medium text-muted-foreground capitalize">
                          {key.replace(/_/g, " ")}
                        </p>
                        <p className="text-sm">
                          {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value || "N/A")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedApp.status === "submitted" && (
                <div>
                  <Label>Admin Notes</Label>
                  <Textarea
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Add notes about this application..."
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedApp?.status === "submitted" && (
              <>
                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={rejectApplication.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={approveApplication.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve & Add to Personnel
                </Button>
              </>
            )}
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
    </div>
  );
}
