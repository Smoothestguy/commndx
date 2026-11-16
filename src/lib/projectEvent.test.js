import { describe, it, expect } from 'bun:test';
import { eventCustomers, locationCustomer, locationStatusCounts } from './projectEvent';
describe('event customer rules',()=>{
  it('derives distinct customers and per-customer location counts',()=>expect(eventCustomers([{project_id:'event',customer_id:'patriot',status:'active'},{project_id:'event',customer_id:'patriot',status:'active'},{project_id:'event',customer_id:'other',status:'closed'}],'legacy')).toEqual([{id:'patriot',count:2},{id:'other',count:1}]));
  it('retains legacy customer for locations lacking a customer',()=>expect(eventCustomers([{project_id:'event',status:'active'}],'patriot')).toEqual([{id:'patriot',count:1}]));
  it('does not show legacy customer without a location',()=>expect(eventCustomers([],'patriot')).toEqual([]));
  it('prefers location customer over project default for documents',()=>expect(locationCustomer({customer_id:'patriot'},'other')).toBe('patriot'));
  it('counts all four Florida status categories without hiding closed history',()=>expect(locationStatusCounts([{status:'active'},{status:'active'},{status:'complete'},{status:'closed'}])).toEqual({active:2,complete:1,closed:1}));
});import { customerProjectMap } from './projectEvent';
describe('customerProjectMap', () => {
  it('derives customers from locations with legacy fallback only when unset', () => {
    const m = customerProjectMap([{project_id:'p1',customer_id:'c1'},{project_id:'p1',customer_id:null},{project_id:'p2',customer_id:'c2'}],[{id:'p1',customer_id:'old'},{id:'p2',customer_id:'old'}]);
    expect([...m.get('c1')]).toEqual(['p1']); expect([...m.get('old')]).toEqual(['p1']); expect([...m.get('c2')]).toEqual(['p2']);
  });
});
