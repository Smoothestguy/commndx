import { expect, test } from 'bun:test';
import { moveDefaultChoices } from './moveOnboarding';
test('profile conflicts default source, including consent and identity fields', () => {
  const names = ['everify_status','ssn_full','bank_account_number','city','gender','sms_consent_at'];
  const fields = names.map(field => ({field, mode:'profile', action:'conflict', source:'source', target:'target'}));
  expect(moveDefaultChoices(fields)).toEqual(Object.fromEntries(names.map(n => [n,'source'])));
});
test('names, email and phone stay target by default', () => {
  const fields = ['first_name','last_name','email','phone'].map(field => ({field,mode:'contact',action:'keep',source:'a',target:'b'}));
  expect(moveDefaultChoices(fields)).toEqual({first_name:'target',last_name:'target',email:'target',phone:'target'});
});
test('empty fills and employment fields are not conflict choices', () => {
  expect(moveDefaultChoices([{field:'address',mode:'profile',action:'fill',source:'x',target:null},{field:'pay_rate',mode:'employment',action:'keep',source:30,target:20}])).toEqual({});
});