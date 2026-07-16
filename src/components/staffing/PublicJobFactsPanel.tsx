import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, DollarSign, Hotel, Utensils, Truck, Users } from "lucide-react";
import { format } from "date-fns";
import type { TaskOrder, PublicTaskOrderPosition } from "@/integrations/supabase/hooks/useStaffingApplications";

interface Props {
  taskOrder: TaskOrder;
  positions: PublicTaskOrderPosition[];
}

// Positive-only lodging label. Explicit "not provided" is intentionally omitted —
// negatives never render on the public posting.
const lodgingLabel = (s?: string | null) =>
  s === "provided" ? "Lodging provided" : s === "stipend" ? "Lodging stipend" : null;

export function PublicJobFactsPanel({ taskOrder, positions }: Props) {
  const facts: { icon: React.ReactNode; label: string; note?: string | null }[] = [];

  if (taskOrder.start_at) {
    facts.push({ icon: <Calendar className="h-3.5 w-3.5" />, label: `Starts ${format(new Date(taskOrder.start_at), "MMM d, yyyy")}` });
  }
  if (taskOrder.approx_duration) {
    facts.push({ icon: <Clock className="h-3.5 w-3.5" />, label: `Duration: ${taskOrder.approx_duration}` });
  }
  if (taskOrder.days_per_week || taskOrder.hours_per_day) {
    const parts: string[] = [];
    if (taskOrder.days_per_week) parts.push(`${taskOrder.days_per_week} days/wk`);
    if (taskOrder.hours_per_day) parts.push(`${taskOrder.hours_per_day} hrs/day`);
    facts.push({ icon: <Clock className="h-3.5 w-3.5" />, label: parts.join(" · "), note: taskOrder.schedule_notes });
  }
  if (taskOrder.per_diem_amount != null) {
    facts.push({
      icon: <DollarSign className="h-3.5 w-3.5" />,
      label: `Per diem: $${Number(taskOrder.per_diem_amount).toFixed(2)}/day`,
      note: taskOrder.per_diem_notes,
    });
  }
  const lodging = lodgingLabel(taskOrder.lodging_status);
  if (lodging) {
    facts.push({ icon: <Hotel className="h-3.5 w-3.5" />, label: lodging, note: taskOrder.lodging_notes });
  }
  if (taskOrder.meals_provided) {
    facts.push({ icon: <Utensils className="h-3.5 w-3.5" />, label: "Meals provided", note: taskOrder.meals_notes });
  }
  if (taskOrder.mob_demob_paid) {
    facts.push({ icon: <Truck className="h-3.5 w-3.5" />, label: "Mob/demob paid", note: taskOrder.mob_demob_notes });
  }

  if (facts.length === 0 && positions.length === 0) return null;

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      {facts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {facts.map((f, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="flex items-center gap-1.5 font-normal py-1 px-2"
              title={f.note || undefined}
            >
              {f.icon}
              <span>{f.label}</span>
            </Badge>
          ))}
        </div>
      )}
      {positions.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Positions
          </div>
          <ul className="text-sm space-y-1">
            {positions.map((p) => (
              <li key={p.id}>
                <span className="font-medium">{p.position_label}</span>
                {" — "}
                <span>{p.headcount} opening{p.headcount === 1 ? "" : "s"}</span>
                {p.advertised_pay_rate != null && (
                  <span> — ${Number(p.advertised_pay_rate).toFixed(2)}/hr</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
