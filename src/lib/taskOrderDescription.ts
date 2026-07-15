// Deterministic Task Order job-description builder shared by
// TaskOrderWizard and the Project creation wizard so they never diverge.

export interface DescriptionPositionInput {
  position_label: string;
  headcount: number;
  advertised_pay_rate: number | null;
  show_pay_publicly: boolean;
}

export interface BuildDescriptionInput {
  title: string;
  locationAddress: string;
  startAt: string | null; // ISO or datetime-local
  approxDuration: string;
  daysPerWeek: string;
  hoursPerDay: string;
  scheduleNotes: string;
  perDiemAmount: string;
  perDiemNotes: string;
  lodgingStatus: string; // '' | 'provided' | 'stipend' | 'not_provided'
  lodgingNotes: string;
  mealsProvided: string; // '' | 'yes' | 'no'
  mealsNotes: string;
  mobDemobPaid: string; // '' | 'yes' | 'no'
  mobDemobNotes: string;
  positions: DescriptionPositionInput[];
}

export function buildTaskOrderDescription(i: BuildDescriptionInput): string {
  const parts: string[] = [];
  const loc = i.locationAddress.trim();
  parts.push(`${i.title.trim() || "Task Order"}${loc ? ` in ${loc}` : ""}.`);

  const sched: string[] = [];
  if (i.startAt) {
    try {
      const d = new Date(i.startAt);
      if (!isNaN(d.getTime())) {
        sched.push(
          `Starts ${d.toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}`
        );
      }
    } catch {
      /* ignore */
    }
  }
  if (i.approxDuration.trim()) sched.push(`runs approximately ${i.approxDuration.trim()}`);
  const dpw = i.daysPerWeek ? parseInt(i.daysPerWeek, 10) : null;
  const hpd = i.hoursPerDay ? parseFloat(i.hoursPerDay) : null;
  if (dpw) sched.push(`${dpw} day${dpw === 1 ? "" : "s"}/week`);
  if (hpd) sched.push(`${hpd} hrs/day`);
  if (sched.length) parts.push(sched.join(", ") + ".");
  if (i.scheduleNotes.trim()) parts.push(i.scheduleNotes.trim());

  const comp: string[] = [];
  const publicPositions = i.positions.filter(
    (p) => p.show_pay_publicly && p.advertised_pay_rate != null && p.position_label
  );
  if (publicPositions.length) {
    comp.push(
      "Positions: " +
        publicPositions
          .map(
            (p) =>
              `${p.position_label} ($${p.advertised_pay_rate}/hr${
                p.headcount > 1 ? `, x${p.headcount}` : ""
              })`
          )
          .join("; ")
    );
  }
  const perDiemNum = i.perDiemAmount ? parseFloat(i.perDiemAmount) : null;
  if (perDiemNum)
    comp.push(
      `Per diem $${perDiemNum}/day${i.perDiemNotes.trim() ? ` (${i.perDiemNotes.trim()})` : ""}`
    );
  if (i.lodgingStatus === "provided")
    comp.push(`Lodging provided${i.lodgingNotes.trim() ? ` (${i.lodgingNotes.trim()})` : ""}`);
  else if (i.lodgingStatus === "stipend")
    comp.push(`Lodging stipend${i.lodgingNotes.trim() ? ` (${i.lodgingNotes.trim()})` : ""}`);
  else if (i.lodgingStatus === "not_provided") comp.push("Lodging not provided");
  if (i.mealsProvided === "yes")
    comp.push(`Meals provided${i.mealsNotes.trim() ? ` (${i.mealsNotes.trim()})` : ""}`);
  else if (i.mealsProvided === "no") comp.push("Meals not provided");
  if (i.mobDemobPaid === "yes")
    comp.push(
      `Mob/demob time paid${i.mobDemobNotes.trim() ? ` (${i.mobDemobNotes.trim()})` : ""}`
    );
  else if (i.mobDemobPaid === "no") comp.push("Mob/demob time not paid");
  if (comp.length) parts.push(comp.join(". ") + ".");

  parts.push("Apply below — it takes about 2 minutes.");
  return parts.filter(Boolean).join("\n\n");
}
