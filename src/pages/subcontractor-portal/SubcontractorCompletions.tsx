import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { SubcontractorPortalLayout } from "@/components/subcontractor-portal/SubcontractorPortalLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle2, Loader2, Building2 } from "lucide-react";
import {
  useContractorRooms,
  useSubmitCompletion,
  ContractorRoom,
  RoomScopeItemWithBilling,
} from "@/integrations/supabase/hooks/useContractorCompletions";
import { toast } from "sonner";

export default function SubcontractorCompletions() {
  const navigate = useNavigate();
  const { data: rooms, isLoading } = useContractorRooms();
  const submitMutation = useSubmitCompletion();

  // Track selected items and quantities per room
  const [selections, setSelections] = useState<
    Record<string, { selected: boolean; quantity: number }>
  >({});

  // Group rooms by project
  const roomsByProject = useMemo(() => {
    if (!rooms) return {};
    const grouped: Record<string, ContractorRoom[]> = {};
    rooms.forEach((room) => {
      const key = room.project_name;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(room);
    });
    return grouped;
  }, [rooms]);

  const toggleItem = (itemId: string, remaining: number) => {
    setSelections((prev) => ({
      ...prev,
      [itemId]: prev[itemId]?.selected
        ? { selected: false, quantity: 0 }
        : { selected: true, quantity: remaining },
    }));
  };

  const updateQuantity = (itemId: string, qty: number) => {
    setSelections((prev) => ({
      ...prev,
      [itemId]: { selected: true, quantity: qty },
    }));
  };

  const getSelectedItemsForRoom = (room: ContractorRoom) => {
    return room.scope_items.filter(
      (item) => selections[item.id]?.selected && selections[item.id]?.quantity > 0
    );
  };

  const handleSubmit = async (room: ContractorRoom) => {
    const selected = getSelectedItemsForRoom(room);
    if (selected.length === 0) {
      toast.error("Please select at least one item to submit");
      return;
    }

    // Validate quantities
    for (const item of selected) {
      const qty = selections[item.id].quantity;
      const remaining = item.allocated_quantity - item.billed_quantity;
      if (qty > remaining) {
        toast.error(
          `Quantity for "${item.scope_description || item.scope_code}" exceeds remaining balance (${remaining})`
        );
        return;
      }
    }

    await submitMutation.mutateAsync({
      room_id: room.id,
      project_id: room.project_id,
      items: selected.map((item) => ({
        room_scope_item_id: item.id,
        job_order_line_item_id: item.job_order_line_item_id,
        description: item.scope_description || item.scope_code || "Scope item",
        quantity: selections[item.id].quantity,
        unit_cost: item.unit_cost,
      })),
    });

    // Clear selections for this room
    const cleared = { ...selections };
    room.scope_items.forEach((item) => delete cleared[item.id]);
    setSelections(cleared);
  };

  const calcRoomTotal = (room: ContractorRoom) => {
    return getSelectedItemsForRoom(room).reduce((sum, item) => {
      return sum + selections[item.id].quantity * item.unit_cost;
    }, 0);
  };

  return (
    <>
      <SEO title="My Rooms" description="View assigned rooms and submit completions." />
      <SubcontractorPortalLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">My Rooms</h1>
              <p className="text-muted-foreground">
                Select completed scope items and submit for billing.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/subcontractor/completions/history")}
            >
              View History
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !rooms || rooms.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No rooms assigned to you yet.</p>
            </Card>
          ) : (
            Object.entries(roomsByProject).map(([projectName, projectRooms]) => (
              <div key={projectName} className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{projectName}</h2>

                {projectRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    selections={selections}
                    onToggle={toggleItem}
                    onQuantityChange={updateQuantity}
                    onSubmit={() => handleSubmit(room)}
                    isSubmitting={submitMutation.isPending}
                    selectedTotal={calcRoomTotal(room)}
                    selectedCount={getSelectedItemsForRoom(room).length}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </SubcontractorPortalLayout>
    </>
  );
}

function RoomCard({
  room,
  selections,
  onToggle,
  onQuantityChange,
  onSubmit,
  isSubmitting,
  selectedTotal,
  selectedCount,
}: {
  room: ContractorRoom;
  selections: Record<string, { selected: boolean; quantity: number }>;
  onToggle: (id: string, remaining: number) => void;
  onQuantityChange: (id: string, qty: number) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  selectedTotal: number;
  selectedCount: number;
}) {
  const hasSelectableItems = room.scope_items.some(
    (item) => item.allocated_quantity - item.billed_quantity > 0
  );

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-semibold text-foreground">
              Unit {room.unit_number}
            </span>
            {room.floor_number && (
              <span className="text-sm text-muted-foreground ml-2">
                Floor {room.floor_number}
              </span>
            )}
          </div>
          <Badge variant="outline">{room.status}</Badge>
        </div>
      </div>

      <div className="divide-y">
        {room.scope_items.map((item) => {
          const remaining = item.allocated_quantity - item.billed_quantity;
          const isFullyBilled = remaining <= 0;
          const isSelected = selections[item.id]?.selected || false;
          const currentQty = selections[item.id]?.quantity || 0;

          return (
            <div
              key={item.id}
              className={`p-3 flex items-center gap-3 ${
                isFullyBilled ? "opacity-60 bg-muted/20" : ""
              }`}
            >
              {isFullyBilled ? (
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              ) : (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggle(item.id, remaining)}
                />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.scope_description || item.scope_code || "Scope Item"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isFullyBilled
                    ? `Fully billed (${item.billed_quantity}/${item.allocated_quantity})`
                    : `${item.billed_quantity}/${item.allocated_quantity} billed • ${remaining} remaining`}
                  {item.unit_cost > 0 && ` • ${formatCurrency(item.unit_cost)}/unit`}
                </p>
              </div>

              {!isFullyBilled && isSelected && (
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    type="number"
                    min={1}
                    max={remaining}
                    value={currentQty}
                    onChange={(e) =>
                      onQuantityChange(
                        item.id,
                        Math.min(Number(e.target.value), remaining)
                      )
                    }
                    className="w-20 h-8 text-sm"
                  />
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(currentQty * item.unit_cost)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasSelectableItems && (
        <div className="p-4 border-t bg-muted/10 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedCount > 0 ? (
              <>
                {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected •{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(selectedTotal)}
                </span>
              </>
            ) : (
              "Select items to submit"
            )}
          </div>
          <Button
            onClick={onSubmit}
            disabled={selectedCount === 0 || isSubmitting}
            size="sm"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Completion
          </Button>
        </div>
      )}
    </Card>
  );
}
