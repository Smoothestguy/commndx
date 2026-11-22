import { expect, it } from 'bun:test';
import { personnelMatches, personnelSearchGroups } from './personnelSearch';
const angie = { first_name: 'Angie', last_name: 'Aponte', email: 'a@x.com', personnel_number: 'P-2600179', phone: '9805012303' };
for (const q of ['angie aponte', 'aponte angie', 'Aponte', 'apon', 'P-2600179', '2600179', '(980) 501-2303', '9805012303', '  Angie   Aponte '])
  it(`finds Angie Aponte by "${q}"`, () => expect(personnelMatches(angie, q)).toBe(true));
it('wrong second word does not match', () => expect(personnelMatches(angie, 'angie smith')).toBe(false));
it('one or() group per word', () => expect(personnelSearchGroups('angie aponte').length).toBe(2));
it('phone formatting becomes one digits group', () => expect(personnelSearchGroups('(980) 501-2303')).toEqual(['phone.ilike."%9805012303%",personnel_number.ilike."%9805012303%"']));
it('commas and parentheses never reach the filter', () => { for (const g of personnelSearchGroups('smith, (jr) 100%*')) expect(/[()%*]/.test(g.replace(/ilike\."%|%"/g, ''))).toBe(false); });
