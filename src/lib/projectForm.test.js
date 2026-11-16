import { describe, it, expect } from 'bun:test';
import { normalizeProjectStage, projectWriteFields, entryCustomer } from './projectForm';
describe('project cleanup rules', () => {
  it('carries legacy quote into standby', () => expect(normalizeProjectStage('quote')).toBe('standby'));
  it('retains other stages', () => expect(['task_order','active','complete','canceled'].map(normalizeProjectStage)).toEqual(['task_order','active','complete','canceled']));
  it('omits customer writes without changing history', () => { const old={name:'Event',customer_id:'old',customer_po:'PO-1'}; expect(projectWriteFields(old)).toEqual({name:'Event'}); expect(old.customer_po).toBe('PO-1'); });
  it('prefers location customer for billing', () => expect(entryCustomer({location_id:'site',location:{customer_id:'location'},projects:{customer_id:'legacy'}}).id).toBe('location'));
  it('retains fallback for blank location customer', () => expect(entryCustomer({location_id:'site',location:{customer_id:null},projects:{customer_id:'legacy'}}).id).toBe('legacy'));
  it('does not guess an inaccessible location customer', () => expect(entryCustomer({location_id:'site',projects:{customer_id:'legacy'}}).id).toBeNull());
});
