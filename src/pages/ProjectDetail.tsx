import { useMemo } from "react";
import { useParams, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { useProject, useArchiveProject, useUnarchiveProject } from "@/integrations/supabase/hooks/useProjects";
import { useUserRole } from "@/hooks/useUserRole";
import { useCustomer } from "@/integrations/supabase/hooks/useCustomers";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Loader2,
  Download,
  MapPin,
  Calendar,
  User,
  Hash,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { stageConfig } from "@/components/projects/ProjectCard";
import { getCustomerDisplayName } from "@/utils/customerDisplayName";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateProjectReportPDF } from "@/utils/pdfExport";
import { ProjectHeaderKpis } from "@/components/project-hub/ProjectHeaderKpis";
import { ProjectOverviewTab } from "@/components/project-hub/ProjectOverviewTab";
import { ProjectRecruitingSection } from "@/components/project-hub/ProjectRecruitingSection";
import { ProjectCrewTab } from "@/components/project-hub/ProjectCrewTab";
import { ProjectFinancialsTab } from "@/components/project-hub/ProjectFinancialsTab";
import { ProjectTimeEntriesList } from "@/components/project-hub/ProjectTimeEntriesList";
import { ProjectDocuments } from "@/components/projects/ProjectDocuments";
import { ProjectActivityTimeline } from "@/components/project-hub/ProjectActivityTimeline";
import { ProjectStatusMenu } from "@/components/projects/ProjectStatusMenu";

