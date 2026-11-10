import { EnhancedDataTable, type EnhancedColumn } from '@/components/shared/EnhancedDataTable';
import { PersonnelBulkActions } from '@/components/personnel/PersonnelBulkActions';
import { useSessionState } from '@/hooks/useSessionState';
import { Link } from 'react-router-dom';
import { EntityContextMenu } from '@/components/shared/EntityContextMenu';
import { NonBillableChip } from '@/components/personnel/NonBillableChip';
import { useProjectAgencies } from "@/hooks/useProjectAgencies";
import { AgencyChip } from "@/components/personnel/AgencyChip";
import { PersonnelBadgeActions } from '@/components/personnel/PersonnelBadgeActions';
import { printBadges } from '@/lib/personnelBadges';
import { toast } from 'sonner';
import { useProjectAssetBilling } from "@/integrations/supabase/hooks/useAssetAssignments";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, Loader2, MessageSquare, Receipt } from "lucide-react";
import { LogTimeDialog } from "./LogTimeDialog";
import { SendSiteTextDialog } from "@/components/project-hub/SendSiteTextDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { useProject } from "@/integrations/supabase/hooks/useProjects";
import { useProjectPersonnelExpenses, useProjectRoster, RosterRow } from "@/integrations/supabase/hooks/usePersonnelStatus";
import { PersonnelStatusButton, StatusProjectDialog } from "./PersonnelStatusButton";
import { AddExpenseDialog } from "./AddExpenseDialog";

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nm = (r: RosterRow) => [r.first_name, r.last_name].filter(Boolean).join(" ") || "Unknown";

