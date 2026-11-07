import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMilitary,validMilitary,clockValue} from './militaryTime.ts';
test('typed and pasted 0730, 07:30 and 730 normalize to 0730',()=>{
  for(const value of ['0730','07:30','730']) {assert.equal(normalizeMilitary(value),'0730');assert.equal(clockValue(value),'07:30');}
});
test('military clock accepts 0000–2359 and rejects invalid hours/minutes',()=>{
  for(const value of ['0000','2359']) assert.equal(validMilitary(value),true);
  for(const value of ['2400','2360','9999','07.30','12','abcd']) assert.equal(validMilitary(value),false);
});