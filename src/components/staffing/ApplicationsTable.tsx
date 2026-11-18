import { ApplicantTagBadges, ApplicantNoteLine } from "@/components/staffing/ApplicantMetaInline";
import { useApplicantCertSummary } from "@/hooks/useApplicantCertSummary";
import { useMemo, useState } from "react";
import { useApplicantDuplicates } from '@/hooks/useApplicantDuplicates';
import { useUserRole } from '@/hooks/useUserRole';
import { ApplicantMergeDialog, type MergeCandidate } from './ApplicantMergeDialog';
import { SubmittedTime, RecruitingStateFilter } from './RecruitingControls';
import { recruitingState, submissionTime, canMergeApplicants } from '@/lib/recruiting';
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SecureAvatar } from "@/components/ui/secure-avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, CheckCircle, XCircle, User, Trash2, Undo2, Circle, CheckCircle2 } from "lucide-react";
import { StatusPill, EnhancedDataTable, EnhancedColumn } from "@/components/shared/EnhancedDataTable";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileApplicationCard } from "./MobileApplicationCard";
import { ApplicantStarButton } from "./ApplicantStarButton";
import { sortStarredFirst } from "@/lib/applicantStar";
import type { Application } from "@/integrations/supabase/hooks/useStaffingApplications";
import { useApplicationFormTemplates, FormField } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { cn } from "@/lib/utils";
import { formatApplicantLocation } from "@/lib/applicantLocation";
import { useApplicantLocations } from "@/hooks/useZipLookup";

const statusColors: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  reviewing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

// Helper to extract profile picture from application answers using field type info
function getProfilePicture(
  answers: Record<string, unknown> | null | undefined,
  fieldTypeMap: Record<string, { label: string; type: string }>
): string | null {
  if (!answers) return null;
  
  // First pass: look for file type fields with images (excludes signatures)
  for (const [fieldId, value] of Object.entries(answers)) {
    const fieldInfo = fieldTypeMap[fieldId];
    if (
      fieldInfo?.type === "file" &&
      typeof value === "string" &&
      (value.startsWith("data:image") || value.startsWith("http"))
    ) {
      return value;
    }
  }

  // Fallback: if no field metadata, look for first image that's not from a signature field
  for (const [fieldId, value] of Object.entries(answers)) {
    const fieldInfo = fieldTypeMap[fieldId];
    // Skip if we know it's a signature
    if (fieldInfo?.type === "signature") continue;

    if (
      typeof value === "string" &&
      (value.startsWith("data:image") || value.startsWith("http"))
    ) {
      return value;
    }
  }
  
  return null;
}

interface ApplicationsTableProps {
  applications: Application[];
  isLoading: boolean;
  onViewApplication: (app: Application) => void;
  onApprove: (app: Application) => void;
  onReject: (app: Application) => void;
  onRevokeApproval?: (app: Application) => void;
  onReverseApproval?: (app: Application) => void;
  onToggleContacted?: (app: Application) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  bulkActions?: (rows: Application[], clear: () => void) => React.ReactNode;
  extraColumns?: EnhancedColumn<Application>[];
}

