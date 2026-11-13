import { expect, it } from 'bun:test';
import { mobileDestinations, pendingInboxCount, fieldPhoneHomeAllowed } from './mobileOperations';
it('manager phone has five operational destinations', () => {
  expect(mobileDestinations('manager')).toEqual(['/', 'search', 'add', '/approvals', 'profile']);
  expect(mobileDestinations('admin')).toEqual(mobileDestinations('manager'));
});
it('field phone never offers manager destinations', () => {
  expect(mobileDestinations('user')).toEqual(['/', 'search', 'add', '/?mobile=hours', 'profile']);
  expect(mobileDestinations(null)).not.toContain('/approvals');
});
it('inbox count includes every pending item and individual signature nudges', () => {
  expect(pendingInboxCount({joins:[1,2],shifts:[1],requests:[1],orders:[1],signatures:[{count:3}]})).toBe(8);
});
it('linked field user gets only phone Home, without widening other portal routes',()=>{expect(fieldPhoneHomeAllowed('user',true,'/')).toBe(true);expect(fieldPhoneHomeAllowed('user',true,'/projects')).toBe(false);expect(fieldPhoneHomeAllowed('user',false,'/')).toBe(false);expect(fieldPhoneHomeAllowed(null,true,'/')).toBe(false);});
