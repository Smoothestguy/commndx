import { expect, it } from 'bun:test';
import { manualTimeRange, displayClock, locationTimeIso, isClockOut } from './manualTime';
import { draftStay, stayRange } from './stayEdits';
import { validMilitaryOut, validMilitary, clockOutValue } from './militaryTime';
import { isHHmm, isHHmmOut } from './assignmentRoles';
const NY = 'America/New_York';
it('0000–2400 is a full 24.00h day', () => {
  const r = manualTimeRange('2026-11-20', '00:00', '24:00', NY);
  expect(r?.hours).toBe(24);
  expect(r?.outAt).toBe(locationTimeIso('2026-11-21', '00:00', NY));
});
it('2000–2400 is 4.00h and ends at next-day local midnight', () => {
  const r = manualTimeRange('2026-11-20', '20:00', '24:00', NY);
  expect(r?.hours).toBe(4);
  expect(r?.outAt).toBe('2026-11-21T05:00:00.000Z');
});
it('0000 as time out after a later in means end of that day', () => {
  expect(manualTimeRange('2026-11-20', '20:00', '00:00', NY)?.hours).toBe(4);
});
it('2400 is rejected as a time in', () => {
  expect(manualTimeRange('2026-11-20', '24:00', '24:00', NY)).toBeNull();
  expect(stayRange({ id: 'x', inDate: '2026-11-20', inTime: '24:00', outDate: '2026-11-20', outTime: '24:00', removed: false }, NY)).toBeNull();
  expect(isHHmm('24:00')).toBe(false);
  expect(validMilitary('2400')).toBe(false);
});
it('0000 is always valid as a time in', () => {
  expect(isHHmm('00:00')).toBe(true);
  expect(manualTimeRange('2026-11-20', '00:00', '08:00', NY)?.hours).toBe(8);
});
it('2400 accepted as a time out by every validator; 2401 is not', () => {
  expect(isClockOut('24:00')).toBe(true);
  expect(isHHmmOut('24:00')).toBe(true);
  expect(validMilitaryOut('2400')).toBe(true);
  expect(clockOutValue('2400')).toBe('24:00');
  expect(validMilitaryOut('2401')).toBe(false);
});
it('a stay ending at next-day midnight displays as 2400, in grids and dialogs', () => {
  const inAt = locationTimeIso('2026-11-20', '20:00', NY), outAt = locationTimeIso('2026-11-21', '00:00', NY);
  expect(displayClock(outAt, NY, inAt)).toBe('24:00');
  expect(displayClock(inAt, NY, inAt)).toBe('20:00');
  const d = draftStay('s', inAt, outAt, NY);
  expect(d).toMatchObject({ inDate: '2026-11-20', inTime: '20:00', outDate: '2026-11-20', outTime: '24:00' });
  expect(stayRange(d, NY)).toEqual({ inAt, outAt });
});
