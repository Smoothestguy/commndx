import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useEstimates } from "@/integrations/supabase/hooks/useEstimates";
import { useJobOrders } from "@/integrations/supabase/hooks/useJobOrders";
import { useInvoices } from "@/integrations/supabase/hooks/useInvoices";
import { useMilestonesByProject, useAddMilestone, useUpdateMilestone, useDeleteMilestone, Milestone } from "@/integrations/supabase/hooks/useMilestones";
import { useChangeOrdersByProject } from "@/integrations/supabase/hooks/useChangeOrders";
import { useTMTicketsByProject } from "@/integrations/supabase/hooks/useTMTickets";
import { usePurchaseOrders } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { useVendorBills } from "@/integrations/supabase/hooks/useVendorBills";
import { useExpensesByProject } from "@/integrations/supabase/hooks/useExpenseReports";
import { useProjectTimeEntryCosts } from "@/integrations/supabase/hooks/useProjectLaborExpenses";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/components/shared/DataTable";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calendar, User, Loader2, FileText, Briefcase, Receipt, Target, Plus, Edit, Trash2, Download, MapPin, Phone, Mail, Hash } from "lucide-react";
import { ProjectDocuments } from "@/components/projects/ProjectDocuments";
import { format } from "date-fns";
import { generateProjectReportPDF } from "@/utils/pdfExport";
import { ProjectFinancialSummary } from "@/components/project-hub/ProjectFinancialSummary";
import { ProjectLaborAllocation } from "@/components/project-hub/ProjectLaborAllocation";
import { ProjectChangeOrdersList } from "@/components/project-hub/ProjectChangeOrdersList";
import { ProjectTMTicketsList } from "@/components/project-hub/ProjectTMTicketsList";
import { ProjectPurchaseOrdersList } from "@/components/project-hub/ProjectPurchaseOrdersList";
import { ProjectVendorBillsList } from "@/components/project-hub/ProjectVendorBillsList";
import { ProjectTimeEntriesList } from "@/components/project-hub/ProjectTimeEntriesList";
import { ProjectRateBracketsSection } from "@/components/project-hub/ProjectRateBracketsSection";
import { ProjectPersonnelSection } from "@/components/project-hub/ProjectPersonnelSection";
import { ProjectApplicantsSection } from "@/components/project-hub/ProjectApplicantsSection";
import { ProjectAssetAssignmentsSection } from "@/components/project-hub/ProjectAssetAssignmentsSection";
import { ProjectRoomsSection } from "@/components/project-hub/rooms/ProjectRoomsSection";