const TABS = ["overview", "recruiting", "crew", "financials", "time", "docs"] as const;
type TabValue = (typeof TABS)[number];

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: project, isLoading: projectLoading } = useProject(id);
  const { data: customer } = useCustomer(project?.customer_id);
  const { isAdmin, isManager } = useUserRole();
  const canArchive = isAdmin || isManager;
  const archiveProject = useArchiveProject();
  const unarchiveProject = useUnarchiveProject();

  const tabParam = searchParams.get("tab");
  const activeTab: TabValue = (TABS as readonly string[]).includes(tabParam || "")
    ? (tabParam as TabValue)
    : "overview";

  const setActiveTab = (val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val === "overview") next.delete("tab");
    else next.set("tab", val);
    setSearchParams(next, { replace: true });
  };

  const addressLine = useMemo(() => {
    if (!project) return "";
    const parts = [project.address, [project.city, project.state, project.zip].filter(Boolean).join(", ")].filter(Boolean);
    return parts.join(" · ");
  }, [project]);

  const handleExportPDF = async () => {
    if (!project || !customer || !id) return;
    try {
      toast.loading("Preparing project report...", { id: "pdf-export" });
      const [estRes, joRes, coRes, invRes, msRes] = await Promise.all([
        supabase.from("estimates").select("number,status,total,created_at").eq("project_id", id).is("deleted_at", null),
        supabase.from("job_orders").select("id,number,status,total,start_date").eq("project_id", id),
        supabase.from("change_orders").select("id").eq("project_id", id),
        supabase.from("milestones").select("title,status,due_date,completion_percentage").eq("project_id", id),
        supabase.from("milestones").select("completion_percentage").eq("project_id", id),
      ]);
      const jobOrders = (joRes.data || []) as any[];
      const joIds = jobOrders.map((j) => j.id);
      const coIds = ((coRes.data || []) as any[]).map((c) => c.id);
      const orClauses = [`project_id.eq.${id}`];
      if (joIds.length) orClauses.push(`job_order_id.in.(${joIds.join(",")})`);
      if (coIds.length) orClauses.push(`change_order_id.in.(${coIds.join(",")})`);
      const invoicesRes: any = await supabase
        .from("invoices")
        .select("number,status,total,due_date")
        .or(orClauses.join(","))
        .is("deleted_at", null);
      const invoices = (invoicesRes.data || []) as any[];
      const estimates = ((estRes.data || []) as any[]);
      const milestones = ((invRes.data || []) as any[]);
      const msList = ((msRes.data || []) as any[]);

      const estimatesTotal = estimates.reduce((s, e) => s + (e.total || 0), 0);
      const jobOrdersTotal = jobOrders.reduce((s, j) => s + (j.total || 0), 0);
      const invoicesTotal = invoices.reduce((s, i) => s + (i.total || 0), 0);
      const paidTotal = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + (i.total || 0), 0);
      const overallCompletion = msList.length > 0
        ? Math.round(msList.reduce((s, m) => s + (m.completion_percentage || 0), 0) / msList.length)
        : (jobOrders.length ? Math.round(jobOrders.filter((j) => j.status === "completed").length / jobOrders.length * 100) : 0);

      generateProjectReportPDF({
        project: { name: project.name, status: project.status, start_date: project.start_date, end_date: project.end_date },
        customer: { name: customer.name, company: customer.company, email: customer.email, phone: customer.phone },
        estimates,
        jobOrders,
        invoices,
        milestones,
        totals: { estimatesTotal, jobOrdersTotal, invoicesTotal, paidTotal },
        overallCompletion,
      });
      toast.success("Report generated", { id: "pdf-export" });
    } catch (err: any) {
      toast.error(`Export failed: ${err.message || err}`, { id: "pdf-export" });
    }
  };

  if (!id) return <Navigate to="/projects" replace />;
  if (projectLoading) {
    return (
      <PageLayout title="Loading..." description="">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }
  if (!project) return <Navigate to="/projects" replace />;

  const stage = stageConfig[project.stage] || stageConfig.quote;

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
          {canArchive && (project.archived_at ? (
            <Button variant="outline" onClick={() => unarchiveProject.mutate({ id: project.id, name: project.name })} disabled={unarchiveProject.isPending}>
              <ArchiveRestore className="h-4 w-4 mr-2" />
              Unarchive
            </Button>
          ) : (
            <Button variant="outline" onClick={() => archiveProject.mutate({ id: project.id, name: project.name })} disabled={archiveProject.isPending}>
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </Button>
          ))}
          <Button variant="outline" onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      }
    >
      {/* Compact header */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={project.status} />
          <Badge variant={stage.variant} className={`text-xs ${stage.className}`}>
            {stage.label}
          </Badge>
          {project.archived_at && (
            <Badge variant="outline" className="text-xs gap-1 border-muted-foreground/50 text-muted-foreground">
              <Archive className="h-3 w-3" /> Archived
            </Badge>
          )}
          {project.customer_po && (
            <Badge variant="outline" className="text-xs gap-1">
              <Hash className="h-3 w-3" /> PO {project.customer_po}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {customer && (
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              <button
                className="text-primary hover:underline"
                onClick={() => navigate(`/customers/${customer.id}`)}
              >
                {getCustomerDisplayName(customer)}
              </button>
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {format(new Date(project.start_date), "MMM dd, yyyy")}
            {" – "}
            {project.end_date ? format(new Date(project.end_date), "MMM dd, yyyy") : "Ongoing"}
          </span>
          {addressLine && (
            <span className="flex items-center gap-1 truncate max-w-full">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{addressLine}</span>
            </span>
          )}
        </div>
      </div>

      <ProjectHeaderKpis projectId={id} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto -mx-1 px-1 mb-4">
          <TabsList className="w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="recruiting">Recruiting</TabsTrigger>
            <TabsTrigger value="crew">Crew &amp; Logistics</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
            <TabsTrigger value="time">Time</TabsTrigger>
            <TabsTrigger value="docs">Docs &amp; Activity</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <ProjectOverviewTab projectId={id} project={project} />
        </TabsContent>
        <TabsContent value="recruiting">
          <ProjectRecruitingSection projectId={id} />
        </TabsContent>
        <TabsContent value="crew">
          <ProjectCrewTab projectId={id} projectName={project.name} />
        </TabsContent>
        <TabsContent value="financials">
          <ProjectFinancialsTab projectId={id} project={project} customer={customer} />
        </TabsContent>
        <TabsContent value="time">
          <ProjectTimeEntriesList projectId={id} />
        </TabsContent>
        <TabsContent value="docs">
          <div className="space-y-8">
            <ProjectDocuments projectId={id} />
            <ProjectActivityTimeline projectId={id} />
          </div>
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
};

export default ProjectDetail;
