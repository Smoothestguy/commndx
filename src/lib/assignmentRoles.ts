export type RolePeriod = { assignment_id: string; role_label: string | null; effective_from: string };

/** Role in force at `at` for one assignment: latest period starting at/before `at`, else the assignment's stored label. */
export function roleAt(periods: RolePeriod[], assignmentId: string, at: string, fallback: string | null): string | null {
  const t = Date.parse(at);
  let best: RolePeriod | undefined;
  for (const p of periods) {
    if (p.assignment_id !== assignmentId || Date.parse(p.effective_from) > t) continue;
    if (!best || Date.parse(p.effective_from) >= Date.parse(best.effective_from)) best = p;
  }
  return best ? best.role_label : fallback;
}

export type TodayStatus =
  | { kind: 'demobilized' }
  | { kind: 'checked_in'; at: string }
  | { kind: 'checked_out'; at: string }
  | { kind: 'mission'; note: string | null }
  | { kind: 'not_checked_in' };

/** One badge per person for today at this location, derived from attendance first; lifecycle only for demobilized. */
export function todayStatus(input: { demobilized: boolean; stays: { in_at: string; out_at: string | null }[]; missionToday: boolean; missionNote: string | null }): TodayStatus {
  if (input.demobilized) return { kind: 'demobilized' };
  const sorted = [...input.stays].sort((a, b) => a.in_at.localeCompare(b.in_at));
  const open = sorted.find(s => !s.out_at);
  if (open) return { kind: 'checked_in', at: open.in_at };
  const last = sorted[sorted.length - 1];
  if (last?.out_at) return { kind: 'checked_out', at: last.out_at };
  if (input.missionToday) return { kind: 'mission', note: input.missionNote };
  return { kind: 'not_checked_in' };
}

/** Parse strict 24h HH:mm. */
export const isHHmm = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
