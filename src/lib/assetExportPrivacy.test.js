import { it, expect } from 'bun:test';
import { transformAssetAssignmentToExportRow } from '../utils/assetExportUtils';

it('asset exports retain ownership and responsible person but never rental/purchase/bill costs', () => {
  const row = transformAssetAssignmentToExportRow({
    id: 'assignment', asset_id: 'asset', assets: { label: 'Ram', ownership: 'rented', vendor_name: 'ABC Supply', rental_rate: 125, unit_cost: 45000, default_day_rate: 200 },
    personnel: { first_name: 'Jorge', last_name: 'Hernandez' }, day_rate: 200, status: 'active',
  });
  expect(row.assignedTo).toBe('Jorge Hernandez');
  expect(row.ownership).toBe('Rented · ABC Supply');
  expect(Object.keys(row).sort()).toEqual(['address','assetId','assetLabel','assetType','assignedTo','endAt','id','notes','ownership','serialNumber','startAt','status'].sort());
  expect(Object.values(row)).not.toContain(125);
  expect(Object.values(row)).not.toContain(45000);
  expect(Object.values(row)).not.toContain(200);
});