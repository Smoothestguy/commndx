import { describe, it, expect } from 'vitest';
import { roleAt, todayStatus, isHHmm } from './assignmentRoles';

const periods = [
  { assignment_id: 'a', role_label: 'Operator', effective_from: '1970-01-01T00:00:00Z' },
  { assignment_id: 'a', role_label: 'Supervisor', effective_from: '2026-11-06T12:00:00Z' },
];

describe('dated role history', () => {
  it('prior days keep the old role', () => expect(roleAt(periods, 'a', '2026-11-05T15:00:00Z', null)).toBe('Operator'));
  it('records from the effective time use the new role', () => expect(roleAt(periods, 'a', '2026-11-06T12:00:00Z', null)).toBe('Supervisor'));
  it('falls back to the stored label without history', () => expect(roleAt(periods, 'b', '2026-11-06T12:00:00Z', 'Operator')).toBe('Operator'));
});

describe('today status', () => {
  it('demobilized wins over attendance', () => expect(todayStatus({ demobilized: true, stays: [{ in_at: 'x', out_at: null }], missionToday: false, missionNote: null }).kind).toBe('demobilized'));
  it('open stay is checked in', () => expect(todayStatus({ demobilized: false, stays: [{ in_at: '2026-11-06T12:00:00Z', out_at: null }], missionToday: true, missionNote: 'x' }).kind).toBe('checked_in'));
  it('mission only when no attendance today', () => expect(todayStatus({ demobilized: false, stays: [], missionToday: true, missionNote: 'Depot' })).toEqual({ kind: 'mission', note: 'Depot' }));
  it('defaults to not checked in', () => expect(todayStatus({ demobilized: false, stays: [], missionToday: false, missionNote: null }).kind).toBe('not_checked_in'));
});

describe('24h input', () => {
  it('accepts 19:30 and rejects 7:30 PM', () => { expect(isHHmm('19:30')).toBe(true); expect(isHHmm('7:30 PM')).toBe(false); });
});
