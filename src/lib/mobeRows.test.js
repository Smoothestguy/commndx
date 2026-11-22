import { expect, it } from 'bun:test';
import { mobeOrigin, travelLabel, dayHeadcount } from './mobeRows';
it('origin from travel description', () => expect(mobeOrigin('MOBE travel from Fort Myers — EM-5052 (TO 26-0033)', 4)).toBe('Fort Myers'));
it('local description is Local', () => expect(mobeOrigin('MOBE — local (Heberto Rincon), no travel hours — EM-5052', 0)).toBe('Local'));
it('zero travel shows Local', () => expect(travelLabel(0)).toBe('Local'));
it('5052 11/16: 12 worked + 13 MOBE = 25', () => expect(dayHeadcount(12, 13)).toBe(25));
