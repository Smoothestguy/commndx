import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Plus, Trash2, Upload, Building2, ChevronDown, ChevronRight, Edit, LayoutGrid, List } from "lucide-react";
import { ProjectUnitsFloorPlan } from "./ProjectUnitsFloorPlan";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { 
  useProjectUnits, 
  useJOLineItemAllocations, 
  useAddProjectUnit, 
  useDeleteProjectUnit,
  useUpsertUnitScopeItem,
  useDeleteUnitScopeItem,
  useUpdateScopeItemStatus,
  useBulkAddUnits,
  type UnitWithScopeItems
} from "@/integrations/supabase/hooks/useProjectUnits";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ProjectUnitsSectionProps {
  projectId: string;
}

export const ProjectUnitsSection = ({ projectId }: ProjectUnitsSectionProps) => {
  const { data: units, isLoading } = useProjectUnits(projectId);
  const { data: allocations } = useJOLineItemAllocations(projectId);
  const { data: vendors } = useVendors();
  const addUnit = useAddProjectUnit();
  const deleteUnit = useDeleteProjectUnit();
  const upsertScopeItem = useUpsertUnitScopeItem();
  const deleteScopeItem = useDeleteUnitScopeItem();
  const updateStatus = useUpdateScopeItemStatus();
  const bulkAdd = useBulkAddUnits();

  const [viewMode, setViewMode] = useState<"table" | "floorplan">("floorplan");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [assigningUnitId, setAssigningUnitId] = useState<string | null>(null);
  const [newUnit, setNewUnit] = useState({ unit_number: "", unit_name: "", floor: "" });
  const [assignForm, setAssignForm] = useState({ jo_line_item_id: "", quantity: "", assigned_vendor_id: "" });

  const activeVendors = useMemo(() => vendors?.filter(v => v.status === "active") || [], [vendors]);

  const toggleExpand = (id: string) => {
    setExpandedUnits(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddUnit = async () => {
    if (!newUnit.unit_number.trim()) {
      toast.error("Unit number is required");
      return;
    }
    await addUnit.mutateAsync({ project_id: projectId, ...newUnit });
    setNewUnit({ unit_number: "", unit_name: "", floor: "" });
    setIsAddDialogOpen(false);
  };

  const openAssignDialog = (unitId: string) => {
    setAssigningUnitId(unitId);
    setAssignForm({ jo_line_item_id: "", quantity: "", assigned_vendor_id: "" });
    setIsAssignDialogOpen(true);
  };

  const handleAssignScope = async () => {
    if (!assigningUnitId || !assignForm.jo_line_item_id || !assignForm.quantity) {
      toast.error("Please fill in all required fields");
      return;
    }

    const qty = parseFloat(assignForm.quantity);
    const allocation = allocations?.find(a => a.id === assignForm.jo_line_item_id);
    if (allocation && qty > allocation.remaining_quantity) {
      toast.error(`Cannot assign ${qty}. Only ${allocation.remaining_quantity} remaining for this line item.`);
      return;
    }

    await upsertScopeItem.mutateAsync({
      project_id: projectId,
      unit_id: assigningUnitId,
      jo_line_item_id: assignForm.jo_line_item_id,
      quantity: qty,
      assigned_vendor_id: assignForm.assigned_vendor_id || null,
    });
    setIsAssignDialogOpen(false);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      let unitsToAdd: Array<{ unit_number: string; unit_name?: string; floor?: string }> = [];

      // Step 1: Try smart detection FIRST (raw arrays - handles non-standard layouts)
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      let headerRowIdx = -1;
      const colMap: Record<string, number> = {};

      for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
        const row = rawRows[i];
        if (!Array.isArray(row)) continue;
        for (let j = 0; j < row.length; j++) {
          const cellVal = String(row[j] ?? "").toLowerCase().trim();
          if (cellVal.includes("unit no")) {
            headerRowIdx = i;
            colMap.unit_number = j;
            // Map remaining columns from this header row
            row.forEach((cell: any, idx: number) => {
              const label = String(cell ?? "").toLowerCase().trim();
              if (label.includes("unit no")) colMap.unit_number = idx;
              if (label.includes("shower size")) colMap.shower_size = idx;
              if (label.includes("ceiling")) colMap.ceiling = idx;
              if (label.includes("carpet")) colMap.carpet = idx;
              if (label.includes("shower floor") || label.includes("s.f")) colMap.shower_floor = idx;
              if (label.includes("shower wall") || label.includes("s.w")) colMap.shower_wall = idx;
              if (label.includes("trim top")) colMap.trim_top = idx;
              if (label.includes("trim side")) colMap.trim_side = idx;
              if (label.includes("bath thresh")) colMap.bath_threshold = idx;
              if (label.includes("entry thresh")) colMap.entry_threshold = idx;
              if (label.includes("shower curb") || label.includes("curbs")) colMap.shower_curbs = idx;
              if (label.includes("(floor)") && !colMap.floor_col) colMap.floor_col = idx;
            });
            break;
          }
        }
        if (headerRowIdx >= 0) break;
      }

      if (headerRowIdx >= 0 && colMap.unit_number !== undefined) {
        for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!Array.isArray(row)) continue;
          const rawVal = row[colMap.unit_number];
          const unitNum = String(rawVal ?? "").trim();
          if (!unitNum || !Number.isFinite(Number(unitNum))) continue;

          const floor = unitNum.length === 3 ? unitNum[0] : undefined;
          const showerSize = colMap.shower_size !== undefined ? String(row[colMap.shower_size] ?? "").trim() : undefined;

          unitsToAdd.push({
            unit_number: unitNum,
            unit_name: showerSize || undefined,
            floor,
          });
        }
        console.log("[CSV Import] Smart detection found", unitsToAdd.length, "units from header row", headerRowIdx);
      }

      // Step 2: Fall back to standard parsing if smart detection found nothing
      if (unitsToAdd.length === 0) {
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
        if (rows.length > 0) {
          unitsToAdd = rows.map(row => ({
            unit_number: String(
              row["Unit Number"] || row["unit_number"] || row["Unit"] ||
              row["Room"] || row["Unit No."] || row["Unit No"] || ""
            ).trim(),
            unit_name: String(row["Unit Name"] || row["unit_name"] || row["Name"] || "").trim() || undefined,
            floor: String(row["Floor"] || row["floor"] || "").trim() || undefined,
          })).filter(u => u.unit_number);
        }
        console.log("[CSV Import] Standard parsing found", unitsToAdd.length, "units");
      }

      if (unitsToAdd.length === 0) {
        toast.error("No valid units found. Expected column: 'Unit Number', 'Unit', 'Room', or 'Unit No.'");
        return;
      }

      const floors = [...new Set(unitsToAdd.map(u => u.floor).filter(Boolean))];
      toast.info(`Found ${unitsToAdd.length} units across ${floors.length} floor(s). Importing...`);

      await bulkAdd.mutateAsync({ project_id: projectId, units: unitsToAdd });
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    }

    // Reset file input
    e.target.value = "";
  };

  const statusOptions: Array<{ value: "not_started" | "in_progress" | "complete" | "verified"; label: string }> = [
    { value: "not_started", label: "Not Started" },
    { value: "in_progress", label: "In Progress" },
    { value: "complete", label: "Complete" },
    { value: "verified", label: "Verified" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h3 className="font-heading text-lg font-semibold">
            Units / Rooms ({units?.length || 0})
          </h3>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex border border-border rounded-md overflow-hidden">
            <Button
              type="button"
              variant={viewMode === "floorplan" ? "default" : "ghost"}
              size="icon"
              className="h-7 w-7 rounded-none"
              onClick={() => setViewMode("floorplan")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant={viewMode === "table" ? "default" : "ghost"}
              size="icon"
              className="h-7 w-7 rounded-none"
              onClick={() => setViewMode("table")}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
          <label>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportCSV} />
            <Button type="button" variant="outline" size="sm" asChild>
              <span>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Import
              </span>
            </Button>
          </label>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Unit
          </Button>
        </div>
      </div>

      {/* Allocation Summary Dashboard */}
      {allocations && allocations.length > 0 && (
        <Card className="glass border-border">
          <CardContent className="pt-4 pb-3">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Allocation Summary</h4>
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[hsl(var(--table-header-bg))] hover:bg-[hsl(var(--table-header-bg))]">
                    <TableHead className="h-7 text-[11px] font-semibold text-[hsl(var(--table-header-fg))]">Line Item</TableHead>
                    <TableHead className="h-7 text-[11px] font-semibold text-[hsl(var(--table-header-fg))] text-right w-[100px]">Total Qty</TableHead>
                    <TableHead className="h-7 text-[11px] font-semibold text-[hsl(var(--table-header-fg))] text-right w-[100px]">Assigned</TableHead>
                    <TableHead className="h-7 text-[11px] font-semibold text-[hsl(var(--table-header-fg))] text-right w-[100px]">Remaining</TableHead>
                    <TableHead className="h-7 text-[11px] font-semibold text-[hsl(var(--table-header-fg))] text-right w-[80px]">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((a) => {
                    const pct = a.total_quantity > 0 ? Math.round((a.assigned_quantity / a.total_quantity) * 100) : 0;
                    return (
                      <TableRow key={a.id} className="text-xs">
                        <TableCell className="py-1 px-2 truncate max-w-[250px]">{a.description}</TableCell>
                        <TableCell className="py-1 px-2 text-right tabular-nums">{a.total_quantity.toLocaleString()}</TableCell>
                        <TableCell className="py-1 px-2 text-right tabular-nums font-medium text-primary">{a.assigned_quantity.toLocaleString()}</TableCell>
                        <TableCell className={cn("py-1 px-2 text-right tabular-nums font-medium", a.remaining_quantity <= 0 ? "text-success" : "text-warning")}>{a.remaining_quantity.toLocaleString()}</TableCell>
                        <TableCell className="py-1 px-2 text-right tabular-nums">{pct}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Units View */}
      {isLoading ? (
        <Card className="glass border-border">
          <CardContent className="py-8 text-center text-muted-foreground">Loading units...</CardContent>
        </Card>
      ) : !units || units.length === 0 ? (
        <Card className="glass border-border">
          <CardContent className="py-8 text-center text-muted-foreground">
            No units yet. Add units to start tracking room-level scope allocations.
          </CardContent>
        </Card>
      ) : viewMode === "floorplan" ? (
        <ProjectUnitsFloorPlan
          units={units}
          projectId={projectId}
          allocations={allocations}
          activeVendors={activeVendors}
          onAssignScope={(unitId) => openAssignDialog(unitId)}
          onDeleteUnit={(unitId) => deleteUnit.mutate({ id: unitId, project_id: projectId })}
          onUpdateStatus={(id, status) => updateStatus.mutate({ id, project_id: projectId, status })}
          onDeleteScopeItem={(id) => deleteScopeItem.mutate({ id, project_id: projectId })}
        />
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[hsl(var(--table-header-bg))] hover:bg-[hsl(var(--table-header-bg))]">
                <TableHead className="h-8 text-xs font-semibold text-[hsl(var(--table-header-fg))] w-[80px]">Unit #</TableHead>
                <TableHead className="h-8 text-xs font-semibold text-[hsl(var(--table-header-fg))]">Name</TableHead>
                <TableHead className="h-8 text-xs font-semibold text-[hsl(var(--table-header-fg))] w-[80px]">Floor</TableHead>
                <TableHead className="h-8 text-xs font-semibold text-[hsl(var(--table-header-fg))] w-[80px] text-center">Scopes</TableHead>
                <TableHead className="h-8 text-xs font-semibold text-[hsl(var(--table-header-fg))] w-[100px]">Status</TableHead>
                <TableHead className="h-8 text-xs font-semibold text-[hsl(var(--table-header-fg))] w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => {
                const isExpanded = expandedUnits.has(unit.id);
                const overallStatus = getOverallUnitStatus(unit);
                return (
                  <Collapsible key={unit.id} open={isExpanded} asChild>
                    <>
                      <TableRow
                        className="cursor-pointer text-xs hover:bg-muted/50 transition-colors"
                        onClick={() => toggleExpand(unit.id)}
                      >
                        <TableCell className="py-1.5 px-2 font-medium">
                          <div className="flex items-center gap-1">
                            {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                            {unit.unit_number}
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5 px-2">{unit.unit_name || <span className="text-muted-foreground italic">—</span>}</TableCell>
                        <TableCell className="py-1.5 px-2">{unit.floor || "—"}</TableCell>
                        <TableCell className="py-1.5 px-2 text-center">{unit.scope_items.length}</TableCell>
                        <TableCell className="py-1.5 px-2">
                          {unit.scope_items.length > 0 ? (
                            <StatusBadge status={overallStatus as any} />
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 px-2">
                          <div className="flex gap-1">
                            <Button
                              type="button" variant="ghost" size="icon" className="h-6 w-6"
                              onClick={(e) => { e.stopPropagation(); openAssignDialog(unit.id); }}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button" variant="ghost" size="icon" className="h-6 w-6"
                              onClick={(e) => { e.stopPropagation(); deleteUnit.mutate({ id: unit.id, project_id: projectId }); }}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <tr>
                          <td colSpan={6} className="p-0 border-b">
                            <div className="bg-secondary/30 px-4 py-2">
                              {unit.scope_items.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic py-2">No scope items assigned. Click + to add.</p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-muted-foreground">
                                      <th className="text-left py-1 font-medium">Scope Item</th>
                                      <th className="text-right py-1 font-medium w-[80px]">Qty</th>
                                      <th className="text-left py-1 font-medium w-[150px]">Contractor</th>
                                      <th className="text-left py-1 font-medium w-[120px]">Status</th>
                                      <th className="w-[40px]"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {unit.scope_items.map((si) => (
                                      <tr key={si.id} className="border-t border-border/50">
                                        <td className="py-1.5">{si.jo_description || "Unknown"}</td>
                                        <td className="py-1.5 text-right tabular-nums">{si.quantity.toLocaleString()}</td>
                                        <td className="py-1.5">{si.vendor_name || <span className="text-muted-foreground italic">Unassigned</span>}</td>
                                        <td className="py-1.5">
                                          <Select
                                            value={si.status}
                                            onValueChange={(v: any) => updateStatus.mutate({ id: si.id, project_id: projectId, status: v })}
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
                                        <td className="py-1.5">
                                          <Button
                                            type="button" variant="ghost" size="icon" className="h-5 w-5"
                                            onClick={() => deleteScopeItem.mutate({ id: si.id, project_id: projectId })}
                                          >
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                          </Button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Unit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Add Unit / Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Unit Number *</Label>
              <Input value={newUnit.unit_number} onChange={(e) => setNewUnit(prev => ({ ...prev, unit_number: e.target.value }))} placeholder="e.g. 251" className="bg-secondary border-border h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unit Name</Label>
              <Input value={newUnit.unit_name} onChange={(e) => setNewUnit(prev => ({ ...prev, unit_name: e.target.value }))} placeholder="e.g. King Suite" className="bg-secondary border-border h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Floor</Label>
              <Input value={newUnit.floor} onChange={(e) => setNewUnit(prev => ({ ...prev, floor: e.target.value }))} placeholder="e.g. 2nd" className="bg-secondary border-border h-8 text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAddUnit} disabled={addUnit.isPending}>Add Unit</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Scope Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Assign Scope Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">JO Line Item *</Label>
              <Select value={assignForm.jo_line_item_id} onValueChange={(v) => setAssignForm(prev => ({ ...prev, jo_line_item_id: v }))}>
                <SelectTrigger className="bg-secondary border-border h-8 text-xs">
                  <SelectValue placeholder="Select line item..." />
                </SelectTrigger>
                <SelectContent>
                  {allocations?.map(a => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">
                      {a.description} (Remaining: {a.remaining_quantity.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quantity *</Label>
              <Input 
                type="number" step="0.01"
                value={assignForm.quantity} 
                onChange={(e) => setAssignForm(prev => ({ ...prev, quantity: e.target.value }))} 
                placeholder="0"
                className="bg-secondary border-border h-8 text-sm" 
              />
              {assignForm.jo_line_item_id && allocations && (
                <p className="text-[11px] text-muted-foreground">
                  Available: {allocations.find(a => a.id === assignForm.jo_line_item_id)?.remaining_quantity.toLocaleString() || 0}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contractor (Optional)</Label>
              <Select value={assignForm.assigned_vendor_id} onValueChange={(v) => setAssignForm(prev => ({ ...prev, assigned_vendor_id: v }))}>
                <SelectTrigger className="bg-secondary border-border h-8 text-xs">
                  <SelectValue placeholder="Select contractor..." />
                </SelectTrigger>
                <SelectContent>
                  {activeVendors.map(v => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAssignScope} disabled={upsertScopeItem.isPending}>Assign</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function getOverallUnitStatus(unit: UnitWithScopeItems): string {
  if (unit.scope_items.length === 0) return "not_started";
  const statuses = unit.scope_items.map(s => s.status);
  if (statuses.every(s => s === "verified")) return "verified";
  if (statuses.every(s => s === "complete" || s === "verified")) return "complete";
  if (statuses.some(s => s === "in_progress" || s === "complete")) return "in_progress";
  return "not_started";
}
