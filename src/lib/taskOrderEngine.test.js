import {it,expect} from 'bun:test';
import {allowanceDays,capMobilization,deltaResult,toBill,activeLocationRecipient} from './taskOrderEngine';
it('housing and per diem bill once per person per day worked',()=>expect(allowanceDays([{person:'a',day:'2026-11-13',worked:true,nonBillable:false},{person:'a',day:'2026-11-13',worked:true,nonBillable:false},{person:'a',day:'2026-11-14',worked:false,nonBillable:false}])).toBe(1));
it('non-billable personnel never contribute monetary charges',()=>expect(toBill(12,50,true)).toBe(0));
it('unconfigured rates never fabricate amounts',()=>expect(toBill(12,null)).toBeNull());
it('mobe dollar cap limits mobilization billing per TO',()=>expect(capMobilization(1200,900)).toBe(900));
it('delta shows new authorization and refuses negative totals',()=>{expect(deltaResult(7,-3)).toBe(4);expect(()=>deltaResult(3,-4)).toThrow();});
it('check-in texts are exact active location roster only',()=>{const a={location_id:'5049',status:'active',assigned_at:'2026-11-01T00:00Z',unassigned_at:null};expect(activeLocationRecipient(a,'5048',Date.parse('2026-11-13T00:00Z'))).toBe(false);expect(activeLocationRecipient(a,'5049',Date.parse('2026-11-13T00:00Z'))).toBe(true);expect(activeLocationRecipient({...a,unassigned_at:'2026-11-12T00:00Z'},'5049',Date.parse('2026-11-13T00:00Z'))).toBe(false);});