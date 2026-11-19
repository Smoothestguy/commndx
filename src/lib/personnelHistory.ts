import { protectedPersonnelTables } from './personnelCascadeCoverage';
export interface PersonnelHistory {
  related: Record<keyof typeof protectedPersonnelTables, number>;
  timeEntries: number;
  lastWorked: string | null;
  attendance: number;
  documents: number;
  w9Forms: number;
  payments: number;
  projectAssignments: number;
  locationAssignments: number;
  activeProjects: number;
  activeLocations: number;
  onboarding: 'Onboarded ✓' | 'Pending' | 'Not sent' | 'Revoked';
}

export function emptyPersonnelHistory(): PersonnelHistory {
  return { related: Object.fromEntries(Object.keys(protectedPersonnelTables).map(t => [t,0])) as PersonnelHistory['related'], timeEntries: 0, lastWorked: null, attendance: 0, documents: 0, w9Forms: 0, payments: 0, projectAssignments: 0, locationAssignments: 0, activeProjects: 0, activeLocations: 0, onboarding: 'Not sent' };
}

export function personnelDeleteBlocked(h: PersonnelHistory): boolean {
  // Assignments also prevent the "no assignments" confirmation from being misleading.
  return [h.timeEntries, h.attendance, h.documents, h.w9Forms, h.payments, h.projectAssignments, h.locationAssignments, ...Object.values(h.related)].some(n => n > 0);
}

export function personnelHistorySummary(h: PersonnelHistory): string {
  const related = (Object.keys(protectedPersonnelTables) as (keyof typeof protectedPersonnelTables)[]).filter(t => h.related[t] > 0).map(t => `${h.related[t]} ${protectedPersonnelTables[t]}`);
  return `${h.timeEntries} time entries (last worked ${h.lastWorked ?? '—'}); ${h.attendance} location attendance; ${h.documents} documents; ${h.w9Forms} W-9 forms; ${h.payments} payments; ${h.projectAssignments} project / ${h.locationAssignments} site assignments; onboarding: ${h.onboarding}${related.length ? '; ' + related.join('; ') : ''}`;
}

export function personnelOnboardingStatus(status: string | null, completedAt: string | null, tokens: { used_at: string | null; revoked_at: string | null; created_at: string }[]): PersonnelHistory['onboarding'] {
  if (completedAt || status === 'completed') return 'Onboarded ✓';
  const latest = [...tokens].sort((a,b) => b.created_at.localeCompare(a.created_at))[0];
  if (status === 'revoked' || latest?.revoked_at) return 'Revoked';
  if (latest?.used_at) return 'Onboarded ✓';
  return latest ? 'Pending' : 'Not sent';
}