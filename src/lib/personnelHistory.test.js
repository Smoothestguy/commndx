import { test, expect } from 'bun:test';
import { emptyPersonnelHistory, personnelDeleteBlocked, personnelOnboardingStatus } from './personnelHistory.ts';
import { protectedPersonnelTables, baselinePersonnelCascades, disposablePersonnelCascades } from './personnelCascadeCoverage.ts';
import { applicantDeleteOutcome } from './applicantDeleteOutcome.ts';

test('clean person is eligible for the existing delete path', () => { expect(personnelDeleteBlocked(emptyPersonnelHistory())).toBe(false); });
for (const field of ['timeEntries','attendance','documents','w9Forms','payments']) {
  test(`one ${field} blocks deletion`, () => { expect(personnelDeleteBlocked({...emptyPersonnelHistory(), [field]:1})).toBe(true); });
}
test('assignment-only person cannot be described as having no assignments', () => { expect(personnelDeleteBlocked({...emptyPersonnelHistory(),projectAssignments:1})).toBe(true); expect(personnelDeleteBlocked({...emptyPersonnelHistory(),locationAssignments:1})).toBe(true); });
test('mixed bulk selection permits only the clean record', () => { const people=[{id:'clean',h:emptyPersonnelHistory()},{id:'protected',h:{...emptyPersonnelHistory(),timeEntries:1,documents:1}}]; expect(people.filter(p=>!personnelDeleteBlocked(p.h)).map(p=>p.id)).toEqual(['clean']); });
test('onboarding state distinguishes completion, pending, not sent and revocation', () => {
  expect(personnelOnboardingStatus(null,null,[])).toBe('Not sent');
  expect(personnelOnboardingStatus('pending',null,[])).toBe('Not sent');
  expect(personnelOnboardingStatus(null,null,[{created_at:'2026-11-19',used_at:null,revoked_at:null}])).toBe('Pending');
  expect(personnelOnboardingStatus('revoked',null,[])).toBe('Revoked');
  expect(personnelOnboardingStatus('completed','2026-11-19',[])).toBe('Onboarded ✓');
});
for (const table of Object.keys(protectedPersonnelTables)) test(`one ${table} blocks delete`, () => {
  const h=emptyPersonnelHistory();h.related[table]=1;expect(personnelDeleteBlocked(h)).toBe(true);
});
test('all live cascading FKs are classified, with no protected table excluded', () => {
  const live=['clock_alerts','crew_members','document_signatures','emergency_contacts','location_assignments','location_attendance','onboarding_email_deliveries','personnel_assignment_ratings','personnel_badges','personnel_capabilities','personnel_certifications','personnel_documents','personnel_engagement_notes','personnel_expenses','personnel_hotel_assignments','personnel_invitations','personnel_languages','personnel_notification_preferences','personnel_notifications','personnel_onboarding_tokens','personnel_project_assignments','personnel_schedules','personnel_status_log','personnel_w9_forms','project_labor_expenses','project_personnel_rate_history','reimbursements','shift_extensions','site_checkin_tokens','timesheet_signature_requests','variance_resolutions','visit_personnel'];
  expect([...Object.keys(protectedPersonnelTables),...baselinePersonnelCascades,...disposablePersonnelCascades].sort()).toEqual(live.sort());
});
test('applicant continues only when every linked person was deleted',()=>{
 expect(applicantDeleteOutcome(['a','b'],['a'],[])).toBe('pending');
 expect(applicantDeleteOutcome(['a','b'],['a','b'],[])).toBe('delete');
 expect(applicantDeleteOutcome(['a','b'],['a'],['Worker B'])).toBe('kept');
});