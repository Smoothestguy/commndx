import { expect, test } from 'bun:test';
import { selectableProjectVendors, projectVendorAllowed } from './projectVendors';
const rows = [{id:'dom',name:'DOM SOLUTIONS',active:true},{id:'other',name:'Other agency',active:false}];
test('only active project vendors are selectable',()=>expect(selectableProjectVendors(rows).map(v=>v.id)).toEqual(['dom']));
test('empty project never falls back to global vendors',()=>expect(selectableProjectVendors([])).toEqual([]));
test('unassigned vendor cannot be picked',()=>expect(projectVendorAllowed(rows,'global')).toBe(false));
test('inactive membership retains history but cannot be picked',()=>expect(projectVendorAllowed(rows,'other')).toBe(false));