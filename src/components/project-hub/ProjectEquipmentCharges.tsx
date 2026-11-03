import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Truck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useProjectAssetBilling } from "@/integrations/supabase/hooks/useAssetAssignments";
import { useProjectLocations } from "@/integrations/supabase/hooks/useProjectLocations";

/** Customer-billable per-diem equipment charges (revenue side — NOT a direct cost). */
export function ProjectEquipmentCharges({ projectId }: { projectId: string }) {
  const { billable, equipmentTotal, missingRate } = useProjectAssetBilling(projectId);
  const { data: locations = [] } = useProjectLocations(projectId);
  const locName = useMemo(() => Object.fromEntries(locations.map((l) => [l.id, l.name])), [locations]);
  if (billable.length === 0) return null;
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Truck className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">Equipment charges (billable to customer)</div>
            <div className="text-2xl font-semibold">{formatCurrency(equipmentTotal)}</div>
            <div className="text-xs text-muted-foreground">
              {billable.length} asset assignment{billable.length === 1 ? "" : "s"} · day rate × days on project
              {missingRate > 0 && <span className="text-warning"> · {missingRate} with no rate (not counted)</span>}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead className="text-muted-foreground">
              <tr className="text-left border-b">
                <th className="py-1 pr-2 font-medium">Asset</th>
                <th className="py-1 pr-2 font-medium">Location</th>
                <th className="py-1 pr-2 font-medium text-right">Days</th>
                <th className="py-1 pr-2 font-medium text-right">Rate</th>
                <th className="py-1 font-medium text-right">Accrued</th>
              </tr>
            </thead>
            <tbody>
              {billable.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-1 pr-2">{r.assets?.label ?? "Asset"}{r.status !== "active" || r.end_at ? <span className="text-muted-foreground"> (ended)</span> : null}</td>
                  <td className="py-1 pr-2 text-muted-foreground">{r.location_id ? locName[r.location_id] ?? "—" : "Project-wide"}</td>
                  <td className="py-1 pr-2 text-right">{r.days}</td>
                  <td className="py-1 pr-2 text-right">{r.rate != null ? `${formatCurrency(r.rate)}/day` : <span className="text-warning">no rate</span>}</td>
                  <td className="py-1 text-right font-medium">{r.accrued != null ? formatCurrency(r.accrued) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
