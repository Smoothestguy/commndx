import { Badge } from "@/components/ui/badge";
import { Users, Calendar, Clock, Bed, Utensils, Truck, DollarSign } from "lucide-react";
import { format } from "date-fns";
import type { TaskOrder, TaskOrderPosition } from "@/integrations/supabase/hooks/useStaffingApplications";

interface Props {
  taskOrder: TaskOrder;
  positions?: TaskOrderPosition[];
  className?: string;
}

const lodgingLabel: Record<string, string> = {
  provided: "Lodging Provided",
  stipend: "Lodging Stipend",
  not_provided: "No Lodging",
};

export function TaskOrderFacts({ taskOrder: t, positions, className }: Props) {
  const facts: { icon: React.ReactNode; text: string }[] = [];

  if (t.start_at) {
    facts.push({
      icon: <Calendar className="h-3 w-3" />,
      text: `Starts ${format(new Date(t.start_at), "MMM d, yyyy h:mm a")}`,
    });
  }
  if (t.approx_duration) {
    facts.push({ icon: <Clock className="h-3 w-3" />, text: t.approx_duration });
  }
  if (t.days_per_week || t.hours_per_day) {
    const parts: string[] = [];
    if (t.days_per_week) parts.push(`${t.days_per_week} days/wk`);
    if (t.hours_per_day) parts.push(`${t.hours_per_day} hrs/day`);
    facts.push({ icon: <Clock className="h-3 w-3" />, text: parts.join(" · ") });
  }
  if (t.per_diem_amount != null) {
    facts.push({
      icon: <DollarSign className="h-3 w-3" />,
      text: `Per Diem $${Number(t.per_diem_amount).toFixed(2)}/day`,
    });
  }
  if (t.lodging_status) {
    facts.push({
      icon: <Bed className="h-3 w-3" />,
      text: lodgingLabel[t.lodging_status] || t.lodging_status,
    });
  }
  if (t.meals_provided != null) {
    facts.push({
      icon: <Utensils className="h-3 w-3" />,
      text: t.meals_provided ? "Meals Provided" : "No Meals",
    });
  }
  if (t.mob_demob_paid != null) {
    facts.push({
      icon: <Truck className="h-3 w-3" />,
      text: t.mob_demob_paid ? "Mob/Demob Paid" : "Mob/Demob Unpaid",
    });
  }

  if (facts.length === 0 && (!positions || positions.length === 0)) return null;

  return (
    <div className={className}>
      {facts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {facts.map((f, i) => (
            <Badge key={i} variant="secondary" className="text-xs gap-1 font-normal">
              {f.icon}
              {f.text}
            </Badge>
          ))}
        </div>
      )}
      {positions && positions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {positions.map((p) => (
            <Badge key={p.id} variant="outline" className="text-xs gap-1 font-normal">
              <Users className="h-3 w-3" />
              {p.position_label} · {p.headcount}
              {p.advertised_pay_rate != null && (
                <span className="text-muted-foreground">
                  · ${Number(p.advertised_pay_rate).toFixed(2)}/hr
                </span>
              )}
              {p.show_pay_publicly === false && (
                <span className="text-muted-foreground italic">(pay hidden)</span>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
