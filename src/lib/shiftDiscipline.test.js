import {it,expect} from 'bun:test';
import {extensionChoices,earlyApproval,earlyMinutes} from './shiftDiscipline';
import {preshiftAt,checkoutKind,rosterThresholds} from '../../supabase/functions/_shared/rosterRules';
const now=Date.parse('2026-11-05T12:00:00Z');
it('extension choices use fifteen-minute steps and stop at six hours',()=>{const choices=extensionChoices(now);expect(choices[0]).toBe('2026-11-05T12:15:00.000Z');expect(choices.at(-1)).toBe('2026-11-05T18:00:00.000Z');expect(choices).toHaveLength(24);});
it('extension choices also respect six hours beyond the shift end',()=>expect(extensionChoices(now,'2026-11-05T11:00Z').at(-1)).toBe('2026-11-05T17:00:00.000Z'));
it('early approval requires both markers while retaining reason',()=>{expect(earlyApproval('Prep work',null,null)).toBe('pending supervisor approval');expect(earlyApproval('Prep work','manager','2026-11-05T12:00Z')).toBe('approved');});
it('day preshift begins five minutes before shift and stops at start',()=>{expect(preshiftAt(now-6*60000,'America/Chicago','06:00','18:00')).toBeNull();expect(preshiftAt(now-5*60000,'America/Chicago','06:00','18:00')?.time).toBe('06:00');expect(preshiftAt(now,'America/Chicago','06:00','18:00')).toBeNull();});
it('night preshift runs five minutes before night start',()=>expect(preshiftAt(Date.parse('2026-11-05T23:55Z'),'America/Chicago','06:00','18:00')?.time).toBe('18:00'));
it('midnight shift preshift belongs to next local date',()=>expect(preshiftAt(Date.parse('2026-11-06T05:55Z'),'America/Chicago','06:00','00:00')?.day).toBe('2026-11-06'));
it('approved future extension defers checkout until exact until_at',()=>{const ext={status:'approved',until_at:'2026-11-05T13:00Z'};expect(checkoutKind(now,true,ext)).toBeNull();expect(checkoutKind(Date.parse(ext.until_at),false,ext)).toBe('checkout-ext');});
it('pending or denied extensions never suppress regular checkout nags',()=>{expect(checkoutKind(now,true,{status:'denied',until_at:'2026-11-05T13:00Z'})).toBe('checkout');expect(checkoutKind(now,true,{status:'pending',until_at:'2026-11-05T13:00Z'})).toBe('checkout');});
it('after-midnight night stay ends at same-day day start',()=>expect(rosterThresholds(Date.parse('2026-11-05T12:30Z'),'America/Chicago','06:00','18:00','2026-11-05T07:00Z').checkout).toBe(true));
it('early review computes twenty-five minutes in the location timezone',()=>expect(earlyMinutes('2026-11-05T11:35Z','America/Chicago','06:00','18:00')).toBe(25));
it('0730 shift reminder starts at 0725 not 0715',()=>{expect(preshiftAt(Date.parse('2026-11-06T13:15Z'),'America/Chicago','07:30','19:30')).toBeNull();expect(preshiftAt(Date.parse('2026-11-06T13:24:59Z'),'America/Chicago','07:30','19:30')).toBeNull();expect(preshiftAt(Date.parse('2026-11-06T13:25Z'),'America/Chicago','07:30','19:30')?.time).toBe('07:30');});

it('project-specific twelve minute lead starts at 0718 for 0730',()=>{expect(preshiftAt(Date.parse('2026-11-06T13:17:59Z'),'America/Chicago','07:30','19:30',12)).toBeNull();expect(preshiftAt(Date.parse('2026-11-06T13:18Z'),'America/Chicago','07:30','19:30',12)?.time).toBe('07:30');expect(preshiftAt(Date.parse('2026-11-06T13:30Z'),'America/Chicago','07:30','19:30',12)).toBeNull();});
it('project-specific night reminder lead retains the target day',()=>expect(preshiftAt(Date.parse('2026-11-06T05:48Z'),'America/Chicago','07:30','00:00',12)?.day).toBe('2026-11-06'));
it('zero reminder lead does not send before shift',()=>expect(preshiftAt(Date.parse('2026-11-06T13:29Z'),'America/Chicago','07:30','19:30',0)).toBeNull());
