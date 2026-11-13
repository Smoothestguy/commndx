import { useEffect, useMemo } from "react";
import { EventOverview } from '@/components/project-hub/EventOverview';
import '@/components/project-hub/eventOverview.css';
import { useProjectTypes } from '@/hooks/useProjectEvent';
import { useCustomers } from '@/integrations/supabase/hooks/useCustomers';
import { EventCustomers,ProjectTypeChip } from '@/components/projects/EventCustomers';
import { eventCustomers } from '@/lib/projectEvent';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { useProject, useArchiveProject, useUnarchiveProject } from "@/integrations/supabase/hooks/useProjects";
import { useUserRole } from "@/hooks/useUserRole";
import { ProjectCloseout } from "@/components/project-hub/ProjectCloseout";
import { useCustomer } from "@/integrations/supabase/hooks/useCustomers";
import { PageLayout } from "@/components/layout/PageLayout";
import { formatLocalDate } from "@/lib/dateUtils";
import { useSessionState } from "@/hooks/useSessionState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  MoreHorizontal,
  ChevronDown,
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
import { ProjectLocationsTab } from "@/components/project-hub/ProjectLocationsTab";
import { useProjectLocations } from "@/integrations/supabase/hooks/useProjectLocations";
import { ProjectRosterCard } from "@/components/personnel/lifecycle/ProjectRosterCard";
import { DeploymentSettings, CrewsSection } from "@/components/project-hub/ProjectDeploymentTab";
import { EVENT_TABS, eventTabDestination } from "@/lib/eventNavigation";
import { LocationAuthorizationAlerts } from "@/components/signin/DeploymentAlerts";
import { CustomerProjectAlerts } from "@/components/project-hub/CustomerProjectAlerts";
import { ProjectPersonnelRosterSection } from "@/components/project-hub/ProjectPersonnelRoster";
import { useCrews } from "@/integrations/supabase/hooks/useCrews";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUpdateProject } from "@/integrations/supabase/hooks/useProjects";
import { Switch } from "@/components/ui/switch";
import { ProjectJoinLinks } from '@/components/project-hub/ProjectJoinLinks';
import { CustomerProjectMessages } from '@/components/project-hub/CustomerProjectMessages';

