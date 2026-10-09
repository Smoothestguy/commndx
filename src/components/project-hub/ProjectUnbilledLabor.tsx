import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

/** Markup applied to an entry's pay rate when no assignment bill rate exists. */
export const DEFAULT_LABOR_MARKUP = 1.6;

export function ProjectUnbilledLabor({ projectId, totalInvoiced }: { projectId: string; totalInvoiced: number }) {
  const { data } = useQuery({
    queryKey: ["project-unbilled-labor", projectId],
    queryFn: async () => {
      const [te, pa] = await Promise.all([
        supabase.from("time_entries").select("hours, hourly_rate, personnel_id, is_overhead").eq("project_id", projectId),
        supabase.from("personnel_project_assignments").select("personnel_id, bill_rate, assigned_at").eq("project_id", projectId),
      ]);
      if (te.error) throw te.error;
      if (pa.error) throw pa.error;
      const billRates: Record<string, number> = {};
      for (const a of (pa.data || []) as any[]) {
        if (a.personnel_id && a.bill_rate && a.bill_rate > 0 && billRates[a.personnel_id] == null) billRates[a.personnel_id] = Number(a.bill_rate);
      }
      let hours = 0, value = 0, estHours = 0;
      for (const e of (te.data || []) as any[]) {
        if (e.is_overhead) continue;
        const h = Number(e.hours) || 0;
        hours += h;
        const br = e.personnel_id ? billRates[e.personnel_id] : undefined;
        if (br) value += h * br;
        else { value += h * (Number(e.hourly_rate) || 0) * DEFAULT_LABOR_MARKUP; estHours += h; }
      }
      return { hours, value, estHours };
    },
  });

  if (!data || data.hours === 0) return null;
  const gap = data.value - totalInvoiced;
  const hasGap = gap > 0.5;
  const isEst = data.estHours > 0;

  return (
    <Card className={`glass ${hasGap ? "border-amber-500/50" : "border-border"}`}>
      <CardContent className="py-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <Clock className="h-4 w-4 text-primary" /> Unbilled labor
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Non-overhead hours × the worker's project bill rate. Where no bill rate is set, the entry's pay rate × {DEFAULT_LABOR_MARKUP} is used (est.). Compared against all invoices on this project.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className="text-muted-foreground">{data.hours.toFixed(1)} hrs</span>
        <span>Labor billed value to date: <b>{formatCurrency(data.value)}</b>{isEst && <span className="text-xs text-muted-foreground"> (est. on {data.estHours.toFixed(1)} hrs)</span>}</span>
        <span>Invoiced: <b>{formatCurrency(totalInvoiced)}</b></span>
        <span className={hasGap ? "text-amber-500 font-bold" : "text-muted-foreground"}>Gap: {formatCurrency(Math.max(gap, 0))}</span>
      </CardContent>
    </Card>
  );
}
