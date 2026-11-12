import { expect, test } from 'bun:test';
import { placementDatesValid, placementDateTimestamp } from './placementDates';
test('unchanged start retains its exact original time', () => {
  expect(placementDateTimestamp('2026-11-03', '2026-11-03T14:00:00+00:00', '08:00', 'America/New_York')).toBe('2026-11-03T14:00:00+00:00');
});
test('start-only edit retains the ended placement timestamp including milliseconds', () => {
  expect(placementDateTimestamp('2026-11-05', '2026-11-05T20:25:08.045+00:00', '17:00', 'America/New_York')).toBe('2026-11-05T20:25:08.045+00:00');
});
test('legacy ended date preserves its unassignment timestamp instead of snapping to 1700', () => {
  expect(placementDateTimestamp('2026-11-03', '2026-11-03T22:16:15.734+00:00', '17:00', 'America/New_York')).toBe('2026-11-03T22:16:15.734+00:00');
});
test('changed end uses the new local date while an open end stays null', () => {
  expect(placementDateTimestamp('2026-11-06', '2026-11-05T20:25:08.045+00:00', '17:00', 'America/New_York')).toBe('2026-11-06T22:00:00.000Z');
  expect(placementDateTimestamp('', null, '17:00', 'America/New_York')).toBeNull();
});
test('ended truck placement can correct end date from November 4 to November 5', () => {
  expect(placementDatesValid('2026-11-01', '2026-11-05', true)).toBe(true);
});
test('ended placement cannot lose its end date', () => {
  expect(placementDatesValid('2026-11-01', '', true)).toBe(false);
});
test('departure before arrival is rejected', () => {
  expect(placementDatesValid('2026-11-06', '2026-11-05', false)).toBe(false);
});
test('current placement may retain an open end date', () => {
  expect(placementDatesValid('2026-11-01', '', false)).toBe(true);
});
test('manager can change both start and end on the open truck placement', () => {
  expect(placementDatesValid('2026-11-04', '2026-11-11', false)).toBe(true);
});
test('manager can change both start and end on the ended truck placement', () => {
  expect(placementDatesValid('2026-11-02', '2026-11-06', true)).toBe(true);
});