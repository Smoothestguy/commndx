import {it,expect} from 'bun:test';
import {reportedCheckoutChoices} from './shiftDiscipline';
it('checkout corrections do not turn a future permission into worked hours',()=>{
 expect(reportedCheckoutChoices(Date.parse('2026-11-13T23:14Z'),'2026-11-13T23:00Z')).toEqual([]);
});
it('after-midnight correction choices retain the original shift end',()=>{
 const choices=reportedCheckoutChoices(Date.parse('2026-11-14T06:17Z'),'2026-11-14T05:30Z');
 expect(choices[0]).toBe('2026-11-14T05:45:00.000Z');
 expect(choices.at(-1)).toBe('2026-11-14T06:15:00.000Z');
});