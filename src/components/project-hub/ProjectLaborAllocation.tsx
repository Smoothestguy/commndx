import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, DollarSign, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { calculateSingleEmployeeOvertime } from "@/lib/overtimeUtils";

interface ProjectLaborAllocationProps {
  projectId: string;
}

interface PersonnelAllocation {
  personnel_id: string;
  personnel_name: string;
  title: string | null;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  hourly_rate: number;
  estimated_cost: number;
  is_supervision: boolean;
}

export function ProjectLaborAllocation({ projectId }: ProjectLaborAllocationProps) {
  const { data: allocations = [], isLoading } = useQuery({
    queryKey: ["project-labor-allocation", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          personnel_id,
          hours,
          hourly_rate,
          is_holiday,
          is_overhead,
          personnel:personnel_id (
            id,
            first_name,
            last_name,
            hourly_rate,
            title
          )
        `)
        .eq("project_id", projectId)
        .not("personnel_id", "is", null);

      if (error) throw error;

      // Group by personnel
      const personnelMap = new Map<string, {
        name: string;
        title: string | null;
        totalHours: number;
        rate: number;
        isOverhead: boolean;
      }>();

      for (const entry of data || []) {
        if (!entry.personnel_id || !entry.personnel) continue;
        const p = entry.personnel as any;
        const rate = (entry as any).hourly_rate ?? p.hourly_rate ?? 0;
        const isOverhead = (entry as any).is_overhead === true;
        
        // Skip overhead entries for project allocation
        if (isOverhead) continue;

        const existing = personnelMap.get(entry.personnel_id);
        if (existing) {
          existing.totalHours += entry.hours || 0;
          if (rate > 0 && existing.rate === 0) existing.rate = rate;
        } else {
          personnelMap.set(entry.personnel_id, {
            name: `${p.first_name} ${p.last_name}`,
            title: p.title || null,
            totalHours: entry.hours || 0,
            rate,
            isOverhead: false,
          });
        }
      }

      const result: PersonnelAllocation[] = [];
      for (const [id, d] of personnelMap) {
        const { regularHours, overtimeHours } = calculateSingleEmployeeOvertime(d.totalHours, 40);
        const isSupervision = d.title?.toLowerCase().includes("superintendent") || 
                              d.title?.toLowerCase().includes("supervisor") || 
                              d.title?.toLowerCase().includes("foreman") || false;
        result.push({
          personnel_id: id,
          personnel_name: d.name,
          title: d.title,
          total_hours: d.totalHours,
          regular_hours: regularHours,
          overtime_hours: overtimeHours,
          hourly_rate: d.rate,
          estimated_cost: (regularHours * d.rate) + (overtimeHours * d.rate * 1.5),
          is_supervision: isSupervision,
        });
      }

      return result.sort((a, b) => b.total_hours - a.total_hours);
    },
    enabled: !!projectId,
  });

  const totals = useMemo(() => {
    const totalHours = allocations.reduce((s, a) => s + a.total_hours, 0);
    const totalCost = allocations.reduce((s, a) => s + a.estimated_cost, 0);
    const supervisionHours = allocations.filter(a => a.is_supervision).reduce((s, a) => s + a.total_hours, 0);
    const supervisionCost = allocations.filter(a => a.is_supervision).reduce((s, a) => s + a.estimated_cost, 0);
    const fieldHours = totalHours - supervisionHours;
    const fieldCost = totalCost - supervisionCost;
    return { totalHours, totalCost, supervisionHours, supervisionCost, fieldHours, fieldCost };
  }, [allocations]);

  if (isLoading) return null;
  if (allocations.length === 0) return null;

  return (
    <Card className="glass border-border">
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Labor Allocation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1 p-3 bg-primary/10 rounded-lg">
            <p className="text-sm text-muted-foreground">Total Hours</p>
            <p className="text-2xl font-bold">{totals.totalHours.toFixed(1)}h</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3" /> Supervision
            </p>
            <p className="text-lg font-bold">{totals.supervisionHours.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(totals.supervisionCost)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Field Labor</p>
            <p className="text-lg font-bold">{totals.fieldHours.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(totals.fieldCost)}</p>
          </div>
        </div>

        {/* Personnel Breakdown */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2 font-medium">Personnel</th>
                <th className="text-right p-2 font-medium">Reg Hrs</th>
                <th className="text-right p-2 font-medium">OT Hrs</th>
                <th className="text-right p-2 font-medium">Total</th>
                <th className="text-right p-2 font-medium">Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => (
                <tr key={a.personnel_id} className="border-b last:border-0">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{a.personnel_name}</span>
                      {a.is_supervision && (
                        <span className="text-xs bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded">
                          Supervision
                        </span>
                      )}
                    </div>
                    {a.title && <p className="text-xs text-muted-foreground">{a.title}</p>}
                  </td>
                  <td className="text-right p-2">{a.regular_hours.toFixed(1)}</td>
                  <td className="text-right p-2">{a.overtime_hours > 0 ? a.overtime_hours.toFixed(1) : "—"}</td>
                  <td className="text-right p-2 font-medium">{a.total_hours.toFixed(1)}h</td>
                  <td className="text-right p-2 font-medium">{formatCurrency(a.estimated_cost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-medium">
                <td className="p-2">Total</td>
                <td className="text-right p-2">{allocations.reduce((s, a) => s + a.regular_hours, 0).toFixed(1)}</td>
                <td className="text-right p-2">{allocations.reduce((s, a) => s + a.overtime_hours, 0).toFixed(1)}</td>
                <td className="text-right p-2">{totals.totalHours.toFixed(1)}h</td>
                <td className="text-right p-2">{formatCurrency(totals.totalCost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
