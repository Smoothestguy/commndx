import { it, expect } from 'bun:test';
import { employerIds, quickEmployer, customerNonBillableDefault, projectEmployerMaps } from './personnelEmployer';
import { buildAgencyHoursWorkbook } from '../utils/agencyHoursExport';

it('customer employer clears agency vendor on save', () => {
  expect(employerIds('patriot-customer', 'agency')).toEqual({ employer_customer_id: 'patriot-customer', vendor_id: null });
});
it('agency choice clears customer employer on quick-add', () => {
  expect(quickEmployer('agency', 'stale-customer', 'agency')).toEqual({ employer_customer_id: null, vendor_id: 'agency' });
});
it('FRG defaults to neither customer nor vendor', () => {
  expect(quickEmployer('frg', 'stale-customer', 'stale-vendor')).toEqual({ employer_customer_id: null, vendor_id: null });
});
it('customer quick-add saves only the selected customer', () => {
  expect(quickEmployer('customer', 'patriot-customer', 'stale-vendor')).toEqual({ employer_customer_id: 'patriot-customer', vendor_id: null });
});
it('clearable employer choices save null IDs', () => {
  expect(employerIds('', '')).toEqual({ employer_customer_id: null, vendor_id: null });
});
it('customer choice defaults non-billable ON while other choices preserve switch', () => {
  expect(customerNonBillableDefault('customer', false)).toBe(true);
  expect(customerNonBillableDefault('agency', false)).toBe(false);
  expect(customerNonBillableDefault('frg', true)).toBe(true);
});
const data = {
  people: [
    { personnel_id: 'patrick', employer_customer_id: 'patriot', vendor_id: 'deleted-vendor', non_billable: true },
    { personnel_id: 'agency-worker', employer_customer_id: null, vendor_id: 'agency', non_billable: true },
  ],
  customers: [{ id: 'patriot', name: 'Patriot Response Group' }],
  vendors: [{ id: 'deleted-vendor', name: 'Incorrect Patriot vendor' }, { id: 'agency', name: 'Staffing Agency' }],
};
it('customer employer has priority and cannot appear as an agency', () => {
  const maps = projectEmployerMaps(data);
  expect(maps.customerByPerson.patrick).toBe('patriot');
  expect(maps.vendorByPerson.patrick).toBeNull();
  expect(maps.agencyName('patrick')).toBeUndefined();
  expect(maps.vendors.map(v => v.id)).toEqual(['agency']);
});
it('agency employer falls back to vendor linkage', () => {
  const maps = projectEmployerMaps(data);
  expect(maps.vendorByPerson['agency-worker']).toBe('agency');
  expect(maps.customerByPerson['agency-worker']).toBeNull();
});
it('agency workbook excludes customer personnel but keeps non-billable agency hours', async () => {
  const entries = ['patrick', 'agency-worker'].map(id => ({ id, personnel_id: id, name: id, location_id: 'loc', location_name: 'Site', visit_id: 'v', in_at: '2026-11-05T13:00:00Z', out_at: '2026-11-05T17:00:00Z', date: '2026-11-05', shift: 'day', hours: 4, open: false, source: 'visit' }));
  const wb = await buildAgencyHoursWorkbook('agency', '2026-11-02', entries, projectEmployerMaps(data).vendorByPerson);
  expect(wb.getWorksheet('Timesheet').getRow(2).getCell(1).value).toBe('agency-worker');
  expect(wb.getWorksheet('Timesheet').getRow(2).getCell(9).value).toBe(4);
  expect(wb.getWorksheet('Detail').rowCount).toBe(2);
});