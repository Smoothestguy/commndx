import { describe, it, expect } from 'bun:test';
import { ownershipText, validAssetCost, assetCareLabel } from './assetDetails';
describe('asset ownership and care rules', () => {
  it('legacy assets default to owned', () => expect(ownershipText({})).toBe('Owned'));
  it('rented assets retain their rental vendor', () => expect(ownershipText({ ownership: 'rented', vendor_name: 'ABC Supply' })).toBe('Rented · ABC Supply'));
  it('cost rejects negative and nonnumeric values', () => { expect(validAssetCost('-1')).toBe(false); expect(validAssetCost('abc')).toBe(false); expect(validAssetCost('125.50')).toBe(true); expect(validAssetCost('')).toBe(true); });
  it('asset care identifies the responsible operator', () => expect(assetCareLabel('2024 Ram 2500', { first_name: 'Jorge', last_name: 'Hernandez' })).toBe('2024 Ram 2500 — Jorge Hernandez'));
});