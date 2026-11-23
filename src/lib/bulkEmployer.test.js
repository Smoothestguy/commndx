import { describe, it, expect } from 'vitest';
import { employerPatch, FRG } from './bulkEmployer';
describe('bulk set employer', () => {
  it('customer sets employer and non-billable', () => expect(employerPatch('c1')).toMatchObject({ employer_customer_id: 'c1', non_billable: true }));
  it('FRG clears employer and is billable', () => expect(employerPatch(FRG)).toEqual({ employer_customer_id: null, non_billable: false }));
});
