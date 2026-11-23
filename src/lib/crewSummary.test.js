import { describe, it, expect } from 'vitest';
import { crewSummary } from './crewSummary';
describe('crewSummary', () => {
  it('formats the owner example', () => {
    const rows = [...Array(4)].map((_, i) => ({ present: i < 2, role: 'Resource Supervisor', onRoster: true })).concat([...Array(16)].map((_, i) => ({ present: i < 7, role: 'Resource Technician', onRoster: true })));
    expect(crewSummary('2026-11-23', rows)).toBe('Mon 11/23 · 9 in / 20 · 4 Sup / 16 Tech');
  });
  it('off-roster workers count as in but not in roster size', () => {
    expect(crewSummary('2026-11-23', [{ present: true, role: null, onRoster: false }, { present: false, role: 'Resource Technician', onRoster: true }])).toBe('Mon 11/23 · 1 in / 1 · 1 Tech');
  });
});
import { headcountLine, presenceOnlyCount } from './crewSummary';
describe('headcountLine', () => {
  it('counts presence signers only when they have no timed entry', () => {
    expect(presenceOnlyCount(['a', 'b'], ['b', 'c', 'd'])).toBe(2);
  });
  it('shows expected when a sheet row exists', () => {
    expect(headcountLine(7, 40, 62)).toBe('7 timed + 40 presence-signed = 47 of 62 expected (sheet)');
  });
  it('omits expected without a row', () => {
    expect(headcountLine(7, 0, null)).toBe('7 timed + 0 presence-signed = 7');
  });
});
