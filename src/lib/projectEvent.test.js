import { describe, it, expect } from 'bun:test';
import { eventCustomers, locationCustomer, locationStatusCounts } from './projectEvent';
describe('event customer rules',()=>{
  it('derives distinct customers and per-customer location counts',()=>expect(eventCustomers([{project_id:'event',customer_id:'patriot',status:'active'},{project_id:'event',customer_id:'patriot',status:'active'},{project_id:'event',customer_id:'other',status:'closed'}],'legacy')).toEqual([{id:'patriot',count:2},{id:'other',count:1}]));
  it('retains legacy customer for locations lacking a customer',()=>expect(eventCustomers([{project_id:'event',status:'active'}],'patriot')).toEqual([{id:'patriot',count:1}]));
  it('keeps zero-location legacy projects visible',()=>expect(eventCustomers([],'patriot')).toEqual([{id:'patriot',count:0}]));
  it('prefers location customer over project default for documents',()=>expect(locationCustomer({customer_id:'patriot'},'other')).toBe('patriot'));
  it('counts all four Florida status categories without hiding closed history',()=>expect(locationStatusCounts([{status:'active'},{status:'active'},{status:'complete'},{status:'closed'}])).toEqual({active:2,complete:1,closed:1}));
});