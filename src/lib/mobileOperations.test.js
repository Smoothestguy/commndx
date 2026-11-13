import { expect, it } from 'bun:test';
import { mobileDestinations, pendingInboxCount } from './mobileOperations';
it('manager phone has five operational destinations', () => {
  expect(mobileDestinations('manager')).toEqual(['/', '/locations', '/approvals', '/time-tracking', 'more']);
  expect(mobileDestinations('admin')).toEqual(mobileDestinations('manager'));
});
it('field phone never offers manager destinations', () => {
  expect(mobileDestinations('user')).toEqual(['/', '/messages', 'more']);
  expect(mobileDestinations(null)).not.toContain('/approvals');
});
it('inbox count includes every pending item and individual signature nudges', () => {
  expect(pendingInboxCount({joins:[1,2],shifts:[1],requests:[1],orders:[1],signatures:[{count:3}]})).toBe(8);
});