export function ProjectRosterCard({ projectId }: { projectId: string }) {
  const { agencyName, employerName, nonBillableByPerson } = useProjectAgencies(projectId);
  const { isAdmin, isManager } = useUserRole();
  const showCosts = isAdmin || isManager;
  const { data: project } = useProject(projectId);
  const standbyRate = (project as any)?.standby_rate != null ? Number((project as any).standby_rate) : null;
  const { rows, isLoading } = useProjectRoster(projectId, showCosts);
  const { data: expenses = [] } = useProjectPersonnelExpenses(projectId);
  const equipment = useProjectAssetBilling(projectId);
  const [sel, setSel] = useState<string[]>([]);
  const [badgeSelection, setBadgeSelection] = useSessionState<string[]>(`project-roster:${projectId}:selection`, []);
  const [printing, setPrinting] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [expFor, setExpFor] = useState<string | null>(null);
  const [textFor, setTextFor] = useState<string | null>(null);

  const activated = rows.filter((r) => r.status === "activated");
  const standby = rows.filter((r) => r.status === "standby");
  const mobilizing = rows.filter((r) => r.status === "mobilizing");
  const [logFor, setLogFor] = useState<RosterRow | null>(null);

  const totals = useMemo(() => {
    const hours = activated.reduce((a, r) => a + r.hours, 0);
    const labor = activated.reduce((a, r) => a + (nonBillableByPerson[r.personnel_id] === false ? r.laborCost ?? 0 : 0), 0);
    const laborMissing = activated.filter((r) => nonBillableByPerson[r.personnel_id] === false && r.hours > 0 && r.laborCost == null).length;
    const standbyDays = standby.reduce((a, r) => a + r.days, 0);
    const standbyAccrued = standbyRate != null ? standby.filter(r => nonBillableByPerson[r.personnel_id] === false).reduce((a, r) => a + r.days, 0) * standbyRate : 0;
    const exp = expenses.reduce((a, e) => a + e.amount, 0);
    return { hours, labor, laborMissing, standbyDays, standbyAccrued, exp, grand: labor + standbyAccrued + exp };
  }, [activated, standby, standbyRate, expenses, nonBillableByPerson]);

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  type GridRow = RosterRow & { id: string };
  const columns: EnhancedColumn<GridRow>[] = [
    { key: 'name', header: 'Name', width: 240, getValue: nm, render: r => <Link to={`/personnel/${r.personnel_id}`} className="hover:underline hover:text-primary">{nm(r)}</Link> },
    { key: 'employer', header: 'Agency / employer', getValue: r => employerName(r.personnel_id) || agencyName(r.personnel_id) || 'FRG', render: r => <><AgencyChip name={agencyName(r.personnel_id)} /><NonBillableChip value={nonBillableByPerson[r.personnel_id]} employer={employerName(r.personnel_id)} /></> },
    { key: 'status', header: 'Status', render: r => <PersonnelStatusButton personnelId={r.personnel_id} projectId={projectId} projectName={project?.name} hideProjectName /> },
    { key: 'effective_at', header: 'Since' }, { key: 'days', header: 'Days' }, { key: 'hours', header: 'Hours' },
    ...(showCosts ? [{ key: 'laborCost', header: 'Labor cost', getValue: (r: GridRow) => nonBillableByPerson[r.personnel_id] === false ? r.laborCost : null }] : []),
    { key: 'actions', header: 'Actions', sortable: false, filterable: false, noExport: true, render: r => <span className="flex items-center gap-1"><PersonnelBadgeActions personnelId={r.personnel_id} compact /><Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Send site text to ${nm(r)}`} onClick={() => setTextFor(r.personnel_id)}><MessageSquare className="h-3.5 w-3.5" /></Button>{showCosts && <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Log time for ${nm(r)}`} onClick={() => setLogFor(r)}><Clock className="h-3.5 w-3.5" /></Button>}<Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Add expense for ${nm(r)}`} onClick={() => setExpFor(r.personnel_id)}><Receipt className="h-3.5 w-3.5" /></Button></span> },
  ];

  return (
    <Card>
      <SendSiteTextDialog open={!!textFor} onOpenChange={(o) => !o && setTextFor(null)} personnelIds={textFor ? [textFor] : []} projectId={projectId} />
      <CardHeader className="pb-2 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">Roster</CardTitle>{showCosts&&<Button size="sm" variant="outline" disabled={printing||!rows.length} onClick={async()=>{setPrinting(true);try{await printBadges(badgeSelection.length?badgeSelection:rows.map(r=>r.personnel_id));}catch(e){toast.error(e instanceof Error?e.message:'Badge printing failed');}finally{setPrinting(false);}}}>{printing?'Preparing…':`Print badges (PDF)${badgeSelection.length?` (${badgeSelection.length})`:''}`}</Button>}</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          <Stat label="Activated hours" value={`${totals.hours.toFixed(1)}h`} />
          {showCosts && <Stat label="Labor cost" value={money(totals.labor)} hint={totals.laborMissing ? `${totals.laborMissing} missing rate` : undefined} />}
          {showCosts ? <Stat label="Standby accrued" value={standbyRate != null ? money(totals.standbyAccrued) : "—"} hint={standbyRate == null ? "set standby rate" : `${totals.standbyDays} person-days`} /> : <Stat label="Standby" value={`${totals.standbyDays} person-days`} />}
          {showCosts && <Stat label="Expenses" value={money(totals.exp)} />}
          {showCosts && <Stat label="Equipment" value={money(equipment.equipmentTotal)} hint={equipment.missingRate ? `${equipment.missingRate} no rate` : `${equipment.billable.length} billable · not in cost total`} />}
          {showCosts && <Stat label="Grand total" value={money(totals.grand)} strong />}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one is currently on standby, mobilizing, or activated for this project.</p>
        ) : (
          <EnhancedDataTable tableId={`project-roster:${projectId}`} data={rows.map(r => ({ ...r, id: r.personnel_id }))} columns={columns}
            selectable={showCosts} selectedIds={new Set(badgeSelection)} onSelectionChange={ids => setBadgeSelection([...ids])} exportName="project-roster"
            bulkActions={(selected, clear) => <><PersonnelBulkActions people={selected.map(r => ({ id: r.personnel_id, first_name: r.first_name, last_name: r.last_name }))} worksFor={p => employerName(p.id) || agencyName(p.id) || 'FRG'} onDone={clear} />{selected.some(r => r.status === 'standby') && <Button size="sm" onClick={() => { setSel(selected.filter(r => r.status === 'standby').map(r => r.personnel_id)); setActivateOpen(true); }}>Activate standby</Button>}</>}
          />
        )}
      </CardContent>
      <StatusProjectDialog open={activateOpen} onOpenChange={(o) => { setActivateOpen(o); if (!o) setSel([]); }}
        personnelIds={sel} status="activated" defaultProjectId={projectId} lockProject fixedProjectName={(project as any)?.name} />
      <LogTimeDialog open={!!logFor} onOpenChange={(o) => !o && setLogFor(null)} projectId={projectId}
        personnelId={logFor?.personnel_id} personName={logFor ? nm(logFor) : undefined} />
      <AddExpenseDialog open={!!expFor} onOpenChange={(o) => !o && setExpFor(null)} personnelId={expFor ?? undefined} projectId={projectId} lockProject />
    </Card>
  );
}

function Stat({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
      <div className="text-muted-foreground">{label}</div>
      <div className={strong ? "font-bold text-sm" : "font-semibold text-sm"}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
