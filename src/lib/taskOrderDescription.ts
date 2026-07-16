// Deterministic Task Order job-description builder shared by
// TaskOrderWizard and the Project creation wizard so they never diverge.
//
// Structure (positives-first):
//   Line 1 (hook):     "{positions} needed — {city}. ${rate}/hr. Starts {{start_date}}."
//   Line 2 (the work): "Fairfield Response Group is hiring {N} {label(s)} for {work_summary}."
//   Line 3 (schedule): "{duration}, {days}/week, {hrs} hrs/day." + scheduleNotes
//   Line 4 (perks):    positives only — per diem, lodging provided/stipend,
//                      meals provided, mob/demob paid, plus always "Weekly pay."
//                      When lodging is explicitly not_provided we may emit the
//                      single neutral phrase "Local candidates preferred." — never
//                      "not provided"/"not paid" sentences.
//   Closing:           "Apply below — it takes about 2 minutes."

export interface DescriptionPositionInput {
  position_label: string;
  headcount: number;
  advertised_pay_rate: number | null;
  show_pay_publicly: boolean;
}

export interface BuildDescriptionInput {
  title: string;
  workSummary: string;
  locationAddress: string;
  city?: string;
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

function uniqueLabels(positions: DescriptionPositionInput[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of positions) {
    const label = (p.position_label || "").trim();
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    out.push(label);
  }
  return out;
}

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} & ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} & ${items[items.length - 1]}`;
}

function payPhrase(positions: DescriptionPositionInput[]): string {
  const rates = positions
    .filter((p) => p.show_pay_publicly && p.advertised_pay_rate != null)
    .map((p) => Number(p.advertised_pay_rate));
  if (rates.length === 0) return "";
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  if (min === max) return `$${min}/hr`;
  return `$${min}–$${max}/hr`;
}

export function buildTaskOrderDescription(i: BuildDescriptionInput): string {
  const parts: string[] = [];
  const labels = uniqueLabels(i.positions);
  const labelPhrase = labels.length ? joinList(labels) : "Crew";
  const city = (i.city || "").trim();
  const loc = i.locationAddress.trim();

  // ---- Line 1: hook ----
  const hookBits: string[] = [];
  const locPart = city ? city : loc ? "{{location}}" : "";
  hookBits.push(`${labelPhrase} needed${locPart ? ` — ${locPart}` : ""}.`);
  const pay = payPhrase(i.positions);
  if (pay) hookBits.push(`${pay}.`);
  if (i.startAt) hookBits.push(`Starts {{start_date}}.`);
  parts.push(hookBits.join(" "));

  // ---- Line 2: the work ----
  const totalHeadcount = i.positions.reduce(
    (s, p) => s + (Number(p.headcount) || 0),
    0
  );
  const summary = (i.workSummary || "").trim() || (i.title || "").trim();
  if (summary) {
    const roleWord = labels.length === 1 ? labels[0] : labelPhrase.toLowerCase();
    const countPart = totalHeadcount > 0 ? `${totalHeadcount} ` : "";
    parts.push(
      `Fairfield Response Group is hiring ${countPart}${roleWord} for ${summary.replace(/\.$/, "")}.`
    );
  }

  // ---- Line 3: schedule ----
  const sched: string[] = [];
  if (i.approxDuration.trim()) sched.push(i.approxDuration.trim());
  const dpw = i.daysPerWeek ? parseInt(i.daysPerWeek, 10) : null;
  const hpd = i.hoursPerDay ? parseFloat(i.hoursPerDay) : null;
  if (dpw) sched.push(`${dpw} day${dpw === 1 ? "" : "s"}/week`);
  if (hpd) sched.push(`${hpd} hrs/day`);
  const scheduleLine: string[] = [];
  if (sched.length) scheduleLine.push(sched.join(", ") + ".");
  if (i.scheduleNotes.trim()) scheduleLine.push(i.scheduleNotes.trim());
  if (scheduleLine.length) parts.push(scheduleLine.join(" "));

  // ---- Line 4: perks (positives only) ----
  const perks: string[] = [];
  const perDiemNum = i.perDiemAmount ? parseFloat(i.perDiemAmount) : null;
  if (perDiemNum) {
    perks.push(
      `Per diem $${perDiemNum}/day${
        i.perDiemNotes.trim() ? ` (${i.perDiemNotes.trim()})` : ""
      }`
    );
  }
  if (i.lodgingStatus === "provided") {
    perks.push(
      `Lodging provided${i.lodgingNotes.trim() ? ` (${i.lodgingNotes.trim()})` : ""}`
    );
  } else if (i.lodgingStatus === "stipend") {
    perks.push(
      `Lodging stipend${i.lodgingNotes.trim() ? ` (${i.lodgingNotes.trim()})` : ""}`
    );
  }
  if (i.mealsProvided === "yes") {
    perks.push(
      `Meals provided${i.mealsNotes.trim() ? ` (${i.mealsNotes.trim()})` : ""}`
    );
  }
  if (i.mobDemobPaid === "yes") {
    perks.push(
      `Mob/demob time paid${
        i.mobDemobNotes.trim() ? ` (${i.mobDemobNotes.trim()})` : ""
      }`
    );
  }
  perks.push("Weekly pay");
  parts.push(perks.join(". ") + ".");

  // Neutral note when lodging is explicitly not provided (never say "not provided").
  if (i.lodgingStatus === "not_provided") {
    parts.push("Local candidates preferred.");
  }

  parts.push("Apply below — it takes about 2 minutes.");
  return parts.filter(Boolean).join("\n\n");
}