const TABS = EVENT_TABS;
type TabValue = (typeof TABS)[number];

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  useEffect(() => {
    const refresh = () => {
      for (const key of ['project-join-requests', 'location-assignments', 'location-staffing-summary', 'project-roster', 'personnel-project-assignments', 'project-agencies', 'personnel-current-status']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      for(const key of ['customer-project-counts','project-customer-messages','location-task-orders','location-authorization'])void queryClient.invalidateQueries({queryKey:[key]});
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [id, queryClient]);

  const { data: project, isLoading: projectLoading } = useProject(id);
  const { data: customer } = useCustomer(project?.customer_id);
  const { isAdmin, isManager } = useUserRole();
  const canArchive = isAdmin || isManager;
  const { data: locations = [] } = useProjectLocations(id);
  const types=useProjectTypes(), customers=useCustomers();
  const derivedCustomers=eventCustomers(locations,project?.customer_id);
  const archiveProject = useArchiveProject();
  const unarchiveProject = useUnarchiveProject();
  const updateProject = useUpdateProject();

  const deploymentMode = !!project?.deployment_mode;
  const { data: crews = [] } = useCrews(id);
  const tabParam = searchParams.get("tab");
  const activeTab: TabValue = eventTabDestination(tabParam);
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', activeTab);
      const location = next.get('location');
      if (location && id) {
        next.delete('location'); next.set('tab', tabParam === 'crew' ? 'assets' : 'attendance');
        navigate(`/projects/${id}/locations/${location}?${next}`, { replace: true });
      } else setSearchParams(next, { replace: true });
    }
  }, [tabParam, activeTab, searchParams, setSearchParams, id, navigate]);

  const [detailsOpen, setDetailsOpen] = useSessionState(`project:${id}:details`, false);
  const locationView = searchParams.get('view') ?? (() => { try { return localStorage.getItem(`locations-view2:${id}`) || 'list'; } catch { return 'list'; } })();
  const listLayout = activeTab === 'locations' && locationView === 'list';

  const setActiveTab = (val: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", val);
    setSearchParams(next);
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

  const projectActions = (
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {canArchive && <Popover><PopoverTrigger asChild><Button variant="outline" size="icon" aria-label="Project menu"><MoreHorizontal className="h-4 w-4"/></Button></PopoverTrigger><PopoverContent align="end" className="w-64 space-y-2"><DeploymentSettings projectId={id} canEdit={canArchive}/><ProjectStatusMenu project={project} /></PopoverContent></Popover>}
          {canArchive && <ProjectJoinLinks projectId={project.id} menu />}
          {canArchive && <ProjectCloseout project={project as any} />}
          {canArchive && <Button variant="outline" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>}
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
  );

  return (
    <PageLayout
      title={project.name}
      description="Project details and timeline"
      desktopCompact={listLayout}
      desktopHeader={listLayout ? <div className="space-y-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/projects" aria-label="Back to projects" className="text-muted-foreground"><ArrowLeft className="h-4 w-4" /></Link>
          <h1 className="font-heading font-bold text-lg truncate">{project.name}</h1>
          <StatusBadge status={project.status} />
          <ProjectTypeChip type={types.data?.find(t=>t.id===project.type_id)}/><EventCustomers rows={derivedCustomers} customers={customers.data}/>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{formatLocalDate(project.start_date, 'MMM dd, yyyy')} – {project.end_date ? formatLocalDate(project.end_date, 'MMM dd, yyyy') : 'Ongoing'}</span>
          <Button variant="ghost" size="sm" className="ml-auto shrink-0 h-8" aria-expanded={detailsOpen} aria-controls="project-header-details" onClick={() => setDetailsOpen(v => !v)}>Details<ChevronDown className={`ml-1 h-4 w-4 ${detailsOpen ? 'rotate-180' : ''}`} /></Button>
        </div>
        {detailsOpen && <div id="project-header-details" className="border-y border-border py-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2"><Badge variant={stage.variant}>{stage.label}</Badge>{project.customer_po && <Badge variant="outline">PO {project.customer_po}</Badge>}{project.archived_at && <Badge variant="outline">Archived</Badge>}<span className="text-sm text-muted-foreground">{addressLine}</span>
            {canArchive && <label className="ml-auto flex items-center gap-2 text-xs"><Switch checked={deploymentMode} disabled={updateProject.isPending} onCheckedChange={v => updateProject.mutate({ id: project.id, deployment_mode: v })} />Deployment tracking</label>}
          </div>
          {projectActions}
        </div>}
      </div> : undefined}
      actions={projectActions}
    >
      <div data-viewport-list={listLayout || undefined} className={listLayout ? "desktop-list-page" : undefined}>
      <div className={listLayout ? "min-[1180px]:hidden" : undefined}>
      <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-4"><Link to="/projects" className="hover:underline">Projects</Link><span>/</span><Link to={`/projects/${project.id}`} className="text-foreground hover:underline">{project.name}</Link></nav>
      {/* Compact header */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={project.status} />
          <ProjectTypeChip type={types.data?.find(t=>t.id===project.type_id)}/>
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
          {canArchive && (
            <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground cursor-pointer" title="Deployment tracking — daily multi-site service & roster grids">
              <Switch
                checked={deploymentMode}
                disabled={updateProject.isPending}
                onCheckedChange={(v) => updateProject.mutate({ id: project.id, deployment_mode: v })}
              />
              Deployment tracking
            </label>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <EventCustomers rows={derivedCustomers} customers={customers.data}/>
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatLocalDate(project.start_date, "MMM dd, yyyy")}
            {" – "}
            {project.end_date ? formatLocalDate(project.end_date, "MMM dd, yyyy") : "Ongoing"}
          </span>
          {addressLine && (
            <span className="flex items-center gap-1 truncate max-w-full">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{addressLine}</span>
            </span>
          )}
        </div>
      </div>

      </div>


      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto -mx-1 px-1 mb-4 min-[1180px]:mb-2">
          <TabsList className="w-max">
            <TabsTrigger value="event">Event overview</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="recruiting">Recruiting</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
            <TabsTrigger value="docs">Docs &amp; Activity</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="event"><EventOverview project={project} locations={locations}/></TabsContent>
        <TabsContent value="locations">
          <div className="mb-2 space-y-2"><LocationAuthorizationAlerts projectId={id} locations={locations}/><CustomerProjectAlerts projectId={id} locations={locations}/></div>
          <ProjectLocationsTab projectId={id} projectName={project.name} deploymentMode={deploymentMode} />
        </TabsContent>
        <TabsContent value="recruiting" className="space-y-6">
          <ProjectRecruitingSection projectId={id} />
          <ProjectPersonnelRosterSection projectId={id}/>
          <CrewsSection projectId={id} crews={crews} canEdit={canArchive}/>
        </TabsContent>
        <TabsContent value="financials">
          {canArchive ? <ProjectFinancialsTab projectId={id} project={project} customer={customer} /> : <p className="text-muted-foreground">Financials are available to managers and administrators.</p>}
        </TabsContent>
        <TabsContent value="docs">
          <div className="space-y-8">
            {derivedCustomers.map(c=><CustomerProjectMessages key={c.id} projectId={id} customerId={c.id}/>)}
            <ProjectOverviewTab projectId={id} project={project} />
            <ProjectDocuments projectId={id} projectName={project.name} />
            <ProjectActivityTimeline projectId={id} />
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </PageLayout>
  );
};

export default ProjectDetail;