export function ApplicationsTable({
  applications: rawApplications,
  isLoading,
  onViewApplication,
  onApprove,
  onReject,
  onRevokeApproval,
  onReverseApproval,
  onToggleContacted,
  selectable = false,
  selectedIds,
  onSelectionChange,
  bulkActions,
  extraColumns = [],
}: ApplicationsTableProps) {
  const [stateFilter, setStateFilter] = useState('all');
  const [mergePair, setMergePair] = useState<MergeCandidate[] | null>(null);
  const { groupsFor } = useApplicantDuplicates();
  const { isAdmin, isManager } = useUserRole();
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());
  const selection = selectedIds ?? localSelected;
  const setSelection = onSelectionChange ?? setLocalSelected;
  const applications = useMemo(() => rawApplications.filter(a => a.applicants?.status !== 'archived' && (stateFilter === 'all' || (recruitingState(a.applicants?.state,a.answers)||'unknown') === stateFilter)).slice().sort((a,b)=>submissionTime(b).localeCompare(submissionTime(a))), [rawApplications,stateFilter]);
  const isMobile = useIsMobile();
  const certSummary = useApplicantCertSummary(applications.map((a) => a.applicant_id));
  const resolveLocation = useApplicantLocations(applications.map((app) => app.applicants));
  const { data: formTemplates } = useApplicationFormTemplates();

  // Build a map of form template id -> field type map for quick lookup
  const templateFieldMaps = useMemo(() => {
    const maps: Record<string, Record<string, { label: string; type: string }>> = {};
    if (formTemplates) {
      formTemplates.forEach((template) => {
        const fieldMap: Record<string, { label: string; type: string }> = {};
        template.fields?.forEach((field: FormField) => {
          fieldMap[field.id] = { label: field.label, type: field.type };
        });
        maps[template.id] = fieldMap;
      });
    }
    return maps;
  }, [formTemplates]);

  // Helper to get field type map for an application
  const getFieldTypeMap = (app: Application): Record<string, { label: string; type: string }> => {
    const templateId = app.job_postings?.form_template_id;
    return templateId ? templateFieldMaps[templateId] || {} : {};
  };

  const columns: EnhancedColumn<Application>[] = [
    {
      key: "action",
      header: "",
      sortable: false,
      filterable: false,
      render: (app: Application) => (
        <div className="flex items-center gap-1">
          <ApplicantStarButton
            applicantId={app.applicant_id}
            starredAt={(app.applicants as any)?.starred_at}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={(e) => {
              e.stopPropagation();
              onViewApplication(app);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
    {
      key: "applicant",
      frozen: true,
      header: "Applicant",
      sortable: true,
      filterable: true,
      getValue: (app) => `${app.applicants?.first_name || ""} ${app.applicants?.last_name || ""}`,
      render: (app: Application) => {
          const fieldTypeMap = getFieldTypeMap(app);
          const profilePic = app.applicants?.photo_url || getProfilePicture(app.answers as Record<string, unknown>, fieldTypeMap);
        return (
          <div className="flex items-center gap-3">
            <SecureAvatar
              bucket="application-files"
              photoUrl={profilePic}
              className="h-9 w-9"
              fallback={<User className="h-4 w-4" />}
              alt="Profile"
            />
            <span className="min-w-0 truncate font-medium" title={`${app.applicants?.first_name ?? ""} ${app.applicants?.last_name ?? ""}`}>{app.applicants?.first_name} {app.applicants?.last_name}</span>
          </div>
        );
      },
    },
    {key:"flags",header:"Flags",width:240,sortable:false,getValue:app => [...(app.applicants?.role_tags ?? []), ...(certSummary[app.applicant_id]?.types ?? [])].join(", "),render:app => <ApplicantTagBadges applicant={app.applicants} certs={certSummary[app.applicant_id]} className="flex-nowrap"/>},
    {key:"notes",header:"Notes",width:220,getValue:app => app.applicants?.staff_notes ?? "",render:app => <span className="block truncate text-muted-foreground" title={app.applicants?.staff_notes ?? undefined}>{app.applicants?.staff_notes || "—"}</span>},
    {key:'state',header:'State',width:100,sortable:true,filterable:true,getValue:app=>recruitingState(app.applicants?.state,app.answers)},
    {key:'duplicate',header:'Duplicate',width:180,getValue:app=>groupsFor(app.applicant_id).length?'Possible duplicate':'',render:app=>groupsFor(app.applicant_id).length?<Badge variant="outline">Possible duplicate</Badge>:null},
    {
      key: "location",
      header: "Location",
      sortable: true,
      filterable: true,
      getValue: (app) => formatApplicantLocation(app.applicants ? resolveLocation(app.applicants) : null),
      render: (app: Application) => (
        <span className="text-muted-foreground">
          {formatApplicantLocation(app.applicants ? resolveLocation(app.applicants) : null)}
        </span>
      ),
    },
    {
      key: "position",
      header: "Position",
      sortable: true,
      filterable: true,
      getValue: (app) => app.job_postings?.project_task_orders?.title || "",
      render: app => <span className="font-medium">{app.job_postings?.project_task_orders?.title}</span>,
    },
    {key:"project",header:"Project",getValue:app => app.job_postings?.project_task_orders?.projects?.name ?? ""},
    ...extraColumns,
    {
      key: "submitted",
      header: "Submitted",
      sortable: true,
      filterable: false,
      getValue: (app) => app.submitted_at || app.created_at,
      width: 310,
      render: (app: Application) => <SubmittedTime value={submissionTime(app)}/>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      getValue: (app) => app.status,
      render: (app: Application) => (
        <StatusPill value={app.status} />
      ),
    },
    {
      key: "contacted",
      header: "Contacted",
      sortable: true,
      filterable: true,
      getValue: (app) => app.contacted_at ? "Yes" : "No",
      render: (app: Application) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  app.contacted_at
                    ? "text-green-600 hover:text-green-700"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleContacted?.(app);
                }}
              >
                {app.contacted_at ? (
                  <CheckCircle2 className="h-4 w-4 fill-current" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {app.contacted_at
                ? `Contacted on ${format(new Date(app.contacted_at), "MMM d, yyyy")}`
                : "Mark as contacted"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
    },
    {
      key: "actions",
      header: "",
      sortable: false,
      filterable: false,
      render: (app: Application) => (
        <div className="flex items-center justify-end gap-1">
          {app.status === "submitted" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove(app);
                }}
                title="Approve"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onReject(app);
                }}
                title="Reject"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </>
          )}
          {app.status === "approved" && onReverseApproval && (
            <Button
              variant="ghost"
              size="icon"
              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              onClick={(e) => {
                e.stopPropagation();
                onReverseApproval(app);
              }}
              title="Reverse Approval"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          )}
          {onRevokeApproval && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                onRevokeApproval(app);
              }}
              title="Delete Applicant"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading applications...
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm">Latest</Button><RecruitingStateFilter value={stateFilter} onChange={setStateFilter}/></div>
        {selection.size>0 && <div role="region" aria-label="Applicant bulk actions" className="flex flex-wrap items-center gap-2"><span>{selection.size} selected</span>{bulkActions?.(applications.filter(a=>selection.has(a.id)),()=>setSelection(new Set()))}{(()=>{const candidates=[...new Map(applications.filter(a=>selection.has(a.id)&&a.applicants).map(a=>[a.applicant_id,a.applicants as MergeCandidate])).values()];return canMergeApplicants(isAdmin||isManager,candidates.map(r=>r.id))?<Button variant="outline" onClick={()=>setMergePair(candidates)}>Merge applicants</Button>:null;})()}<Button variant="ghost" onClick={()=>setSelection(new Set())}>Clear selection</Button></div>}
        {applications.map((app) => {
          const fieldTypeMap = getFieldTypeMap(app);
          return (
            <MobileApplicationCard
              key={app.id}
              application={app}
              location={formatApplicantLocation(app.applicants ? resolveLocation(app.applicants) : null)}
              onView={onViewApplication}
              onApprove={onApprove}
              onReject={onReject}
              onRevokeApproval={onRevokeApproval}
              onToggleContacted={onToggleContacted}
              fieldTypeMap={fieldTypeMap}
              certs={certSummary[app.applicant_id]}
              possibleDuplicate={groupsFor(app.applicant_id).length > 0}
              extraFields={extraColumns.length>0?<details><summary>Application answers</summary><dl className="space-y-2">{extraColumns.map(c=><div key={String(c.key)}><dt>{c.header}</dt><dd>{c.render?.(app)}</dd></div>)}</dl></details>:undefined}
              selected={selection.has(app.id)} onSelect={selectable && (isAdmin||isManager) ? ()=>{const next=new Set(selection);if(next.has(app.id))next.delete(app.id);else next.add(app.id);setSelection(next);} : undefined}
            />
          );
        })}
        <ApplicantMergeDialog candidates={mergePair} onClose={()=>setMergePair(null)} onMerged={()=>setSelection(new Set())}/>
      </div>
    );
  }

  return (
    <><EnhancedDataTable
      tableId="applications"
      data={applications}
      columns={columns}
      onRowClick={onViewApplication}
      defaultSortKey="submitted" defaultSortDirection="desc" latestSortKey="submitted"
      toolbar={<RecruitingStateFilter value={stateFilter} onChange={setStateFilter}/>}
      selectable={selectable}
      selectedIds={selection}
      onSelectionChange={setSelection}
      exportName="applicant-pool"
      bulkActions={(rows,clear)=>{const candidates=[...new Map(rows.filter(r=>r.applicants).map(r=>[r.applicant_id,r.applicants as MergeCandidate])).values()];return <>{bulkActions?.(rows,clear)}{canMergeApplicants(isAdmin||isManager,candidates.map(r=>r.id))&&<Button size="sm" variant="outline" onClick={()=>setMergePair(candidates)}>Merge applicants</Button>}</>;}}
      attention={app => !app.applicants?.phone ? "Missing phone" : null}
    /><ApplicantMergeDialog candidates={mergePair} onClose={()=>setMergePair(null)} onMerged={()=>setSelection(new Set())}/></>
  );
}
