// Pure helpers for the project Locations command center (no dollar figures).
export type RoleGap = { role: string; authorized: number; actual: number; over: number; under: number };
export type Severity = 'red' | 'amber' | 'ok';

/** Per-role staffed vs authorized. Prefers accepted task-order levels, falls back to requirements. */
export function roleGaps(
  levels: { line_kind: string; label: string; authorized: number }[] | null | undefined,
  byRole: Record<string, { needed: number; assigned: number }>,
): RoleGap[] {
  const target = new Map<string, number>();
  if (levels && levels.some(l => l.line_kind === 'position')) {
    for (const l of levels) if (l.line_kind === 'position') target.set(l.label, (target.get(l.label) ?? 0) + Number(l.authorized));
  } else {
    for (const [role, v] of Object.entries(byRole)) if (v.needed > 0) target.set(role, v.needed);
  }
  const roles = new Set([...target.keys(), ...Object.entries(byRole).filter(([, v]) => v.assigned > 0).map(([r]) => r)]);
  return [...roles].map(role => {
    const authorized = target.get(role) ?? 0, actual = byRole[role]?.assigned ?? 0;
    return { role, authorized, actual, over: Math.max(0, actual - authorized), under: Math.max(0, authorized - actual) };
  }).filter(g => g.authorized > 0 || g.actual > 0).sort((a, b) => a.role.localeCompare(b.role));
}

/** Worst role: any over → red OVER, else any under → amber UNDER. */
export function worstRole(gaps: RoleGap[]): { severity: Severity; label: string | null } {
  const over = gaps.filter(g => g.over > 0).sort((a, b) => b.over - a.over)[0];
  if (over) return { severity: 'red', label: `${over.role} +${over.over} OVER` };
  const under = gaps.filter(g => g.under > 0).sort((a, b) => b.under - a.under)[0];
  if (under) return { severity: 'amber', label: `${under.role} −${under.under} UNDER` };
  return { severity: 'ok', label: null };
}

export type AttentionInput = {
  staffSeverity: Severity; assetUnder: number; assetOver: number; late: number;
  joinPending: number; openPunches: number; pendingTOs: number; extPending: number; openRequests: number;
};
export function attention(r: AttentionInput): Severity {
  if (r.staffSeverity === 'red' || r.assetOver > 0) return 'red';
  if (r.staffSeverity === 'amber' || r.assetUnder > 0 || r.late > 0 || r.joinPending > 0 || r.pendingTOs > 0 || r.extPending > 0 || r.openRequests > 0) return 'amber';
  return 'ok';
}

const rank: Record<Severity, number> = { red: 0, amber: 1, ok: 2 };
/** Needing attention first (red, then amber), then alphabetical. */
export function sortByAttention<T extends { name: string; severity: Severity }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => rank[a.severity] - rank[b.severity] || a.name.localeCompare(b.name, undefined, { numeric: true }));
}
