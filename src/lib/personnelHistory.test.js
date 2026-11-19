import { test, expect } from 'bun:test';
import { emptyPersonnelHistory, personnelDeleteBlocked, personnelOnboardingStatus } from './personnelHistory.ts';

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