import { ProjectActivityTimeline } from "@/components/project-hub/ProjectActivityTimeline";
import { AddTMTicketDialog } from "@/components/tm-tickets/AddTMTicketDialog";
import { CreateJobOrderDialog } from "@/components/job-orders/CreateJobOrderDialog";
import { CreateProjectInvoiceDialog } from "@/components/invoices/CreateProjectInvoiceDialog";

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: customers } = useCustomers();
  const { data: estimates } = useEstimates();
  const { data: jobOrders } = useJobOrders();
  const { data: invoices } = useInvoices();
  const { data: milestones } = useMilestonesByProject(id);
  const { data: changeOrders } = useChangeOrdersByProject(id);
  const { data: tmTickets } = useTMTicketsByProject(id);
  const { data: allPurchaseOrders } = usePurchaseOrders();
  const { data: projectVendorBills } = useVendorBills({ project_id: id });
  const { data: projectExpenses } = useExpensesByProject(id);
  const { data: timeEntryCosts } = useProjectTimeEntryCosts(id);
  
  // Fetch supervision cost breakdown
  const { data: supervisionBreakdown } = useQuery({
    queryKey: ["project-supervision-costs", id],
    queryFn: async () => {
      if (!id) return { supervisionCost: 0, fieldCost: 0 };
      
      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          hours,
          hourly_rate,
          is_overhead,
          personnel:personnel_id (hourly_rate, title)
        `)
        .eq("project_id", id)
        .not("personnel_id", "is", null);
      
      if (error) throw error;
      
      let supervisionCost = 0;
      let fieldCost = 0;
      
      for (const entry of data || []) {
        if ((entry as any).is_overhead) continue;
        const p = entry.personnel as any;
        const rate = (entry as any).hourly_rate ?? p?.hourly_rate ?? 0;
        const cost = (entry.hours || 0) * rate;
        const title = (p?.title || "").toLowerCase();
        const isSupervision = title.includes("superintendent") || title.includes("supervisor") || title.includes("foreman");
        
        if (isSupervision) supervisionCost += cost;
        else fieldCost += cost;
      }
      
      return { supervisionCost, fieldCost };
    },
    enabled: !!id,
  });

  const addMilestone = useAddMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();

  const [isMilestoneDialogOpen, setIsMilestoneDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [milestoneFormData, setMilestoneFormData] = useState({
    title: "",
    description: "",
    due_date: "",
    status: "pending" as "pending" | "in-progress" | "completed" | "delayed",
    completion_percentage: 0,
  });
  const [isTMTicketDialogOpen, setIsTMTicketDialogOpen] = useState(false);
  const [isJobOrderDialogOpen, setIsJobOrderDialogOpen] = useState(false);
  const [isCreateInvoiceDialogOpen, setIsCreateInvoiceDialogOpen] = useState(false);

  const project = projects?.find((p) => p.id === id);
  const customer = customers?.find((c) => c.id === project?.customer_id);

  // Filter purchase orders for this project
  const projectPurchaseOrders = useMemo(
    () => allPurchaseOrders?.filter((po) => po.project_id === id) || [],
    [allPurchaseOrders, id]
  );

  // Filter related documents
  const projectEstimates = useMemo(
    () => estimates?.filter((e) => e.project_id === id) || [],
    [estimates, id]
  );

  const projectJobOrders = useMemo(
    () => jobOrders?.filter((j) => j.project_id === id) || [],
    [jobOrders, id]
  );

  const projectInvoices = useMemo(() => {
    const jobOrderIds = projectJobOrders.map((j) => j.id);
    const changeOrderIds = (changeOrders || []).map((co) => co.id);
    
    return invoices?.filter((i) => 
      i.project_id === id ||
      (i.job_order_id && jobOrderIds.includes(i.job_order_id)) ||
      (i.change_order_id && changeOrderIds.includes(i.change_order_id))
    ) || [];
  }, [invoices, projectJobOrders, changeOrders, id]);

  // Calculate totals
  const totals = useMemo(() => {
    const estimatesTotal = projectEstimates.reduce((sum, e) => sum + e.total, 0);
    const jobOrdersTotal = projectJobOrders.reduce((sum, j) => sum + j.total, 0);
    const invoicesTotal = projectInvoices.reduce((sum, i) => sum + i.total, 0);
    const paidTotal = projectInvoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + i.total, 0);

    return { estimatesTotal, jobOrdersTotal, invoicesTotal, paidTotal };
  }, [projectEstimates, projectJobOrders, projectInvoices]);

  // Calculate financial summary for project hub
  const financialData = useMemo(() => {
    const originalContractValue = projectJobOrders.reduce((sum, j) => sum + j.total, 0);
    
    // Calculate change orders total with additive/deductive logic
    const changeOrdersTotal = (changeOrders || [])
      .filter((co) => co.status === "approved")
      .reduce((sum, co) => {
        const changeType = (co as any).change_type || 'additive';
        return changeType === 'deductive' ? sum - co.total : sum + co.total;
      }, 0);
    
    // Calculate T&M tickets total with additive/deductive logic
    const tmTicketsTotal = (tmTickets || [])
      .filter((t) => ["approved", "signed", "invoiced"].includes(t.status))
      .reduce((sum, t) => {
        const changeType = (t as any).change_type || 'additive';
        return changeType === 'deductive' ? sum - t.total : sum + t.total;
      }, 0);
    
    const totalContractValue = originalContractValue + changeOrdersTotal + tmTicketsTotal;
    
    const totalPOValue = projectPurchaseOrders.reduce((sum, po) => {
      return sum + po.total + (po.total_addendum_amount || 0);
    }, 0);
    
    const totalVendorBilled = (projectVendorBills || []).reduce((sum, bill) => sum + bill.total, 0);
    const totalVendorPaid = (projectVendorBills || []).reduce((sum, bill) => sum + (bill.paid_amount || 0), 0);
    const totalInvoiced = projectInvoices.reduce((sum, i) => sum + i.total, 0);
    const totalPaid = projectInvoices.reduce((sum, i) => sum + (i.paid_amount || 0), 0);
    const grossProfit = totalContractValue - totalPOValue;
    const grossMargin = totalContractValue > 0 ? (grossProfit / totalContractValue) * 100 : 0;

    // Net profit calculations - labor costs from internal sources only
    // Time entry labor (real-time as hours are logged)
    const timeEntryLaborCost = timeEntryCosts?.totalLaborCost || 0;
    // Personnel payment allocations (finalized payroll - non-PO labor costs)
    const personnelPaymentCost = projectExpenses?.personnel_total || 0;
    // NOTE: vendorLaborCost and vendorOtherTotal are EXCLUDED from cost calculation
    // because vendor bills are payments AGAINST POs already counted in totalPOValue.
    // Including them would double-count sub costs.
    
    // Total labor = time entries + personnel payments (no vendor bills)
    const totalLaborCost = timeEntryLaborCost + personnelPaymentCost;
    // Other expenses = 0 (vendor bill line items are PO payments, not separate expenses)
    const totalOtherExpenses = 0;
    const totalAllCosts = totalPOValue + totalLaborCost;
    const netProfit = totalContractValue - totalAllCosts;
    const netMargin = totalContractValue > 0 ? (netProfit / totalContractValue) * 100 : 0;

    return {
      originalContractValue,
      changeOrdersTotal,
      tmTicketsTotal,
      totalContractValue,
      totalPOValue,
      totalVendorBilled,
      totalVendorPaid,
      totalInvoiced,
      totalPaid,
      grossProfit,
      grossMargin,
      totalLaborCost,
      totalOtherExpenses,
      netProfit,
      netMargin,
      supervisionLaborCost: supervisionBreakdown?.supervisionCost || 0,
      fieldLaborCost: supervisionBreakdown?.fieldCost || 0,
    };
  }, [projectJobOrders, changeOrders, tmTickets, projectPurchaseOrders, projectInvoices, projectVendorBills, projectExpenses, timeEntryCosts, supervisionBreakdown]);

  // Calculate overall project completion
  const overallCompletion = useMemo(() => {
    if (!milestones || milestones.length === 0) {
      // Fallback to job order completion
      if (projectJobOrders.length === 0) return 0;
      const completedJobs = projectJobOrders.filter((j) => j.status === "completed").length;
      return Math.round((completedJobs / projectJobOrders.length) * 100);
    }
    
    const avgCompletion = milestones.reduce((sum, m) => sum + m.completion_percentage, 0) / milestones.length;
    return Math.round(avgCompletion);
  }, [milestones, projectJobOrders]);

  const handleExportPDF = () => {
    if (!project || !customer) return;

    generateProjectReportPDF({
      project: {
        name: project.name,
        status: project.status,
        start_date: project.start_date,
        end_date: project.end_date,
      },
      customer: {
        name: customer.name,
        company: customer.company,
        email: customer.email,
        phone: customer.phone,
      },
      estimates: projectEstimates.map((e) => ({
        number: e.number,
        status: e.status,
        total: e.total,
        created_at: e.created_at,
      })),
      jobOrders: projectJobOrders.map((j) => ({
        number: j.number,
        status: j.status,
        total: j.total,
        start_date: j.start_date,
      })),
      invoices: projectInvoices.map((i) => ({
        number: i.number,
        status: i.status,
        total: i.total,
        due_date: i.due_date,
      })),
      milestones: milestones?.map((m) => ({
        title: m.title,
        status: m.status,
        due_date: m.due_date,
        completion_percentage: m.completion_percentage,
      })) || [],
      totals,
      overallCompletion,
    });
  };

  const handleEditMilestone = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    setMilestoneFormData({
      title: milestone.title,
      description: milestone.description || "",
      due_date: milestone.due_date,
      status: milestone.status,
      completion_percentage: milestone.completion_percentage,
    });
    setIsMilestoneDialogOpen(true);
  };

  const handleDeleteMilestone = (milestoneId: string) => {
    deleteMilestone.mutate(milestoneId);
  };

  const handleMilestoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (editingMilestone) {
      await updateMilestone.mutateAsync({
        id: editingMilestone.id,
        ...milestoneFormData,
      });
    } else {
      await addMilestone.mutateAsync({
        project_id: id,
        ...milestoneFormData,
      });
    }

    setIsMilestoneDialogOpen(false);
    setEditingMilestone(null);
    setMilestoneFormData({
      title: "",
      description: "",
      due_date: "",
      status: "pending",
      completion_percentage: 0,
    });
  };

  const openNewMilestoneDialog = () => {
    setEditingMilestone(null);
    setMilestoneFormData({
      title: "",
      description: "",
      due_date: "",
      status: "pending",
      completion_percentage: 0,
    });
    setIsMilestoneDialogOpen(true);
  };

  if (!id) {
    return <Navigate to="/projects" replace />;
  }

  if (projectsLoading) {
    return (
      <PageLayout title="Loading..." description="">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  if (!project) {
    return <Navigate to="/projects" replace />;
  }

  const estimateColumns = [
    { key: "number", header: "Estimate #" },
    { key: "customer_name", header: "Customer" },
    {
      key: "status",
      header: "Status",
      render: (item: any) => <StatusBadge status={item.status} />,
    },
    {
      key: "total",
      header: "Total",
      render: (item: any) => <span className="font-medium">${item.total.toFixed(2)}</span>,
    },
    {
      key: "created_at",
      header: "Created",
      render: (item: any) => format(new Date(item.created_at), "MMM dd, yyyy"),
    },
  ];

  const jobOrderColumns = [
    { key: "number", header: "Job Order #" },
    {
      key: "status",
      header: "Status",
      render: (item: any) => <StatusBadge status={item.status} />,
    },
    {
      key: "total",
      header: "Total",
      render: (item: any) => <span className="font-medium">${item.total.toFixed(2)}</span>,
    },
    {
      key: "start_date",
      header: "Start Date",
      render: (item: any) => format(new Date(item.start_date), "MMM dd, yyyy"),
    },
  ];

  const invoiceColumns = [
    { key: "number", header: "Invoice #" },
    {
      key: "status",
      header: "Status",
      render: (item: any) => <StatusBadge status={item.status} />,
    },
    {
      key: "total",
      header: "Amount",
      render: (item: any) => <span className="font-medium">${item.total.toFixed(2)}</span>,
    },
    {
      key: "due_date",
      header: "Due Date",
      render: (item: any) => format(new Date(item.due_date), "MMM dd, yyyy"),
    },
  ];

  return (
    <PageLayout
      title={project.name}
      description="Project details and timeline"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      }
    >
      {/* Progress Overview */}
      <Card className="glass border-border mb-6">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Project Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overall Completion</span>
              <span className="font-bold text-primary">{overallCompletion}%</span>
            </div>
            <Progress value={overallCompletion} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {milestones && milestones.length > 0
                ? `Based on ${milestones.length} milestone${milestones.length > 1 ? "s" : ""}`
                : `Based on ${projectJobOrders.length} job order${projectJobOrders.length !== 1 ? "s" : ""}`}
            </p>
          </div>
      </CardContent>
      </Card>

      {/* Financial Summary */}
      <div className="mb-6">
        <ProjectFinancialSummary data={financialData} />
      </div>

      {/* Labor Allocation */}
      <div className="mb-6">
        <ProjectLaborAllocation projectId={id!} />
      </div>

      {/* Project Info */}
      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="font-heading text-sm text-muted-foreground">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={project.status} />
            {project.customer_po && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Customer PO:</span>
                <span className="font-medium">{project.customer_po}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass border-border">
          <CardHeader className="flex flex-row items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="font-heading text-sm text-muted-foreground">
              Customer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">{customer?.name || "Unknown"}</p>
            {customer?.company && (
              <p className="text-sm text-muted-foreground">{customer.company}</p>
            )}
          </CardContent>
        </Card>

        <Card className="glass border-border">
          <CardHeader className="flex flex-row items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="font-heading text-sm text-muted-foreground">
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="font-medium">Start:</span>{" "}
              {format(new Date(project.start_date), "MMM dd, yyyy")}
            </p>
            <p className="text-sm">
              <span className="font-medium">End:</span>{" "}
              {project.end_date
                ? format(new Date(project.end_date), "MMM dd, yyyy")
                : "Ongoing"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Project Address & POC */}
      {(project.address || project.poc_name || project.description) && (
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          {/* Project Address */}
          {project.address && (
            <Card className="glass border-border">
              <CardHeader className="flex flex-row items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="font-heading text-sm text-muted-foreground">
                  Project Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{project.address}</p>
                {(project.city || project.state || project.zip) && (
                  <p className="text-sm">
                    {[project.city, project.state, project.zip].filter(Boolean).join(", ")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Point of Contact */}
          {project.poc_name && (
            <Card className="glass border-border">
              <CardHeader className="flex flex-row items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="font-heading text-sm text-muted-foreground">
                  Point of Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium">{project.poc_name}</p>
                {project.poc_phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{project.poc_phone}</span>
                  </div>
                )}
                {project.poc_email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span>{project.poc_email}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Project Description */}
      {project.description && (
        <Card className="glass border-border mb-8">
          <CardHeader>
            <CardTitle className="font-heading text-sm text-muted-foreground">
              Project Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{project.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Rate Brackets */}
      <div className="mb-8">
        <ProjectRateBracketsSection projectId={id!} />
      </div>

      {/* Project Applicants */}
      <div className="mb-8">
        <ProjectApplicantsSection projectId={id!} />
      </div>

      {/* Assigned Personnel */}
      <div className="mb-8">
        <ProjectPersonnelSection projectId={id!} projectName={project.name} />
      </div>

      {/* Asset Assignments */}
      <div className="mb-8">
        <ProjectAssetAssignmentsSection projectId={id!} projectName={project.name} />
      </div>

      {/* Rooms / Units */}
      <div className="mb-8">
        <ProjectRoomsSection projectId={id!} />
      </div>

      {/* Milestones */}
      <div className="space-y-4 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-lg font-semibold">
              Milestones ({milestones?.length || 0})
            </h3>
          </div>
          <Button variant="outline" size="sm" onClick={openNewMilestoneDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Milestone
          </Button>
        </div>

        {!milestones || milestones.length === 0 ? (
          <Card className="glass border-border">
            <CardContent className="py-8 text-center text-muted-foreground">
              No milestones yet. Add milestones to track project progress.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {milestones.map((milestone) => (
              <Card key={milestone.id} className="glass border-border">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium">{milestone.title}</h4>
                        <StatusBadge status={milestone.status} />
                      </div>
                      {milestone.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {milestone.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Due: {format(new Date(milestone.due_date), "MMM dd, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditMilestone(milestone)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteMilestone(milestone.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{milestone.completion_percentage}%</span>
                    </div>
                    <Progress value={milestone.completion_percentage} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Estimates */}
      <div className="space-y-4 mb-8">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="font-heading text-lg font-semibold">
            Estimates ({projectEstimates.length})
          </h3>
        </div>
        {projectEstimates.length === 0 ? (
          <Card className="glass border-border">
            <CardContent className="py-8 text-center text-muted-foreground">
              No estimates for this project yet.
            </CardContent>
          </Card>
        ) : (
          <DataTable
            data={projectEstimates}
            columns={estimateColumns}
            onRowClick={(item) => navigate(`/estimates/${item.id}`)}
          />
        )}
      </div>

      {/* Job Orders */}
      <div className="space-y-4 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-lg font-semibold">
              Job Orders ({projectJobOrders.length})
            </h3>
          </div>
          <Button size="sm" onClick={() => setIsJobOrderDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Create JO
          </Button>
        </div>
        {projectJobOrders.length === 0 ? (
          <Card className="glass border-border">
            <CardContent className="py-8 text-center text-muted-foreground">
              No job orders for this project yet.
            </CardContent>
          </Card>
        ) : (
          <DataTable
            data={projectJobOrders}
            columns={jobOrderColumns}
            onRowClick={(item) => navigate(`/job-orders/${item.id}`)}
          />
        )}
      </div>

      {/* Invoices */}
      <div className="space-y-4 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-lg font-semibold">
              Invoices ({projectInvoices.length})
            </h3>
          </div>
          <Button size="sm" onClick={() => setIsCreateInvoiceDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Create Invoice
          </Button>
        </div>
        {projectInvoices.length === 0 ? (
          <Card className="glass border-border">
            <CardContent className="py-8 text-center text-muted-foreground">
              No invoices for this project yet.
            </CardContent>
          </Card>
        ) : (
          <DataTable
            data={projectInvoices}
            columns={invoiceColumns}
            onRowClick={(item) => navigate(`/invoices/${item.id}`)}
          />
        )}
      </div>

      {/* Vendor Bills */}
      <div className="mb-8">
        <ProjectVendorBillsList
          projectId={id!}
          onAddNew={() => navigate(`/vendor-bills/new?projectId=${id}`)}
        />
      </div>

      {/* Change Orders */}
      <div className="mb-8">
        <ProjectChangeOrdersList
          changeOrders={changeOrders || []}
          projectId={id!}
          onAddNew={() => navigate(`/change-orders/new?projectId=${id}`)}
        />
      </div>

      {/* T&M Tickets */}
      <div className="mb-8">
        <ProjectTMTicketsList
          tickets={tmTickets || []}
          projectId={id!}
          onAddNew={() => setIsTMTicketDialogOpen(true)}
        />
      </div>

      {/* Purchase Orders */}
      <div className="mb-8">
        <ProjectPurchaseOrdersList
          purchaseOrders={projectPurchaseOrders}
          projectId={id!}
          onAddNew={() => navigate(`/purchase-orders/new?projectId=${id}`)}
        />
      </div>

      {/* Time Tracking */}
      <div className="mb-8">
        <ProjectTimeEntriesList projectId={id!} />
      </div>


      {/* Project Documents */}
      <div className="mb-8">
        <ProjectDocuments projectId={id!} />
      </div>

      {/* Project Activity */}
      <div className="mb-8">
        <ProjectActivityTimeline projectId={id!} />
      </div>

      {/* Milestone Dialog */}
      <Dialog open={isMilestoneDialogOpen} onOpenChange={setIsMilestoneDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingMilestone ? "Edit Milestone" : "Add New Milestone"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMilestoneSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={milestoneFormData.title}
                onChange={(e) =>
                  setMilestoneFormData({ ...milestoneFormData, title: e.target.value })
                }
                required
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={milestoneFormData.description}
                onChange={(e) =>
                  setMilestoneFormData({ ...milestoneFormData, description: e.target.value })
                }
                className="bg-secondary border-border"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={milestoneFormData.due_date}
                  onChange={(e) =>
                    setMilestoneFormData({ ...milestoneFormData, due_date: e.target.value })
                  }
                  required
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={milestoneFormData.status}
                  onValueChange={(value: any) =>
                    setMilestoneFormData({ ...milestoneFormData, status: value })
                  }
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="delayed">Delayed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="completion_percentage">Completion Percentage (%)</Label>
              <Input
                id="completion_percentage"
                type="number"
                min="0"
                max="100"
                value={milestoneFormData.completion_percentage}
                onChange={(e) =>
                  setMilestoneFormData({
                    ...milestoneFormData,
                    completion_percentage: parseInt(e.target.value) || 0,
                  })
                }
                required
                className="bg-secondary border-border"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMilestoneDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="glow">
                {editingMilestone ? "Save Changes" : "Add Milestone"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* T&M Ticket Dialog */}
      <AddTMTicketDialog
        open={isTMTicketDialogOpen}
        onOpenChange={setIsTMTicketDialogOpen}
        projectId={id}
      />

      {/* Create Job Order Dialog */}
      {project && customer && (
        <CreateJobOrderDialog
          isOpen={isJobOrderDialogOpen}
          onClose={() => setIsJobOrderDialogOpen(false)}
          projectId={project.id}
          projectName={project.name}
          customerId={customer.id}
          customerName={customer.name}
        />
      )}

      {/* Create Project Invoice Dialog */}
      {project && customer && (
        <CreateProjectInvoiceDialog
          open={isCreateInvoiceDialogOpen}
          onOpenChange={setIsCreateInvoiceDialogOpen}
          projectId={project.id}
          projectName={project.name}
          customerId={customer.id}
          customerName={customer.name}
        />
      )}
    </PageLayout>
  );
};

export default ProjectDetail;
