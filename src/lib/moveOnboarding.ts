export type OnboardingChoice = 'source' | 'target';
export interface MoveField {
  field: string; source: string | number | boolean | null; target: string | number | boolean | null;
  action: 'fill' | 'conflict' | 'keep'; mode: 'profile' | 'contact' | 'employment'; note?: string | null;
}
export interface MoveIdentity {
  id: string; personnel_number: string; name: string; phone: string | null; ssn_last4: string | null; bank_last4: string | null;
}
export interface MoveOnboardingPreview {
  eligible: boolean; reasons: string[]; fields: MoveField[];
  counts: Record<string, { source: number; move: number; skip: number }>;
  source: MoveIdentity; target: MoveIdentity;
  target_untouched: Record<string, number>; portal_login_action: 'move' | 'keep';
}
export function moveDefaultChoices(fields: MoveField[]): Record<string, OnboardingChoice> {
  return Object.fromEntries(fields.filter(f => f.action === 'conflict' || f.mode === 'contact')
    .map(f => [f.field, f.mode === 'contact' ? 'target' : 'source']));
}
export function moveFieldLabel(field: string): string {
  const labels: Record<string, string> = { ssn_full: 'SSN', ssn_last_four: 'SSN last four', itin: 'ITIN', date_of_birth: 'Date of birth', photo_url: 'Photo', i9_completed_at: 'I-9 completed', id_document_url: 'ID document' };
  return labels[field] ?? field.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
}