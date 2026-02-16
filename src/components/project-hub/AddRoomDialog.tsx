import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAddRoom, useJobOrderRemainingQuantities } from "@/integrations/supabase/hooks/useProjectRooms";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

interface ScopeAllocation {
  line_item_id: string;
  description: string;
  allocated_quantity: string;
  remaining: number;
  unit: string;
}

export function AddRoomDialog({ open, onOpenChange, projectId }: Props) {
  const [unitNumber, setUnitNumber] = useState("");
  const [floorNumber, setFloorNumber] = useState<string>("");
  const [contractorId, setContractorId] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [allocations, setAllocations] = useState<Map<string, ScopeAllocation>>(new Map());

  const addRoom = useAddRoom();
  const { data: remainingQuantities } = useJobOrderRemainingQuantities(projectId);

  // Fetch personnel for contractor dropdown
  const { data: personnel } = useQuery({
    queryKey: ["personnel-list-for-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel")
        .select("id, first_name, last_name")
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  // Auto-derive floor from unit number
  useEffect(() => {
    if (unitNumber.length >= 3) {
      const prefix = parseInt(unitNumber.charAt(0));
      if (!isNaN(prefix)) {
        setFloorNumber(String(prefix));
      }
    }
  }, [unitNumber]);

  const toggleItem = (itemId: string) => {
    const next = new Set(selectedItems);
    if (next.has(itemId)) {
      next.delete(itemId);
      const nextAlloc = new Map(allocations);
      nextAlloc.delete(itemId);
      setAllocations(nextAlloc);
    } else {
      next.add(itemId);
    }
    setSelectedItems(next);
  };

  const updateAllocation = (itemId: string, qty: string) => {
    const rq = remainingQuantities?.find((r) => r.line_item_id === itemId);
    if (!rq) return;
    const nextAlloc = new Map(allocations);
    nextAlloc.set(itemId, {
      line_item_id: itemId,
      description: rq.description,
      allocated_quantity: qty,
      remaining: rq.remaining_quantity,
      unit: "",
    });
    setAllocations(nextAlloc);
  };

  const handleSubmit = () => {
    if (!unitNumber.trim()) return;

    const scopeItems = Array.from(selectedItems)
      .map((itemId) => {
        const alloc = allocations.get(itemId);
        const qty = parseFloat(alloc?.allocated_quantity || "0");
        if (qty <= 0) return null;
        return {
          job_order_line_item_id: itemId,
          allocated_quantity: qty,
          unit: alloc?.unit || undefined,
        };
      })
      .filter(Boolean) as any[];

    addRoom.mutate(
      {
        project_id: projectId,
        unit_number: unitNumber.trim(),
        floor_number: floorNumber ? parseInt(floorNumber) : null,
        assigned_contractor_id: contractorId || null,
        scope_items: scopeItems,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      }
    );
  };

  const resetForm = () => {
    setUnitNumber("");
    setFloorNumber("");
    setContractorId("");
    setSelectedItems(new Set());
    setAllocations(new Map());
  };

  const hasValidAllocations = Array.from(selectedItems).some((id) => {
    const alloc = allocations.get(id);
    const qty = parseFloat(alloc?.allocated_quantity || "0");
    const rq = remainingQuantities?.find((r) => r.line_item_id === id);
    return qty > 0 && rq && qty <= rq.remaining_quantity;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Room / Unit</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unit Number</Label>
              <Input
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                placeholder="e.g. 251"
              />
            </div>
            <div className="space-y-2">
              <Label>Floor</Label>
              <Input
                value={floorNumber}
                onChange={(e) => setFloorNumber(e.target.value)}
                placeholder="Auto-derived"
                type="number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assigned Contractor</Label>
            <Select value={contractorId} onValueChange={setContractorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select contractor (optional)" />
              </SelectTrigger>
              <SelectContent>
                {personnel?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scope Items Selection */}
          <div className="space-y-2">
            <Label>Scope Items (from Job Order)</Label>
            {!remainingQuantities || remainingQuantities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No job order line items found for this project.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-2">
                {remainingQuantities.map((rq) => (
                  <div
                    key={rq.line_item_id}
                    className="flex flex-col gap-1 p-2 rounded border border-border"
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedItems.has(rq.line_item_id)}
                        onCheckedChange={() => toggleItem(rq.line_item_id)}
                      />
                      <span className="text-sm font-medium flex-1 truncate">{rq.description}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {rq.remaining_quantity.toLocaleString()} remaining
                      </span>
                    </div>
                    {selectedItems.has(rq.line_item_id) && (
                      <div className="ml-6 mt-1">
                        <Input
                          type="number"
                          placeholder="Quantity to allocate"
                          className="h-8 text-sm"
                          min={0}
                          max={rq.remaining_quantity}
                          value={allocations.get(rq.line_item_id)?.allocated_quantity || ""}
                          onChange={(e) => updateAllocation(rq.line_item_id, e.target.value)}
                        />
                        {(() => {
                          const val = parseFloat(allocations.get(rq.line_item_id)?.allocated_quantity || "0");
                          if (val > rq.remaining_quantity) {
                            return <p className="text-xs text-destructive mt-1">Exceeds remaining balance</p>;
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!unitNumber.trim() || addRoom.isPending}
          >
            {addRoom.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Add Room
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
