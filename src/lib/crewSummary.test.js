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
