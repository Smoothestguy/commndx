import { expect, it } from 'bun:test';
import { attendanceSaveMode, locationRosterPeople, manualTimeRange } from './manualTime';

it('uses location-local 24-hour time and computes hours, independent of browser timezone', () => {
  expect(manualTimeRange('2026-11-06', '07:30', '16:00', 'America/Chicago')).toEqual({ inAt: '2026-11-06T13:30:00.000Z', outAt: '2026-11-06T22:00:00.000Z', hours: 8.5 });
  expect(manualTimeRange('2026-11-06', '07:30', '16:00', 'America/New_York')?.inAt).toBe('2026-11-06T12:30:00.000Z');
});
it('rejects partial, reversed, equal and nonexistent local times', () => {
  expect(manualTimeRange('2026-11-06', '07:30', '', 'America/Chicago')).toBeNull();
  expect(manualTimeRange('2026-11-06', '16:00', '07:30', 'America/Chicago')).toBeNull();
  expect(manualTimeRange('2026-11-06', '07:30', '07:30', 'America/Chicago')).toBeNull();
  expect(manualTimeRange('2026-03-08', '02:30', '04:00', 'America/Chicago')).toBeNull();
});
it('replaces hours saves with manual visits only for managers with both times', () => {
  expect(attendanceSaveMode(true, '07:30', '16:00')).toBe('manual');
  expect(attendanceSaveMode(true, '', '')).toBe('hours');
  expect(attendanceSaveMode(true, '07:30', '')).toBe('incomplete');
});
it('field staff retain status/hours saves even when time values are supplied', () => {
  expect(attendanceSaveMode(false, '07:30', '16:00')).toBe('hours');
});
it('location-locked picker contains only that locations active roster', () => {
  const people = [{ personnel_id: 'here' }, { personnel_id: 'other-location' }];
  expect(locationRosterPeople(people, 'site', [{ personnel_id: 'here' }])).toEqual([{ personnel_id: 'here' }]);
  expect(locationRosterPeople(people, 'site', [])).toEqual([]);
  expect(locationRosterPeople(people)).toEqual(people);
});