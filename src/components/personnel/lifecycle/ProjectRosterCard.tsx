import { useProjectAgencies } from "@/hooks/useProjectAgencies";
import { AgencyChip } from "@/components/personnel/AgencyChip";
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
  const { agencyName } = useProjectAgencies(projectId);
  const { isAdmin, isManager } = useUserRole();
  const showCosts = isAdmin || isManager;
  const { data: project } = useProject(projectId);
  const standbyRate = (project as any)?.standby_rate != null ? Number((project as any).standby_rate) : null;
  const { rows, isLoading } = useProjectRoster(projectId, showCosts);
  const { data: expenses = [] } = useProjectPersonnelExpenses(projectId);
  const equipment = useProjectAssetBilling(projectId);
  const [sel, setSel] = useState<string[]>([]);
  const [activateOpen, setActivateOpen] = useState(false);
  const [expFor, setExpFor] = useState<string | null>(null);
  const [textFor, setTextFor] = useState<string | null>(null);

  const activated = rows.filter((r) => r.status === "activated");
  const standby = rows.filter((r) => r.status === "standby");
  const mobilizing = rows.filter((r) => r.status === "mobilizing");
  const [logFor, setLogFor] = useState<RosterRow | null>(null);

  const totals = useMemo(() => {
    const hours = activated.reduce((a, r) => a + r.hours, 0);
    const labor = activated.reduce((a, r) => a + (r.laborCost ?? 0), 0);
    const laborMissing = activated.filter((r) => r.hours > 0 && r.laborCost == null).length;
    const standbyDays = standby.reduce((a, r) => a + r.days, 0);
    const standbyAccrued = standbyRate != null ? standbyDays * standbyRate : 0;
    const exp = expenses.reduce((a, e) => a + e.amount, 0);
    return { hours, labor, laborMissing, standbyDays, standbyAccrued, exp, grand: labor + standbyAccrued + exp };
  }, [activated, standby, standbyRate, expenses]);

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const Row = ({ r }: { r: RosterRow }) => (
    <div className="flex items-center gap-1 sm:gap-2 py-2 border-b last:border-0">
      {showCosts && r.status === "standby" && <Checkbox checked={sel.includes(r.personnel_id)} onCheckedChange={() => toggle(r.personnel_id)} aria-label="Select" />}
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm truncate">{nm(r)} <AgencyChip name={agencyName(r.personnel_id)} /></div>
        <div className="text-xs text-muted-foreground">
          since {r.effective_at ? format(new Date(r.effective_at), "MMM d") : "—"} · {r.days}d
          {showCosts && r.status === "standby" && (standbyRate != null ? <> · accrued {money(r.days * standbyRate)}</> : <> · set standby rate</>)}
          {r.status === "activated" && <> · {r.hours.toFixed(1)}h{showCosts && <> · {r.laborCost != null ? money(r.laborCost) : "no rate"}</>}</>}
        </div>
      </div>
      <PersonnelStatusButton personnelId={r.personnel_id} projectId={projectId} projectName={(project as any)?.name} hideProjectName className="max-w-[7rem] sm:max-w-none" />
      <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Send site text" onClick={() => setTextFor(r.personnel_id)}><MessageSquare className="h-4 w-4" /></Button>
      {showCosts && <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Log time" onClick={() => setLogFor(r)}><Clock className="h-4 w-4" /></Button>}
      <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Add expense" onClick={() => setExpFor(r.personnel_id)}><Receipt className="h-4 w-4" /></Button>
    </div>
  );

  return (
    <Card>
      <SendSiteTextDialog open={!!textFor} onOpenChange={(o) => !o && setTextFor(null)} personnelIds={textFor ? [textFor] : []} projectId={projectId} />
      <CardHeader className="pb-2 space-y-2">
        <CardTitle className="text-base">Roster</CardTitle>
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
          <>
            <section>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-semibold text-warning">STANDBY ({standby.length})</h4>
                {showCosts && sel.length > 0 && <Button size="sm" onClick={() => setActivateOpen(true)}>Activate all ({sel.length})</Button>}
              </div>
              {standby.map((r) => <Row key={r.personnel_id} r={r} />)}
            </section>
            <section>
              <h4 className="text-xs font-semibold text-info mb-1">MOBILIZING ({mobilizing.length})</h4>
              {mobilizing.map((r) => <Row key={r.personnel_id} r={r} />)}
            </section>
            <section>
              <h4 className="text-xs font-semibold text-success mb-1">ACTIVATED ({activated.length})</h4>
              {activated.map((r) => <Row key={r.personnel_id} r={r} />)}
            </section>
          </>
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
