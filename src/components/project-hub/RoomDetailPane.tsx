import { ProjectRoom, useUpdateScopeItemProgress } from "@/integrations/supabase/hooks/useProjectRooms";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface Props {
  room: ProjectRoom;
  projectId: string;
}

const scopeStatusLabels: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  complete: "Complete",
  verified: "Verified",
};

const scopeStatusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/20 text-blue-400",
  complete: "bg-green-500/20 text-green-400",
  verified: "bg-purple-500/20 text-purple-400",
};

export function RoomDetailPane({ room, projectId }: Props) {
  const updateProgress = useUpdateScopeItemProgress();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");

  const items = room.room_scope_items || [];

  if (items.length === 0) {
    return (
      <div className="p-4 bg-muted/30 text-sm text-muted-foreground">
        No scope items assigned to this room.
      </div>
    );
  }

  const handleSaveProgress = (itemId: string) => {
    const qty = parseFloat(editQty);
    if (isNaN(qty) || qty < 0) return;
    updateProgress.mutate({
      id: itemId,
      completed_quantity: qty,
      project_id: projectId,
    });
    setEditingId(null);
  };

  return (
    <div className="p-4 bg-muted/20 border-t">
      <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
        Scope Items — Unit {room.unit_number}
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const pct = item.allocated_quantity > 0
            ? Math.round((item.completed_quantity / item.allocated_quantity) * 100)
            : 0;

          return (
            <div
              key={item.id}
              className="flex items-center gap-3 p-2 rounded border border-border bg-background text-sm"
            >
              <div className="flex-1 min-w-0">
                <span className="font-medium truncate block">
                  {item.job_order_line_item?.description || "Line Item"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs whitespace-nowrap">
                {editingId === item.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      className="h-6 w-20 text-xs"
                      value={editQty}
                      onChange={(e) => setEditQty(e.target.value)}
                      onBlur={() => handleSaveProgress(item.id)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveProgress(item.id)}
                      autoFocus
                      min={0}
                      max={item.allocated_quantity}
                    />
                    <span>/ {item.allocated_quantity}</span>
                  </div>
                ) : (
                  <span
                    className="cursor-pointer hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(item.id);
                      setEditQty(String(item.completed_quantity));
                    }}
                  >
                    {item.completed_quantity} / {item.allocated_quantity} {item.unit || ""}
                  </span>
                )}
                <span className="text-muted-foreground">({pct}%)</span>
              </div>
              <Select
                value={item.status}
                onValueChange={(val) =>
                  updateProgress.mutate({
                    id: item.id,
                    completed_quantity: item.completed_quantity,
                    status: val as any,
                    project_id: projectId,
                  })
                }
              >
                <SelectTrigger className="h-6 w-[110px] text-xs" onClick={(e) => e.stopPropagation()}>
                  <Badge className={`${scopeStatusColors[item.status]} text-[10px] px-1.5 py-0`}>
                    {scopeStatusLabels[item.status]}
                  </Badge>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(scopeStatusLabels).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
      {room.notes && (
        <p className="mt-3 text-xs text-muted-foreground">Notes: {room.notes}</p>
      )}
    </div>
  );
}
