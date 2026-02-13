import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnitWithScopeItems } from "@/integrations/supabase/hooks/useProjectUnits";

interface ProjectUnitsFloorPlanProps {
  units: UnitWithScopeItems[];
  projectId: string;
  allocations: any[] | undefined;
  activeVendors: any[];
  onAssignScope: (unitId: string) => void;
  onDeleteUnit: (unitId: string) => void;
  onUpdateStatus: (id: string, status: "not_started" | "in_progress" | "complete" | "verified") => void;
  onDeleteScopeItem: (id: string) => void;
}

const getFloor = (unitNumber: string): string => {
  const num = parseInt(unitNumber);
  if (num >= 200 && num < 300) return "2";
  if (num >= 400 && num < 500) return "4";
  if (num >= 500 && num < 600) return "5";
  if (num >= 100 && num < 200) return "1";
  if (num >= 300 && num < 400) return "3";
  if (num >= 600 && num < 700) return "6";
  return "Other";
};

function getOverallUnitStatus(unit: UnitWithScopeItems): string {
  if (unit.scope_items.length === 0) return "not_started";
  const statuses = unit.scope_items.map(s => s.status);
  if (statuses.every(s => s === "verified")) return "verified";
  if (statuses.every(s => s === "complete" || s === "verified")) return "complete";
  if (statuses.some(s => s === "in_progress" || s === "complete")) return "in_progress";
  return "not_started";
}

const statusColors: Record<string, string> = {
  not_started: "bg-muted border-border text-foreground",
  in_progress: "bg-blue-500/10 border-blue-500 text-blue-700 dark:text-blue-300",
  complete: "bg-green-500/10 border-green-500 text-green-700 dark:text-green-300",
  verified: "bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-300",
};

const statusOptions: Array<{ value: "not_started" | "in_progress" | "complete" | "verified"; label: string }> = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
  { value: "verified", label: "Verified" },
];

export const ProjectUnitsFloorPlan = ({
  units,
  projectId,
  allocations,
  activeVendors,
  onAssignScope,
  onDeleteUnit,
  onUpdateStatus,
  onDeleteScopeItem,
}: ProjectUnitsFloorPlanProps) => {
  const [selectedUnit, setSelectedUnit] = useState<UnitWithScopeItems | null>(null);

  const floorGroups = useMemo(() => {
    const groups: Record<string, UnitWithScopeItems[]> = {};
    units.forEach(unit => {
      const floor = unit.floor || getFloor(unit.unit_number);
      if (!groups[floor]) groups[floor] = [];
      groups[floor].push(unit);
    });
    // Sort units within each floor
    Object.values(groups).forEach(arr => arr.sort((a, b) => a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true })));
    return groups;
  }, [units]);

  const floors = useMemo(() => 
    Object.keys(floorGroups).sort((a, b) => {
      const na = parseInt(a), nb = parseInt(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    }), [floorGroups]);

  const defaultFloor = floors[0] || "2";

  if (units.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tabs defaultValue={defaultFloor} className="w-full">
        <TabsList className="mb-4">
          {floors.map(floor => (
            <TabsTrigger key={floor} value={floor} className="text-xs">
              Floor {floor} ({floorGroups[floor].length})
            </TabsTrigger>
          ))}
        </TabsList>

        {floors.map(floor => (
          <TabsContent key={floor} value={floor}>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {floorGroups[floor].map(unit => {
                const status = getOverallUnitStatus(unit);
                const done = unit.scope_items.filter(s => s.status === "complete" || s.status === "verified").length;
                const total = unit.scope_items.length;

                return (
                  <Tooltip key={unit.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSelectedUnit(unit)}
                        className={cn(
                          "relative flex flex-col items-center justify-center rounded-lg border-2 p-3 transition-all hover:scale-105 hover:shadow-md cursor-pointer min-h-[80px]",
                          statusColors[status]
                        )}
                      >
                        <span className="text-lg font-bold tabular-nums">{unit.unit_number}</span>
                        {total > 0 && (
                          <span className="text-[10px] opacity-70 mt-0.5">
                            {done}/{total} done
                          </span>
                        )}
                        {total === 0 && (
                          <span className="text-[10px] opacity-50 mt-0.5">No scopes</span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px]">
                      <p className="font-semibold text-xs mb-1">Unit {unit.unit_number}{unit.unit_name ? ` — ${unit.unit_name}` : ""}</p>
                      {total === 0 ? (
                        <p className="text-[11px] text-muted-foreground">No scope items assigned</p>
                      ) : (
                        <ul className="text-[11px] space-y-0.5">
                          {unit.scope_items.map(si => (
                            <li key={si.id} className="flex justify-between gap-2">
                              <span className="truncate">{si.jo_description || "Unknown"}</span>
                              <span className="tabular-nums shrink-0">{si.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Unit Detail Dialog */}
      <Dialog open={!!selectedUnit} onOpenChange={(open) => !open && setSelectedUnit(null)}>
        <DialogContent className="bg-card border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              Unit {selectedUnit?.unit_number}
              {selectedUnit?.unit_name && <span className="text-muted-foreground font-normal">— {selectedUnit.unit_name}</span>}
            </DialogTitle>
          </DialogHeader>

          {selectedUnit && (
            <div className="space-y-4">
              {/* Status summary */}
              <div className="flex items-center gap-2">
                <StatusBadge status={getOverallUnitStatus(selectedUnit) as any} />
                <span className="text-xs text-muted-foreground">
                  {selectedUnit.scope_items.filter(s => s.status === "complete" || s.status === "verified").length} of {selectedUnit.scope_items.length} scopes complete
                </span>
              </div>

              {/* Scope Items */}
              {selectedUnit.scope_items.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-4">No scope items assigned to this unit.</p>
              ) : (
                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 text-muted-foreground">
                        <th className="text-left py-2 px-2 font-medium">Scope Item</th>
                        <th className="text-right py-2 px-2 font-medium w-[60px]">Qty</th>
                        <th className="text-left py-2 px-2 font-medium w-[120px]">Contractor</th>
                        <th className="text-left py-2 px-2 font-medium w-[120px]">Status</th>
                        <th className="w-[36px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedUnit.scope_items.map(si => (
                        <tr key={si.id} className="border-t border-border/50">
                          <td className="py-2 px-2">{si.jo_description || "Unknown"}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{si.quantity}</td>
                          <td className="py-2 px-2">{si.vendor_name || <span className="text-muted-foreground italic">—</span>}</td>
                          <td className="py-2 px-2">
                            <Select
                              value={si.status}
                              onValueChange={(v: any) => onUpdateStatus(si.id, v)}
                            >
                              <SelectTrigger className="h-6 text-[11px] bg-transparent border-transparent hover:border-border w-[110px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 px-2">
                            <Button
                              type="button" variant="ghost" size="icon" className="h-5 w-5"
                              onClick={() => onDeleteScopeItem(si.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between pt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    onDeleteUnit(selectedUnit.id);
                    setSelectedUnit(null);
                  }}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete Unit
                </Button>
                <Button
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    onAssignScope(selectedUnit.id);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Scope Item
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};
