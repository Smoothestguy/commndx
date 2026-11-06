import { it,expect } from 'bun:test';
import { constructionModules, moduleVisible, parseModuleFlags } from './appModules';
for(const m of constructionModules)it(`${m.label} defaults hidden and can be restored without deleting it`,()=>{for(const p of m.paths){expect(moduleVisible(p)).toBe(false);expect(moduleVisible(p+'/example',{[m.key]:true})).toBe(true);}});
it('retains response accounting and operational modules',()=>{for(const p of ['/invoices','/financials','/settings/quickbooks','/vendors','/customers','/projects','/staffing/applications','/time-tracking'])expect(moduleVisible(p)).toBe(true);});
it('does not accept truthy nonboolean values',()=>expect(parseModuleFlags({estimates:'true',job_orders:true})).toMatchObject({estimates:false,job_orders:true}));