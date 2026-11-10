import { expect, test } from 'bun:test';
import { placementDatesValid } from './placementDates';
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