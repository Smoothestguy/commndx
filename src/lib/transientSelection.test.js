import { describe, expect, test } from 'bun:test';
import { clearLegacySelection } from './transientSelection';

describe('obsolete selection cleanup', () => {
  test('removes Personnel selection mode and IDs while keeping filters', () => {
    const stored = new Map([['ss:personnel:selMode', 'true'], ['personnel:selMode', 'true'], ['ss:personnel:selected', '["one","two"]'], ['ss:personnel:search', 'Garcia'], ['ss:personnel:status', 'active']]);
    const storage = { removeItem: key => stored.delete(key) };
    clearLegacySelection(storage, 'personnel:selMode');
    clearLegacySelection(storage, 'personnel:selected');
    expect([...stored.entries()]).toEqual([['ss:personnel:search', 'Garcia'], ['ss:personnel:status', 'active']]);
  });
  test('removes Job Postings selection but retains posting filter', () => {
    const stored = new Map([['ss:applicant-pool:selection', '["one","two"]'], ['ss:applicant-pool:postingFilter', 'posting-one']]);
    clearLegacySelection({ removeItem: key => stored.delete(key) }, 'applicant-pool:selection');
    expect([...stored.entries()]).toEqual([['ss:applicant-pool:postingFilter', 'posting-one']]);
  });
  test('blocked storage never prevents a screen opening', () => {
    expect(() => clearLegacySelection({ removeItem: () => { throw new Error('blocked'); } }, 'personnel:selected')).not.toThrow();
  });
});