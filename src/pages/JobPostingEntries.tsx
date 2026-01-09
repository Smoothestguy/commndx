import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, FileText, FileSpreadsheet, File, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useApplications,
  useJobPostings,
  useApproveApplication,
  useRejectApplication,
  Application,
} from "@/integrations/supabase/hooks/useStaffingApplications";
import { useApplicationFormTemplates, FormField } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { toast } from "sonner";
import { PostingEntriesTable } from "@/components/staffing/PostingEntriesTable";
import { ApplicationDetailDialog } from "@/components/staffing/ApplicationDetailDialog";
import {
  exportApplicationsToCSV,
  exportApplicationsToExcel,
  exportApplicationsToPDF,
  exportApplicationsToJSON,
} from "@/utils/applicationExportUtils";

export default function JobPostingEntries() {
  const { postingId } = useParams<{ postingId: string }>();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: jobPostings } = useJobPostings();
  const { data: formTemplates } = useApplicationFormTemplates();
  const approveApplication = useApproveApplication();
  const rejectApplication = useRejectApplication();

  // Find the current posting
  const currentPosting = jobPostings?.find((p) => p.id === postingId);
  const taskOrder = currentPosting?.project_task_orders;
  const projectName = taskOrder?.projects?.name;
  const formTemplate = formTemplates?.find((t) => t.id === currentPosting?.form_template_id);

  // Fetch applications for this specific posting
  // Filter by status - "active" means non-rejected, "all" includes rejected
  const { data: applications, isLoading } = useApplications({
    postingId,
    status: statusFilter === "all" ? undefined : statusFilter === "active" ? undefined : statusFilter,
  });

  // Further filter for "active" (non-rejected) applications
  const filteredByStatus = useMemo(() => {
    if (!applications) return [];
    if (statusFilter === "active") {
      return applications.filter(app => app.status !== "rejected");
    }
    return applications;
  }, [applications, statusFilter]);

  // Get form fields for dynamic columns
  const formFields = useMemo<FormField[]>(() => {
    if (!formTemplate?.fields) return [];
    return formTemplate.fields.filter((f: FormField) => f.type !== "section");
  }, [formTemplate]);

  const filteredApplications = filteredByStatus;

  const handleExportCSV = () => {
    const selected = selectedIds.size > 0
      ? filteredApplications.filter((app) => selectedIds.has(app.id))
      : filteredApplications;
    try {
      exportApplicationsToCSV(selected, formTemplates || []);
      toast.success("Exported to CSV");
    } catch {
      toast.error("Failed to export");
    }
  };

  const handleExportExcel = async () => {
    const selected = selectedIds.size > 0
      ? filteredApplications.filter((app) => selectedIds.has(app.id))
      : filteredApplications;
    try {
      toast.info("Generating Excel with images...");
      await exportApplicationsToExcel(selected, formTemplates || []);
      toast.success("Exported to Excel");
    } catch {
      toast.error("Failed to export");
    }
  };

  const handleExportPDF = () => {
    const selected = selectedIds.size > 0
      ? filteredApplications.filter((app) => selectedIds.has(app.id))
      : filteredApplications;
    try {
      exportApplicationsToPDF(selected, formTemplates || []);
      toast.success("Exported to PDF");
    } catch {
      toast.error("Failed to export");
    }
  };

  const handleExportJSON = () => {
    const selected = selectedIds.size > 0
      ? filteredApplications.filter((app) => selectedIds.has(app.id))
      : filteredApplications;
    try {
      exportApplicationsToJSON(selected);
      toast.success("Exported to JSON");
    } catch {
      toast.error("Failed to export");
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/staffing/applications")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {taskOrder?.title || "All Entries"}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground">{projectName}</p>
              {formTemplate && (
                <Badge variant="outline" className="text-xs">
                  {formTemplate.name}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export {selectedIds.size > 0 ? `(${selectedIds.size})` : "All"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}>
                <FileText className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>
                <File className="h-4 w-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJSON}>
                <Code className="h-4 w-4 mr-2" />
                Export as JSON (Raw Data)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats + Filters Row */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{filteredApplications.length}</p>
                <p className="text-xs text-muted-foreground">Total Entries</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {filteredApplications.filter((a) => a.status === "approved").length}
                </p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {filteredApplications.filter((a) => a.status === "submitted").length}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active (Hide Rejected)</SelectItem>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              {selectedIds.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear Selection
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entries Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Application Entries</CardTitle>
          <CardDescription>
            Spreadsheet view of all applications with form field data
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <PostingEntriesTable
            applications={filteredApplications}
            formFields={formFields}
            isLoading={isLoading}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onViewApplication={(app) => {
              setSelectedApp(app);
              setShowDetailDialog(true);
            }}
            onApprove={(app) => {
              approveApplication
                .mutateAsync({ applicationId: app.id, notes: "" })
                .then(() => toast.success("Application approved!"))
                .catch(() => toast.error("Failed to approve"));
            }}
            onReject={(app) => {
              rejectApplication
                .mutateAsync({ applicationId: app.id, notes: "" })
                .then(() => toast.success("Application rejected"))
                .catch(() => toast.error("Failed to reject"));
            }}
          />
        </CardContent>
      </Card>

      {/* Application Detail Dialog */}
      <ApplicationDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        application={selectedApp}
      />
    </div>
  );
}
