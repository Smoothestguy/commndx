import {expect,test} from 'bun:test';
import {attendanceEligible} from './attendanceEligibility';
test('demobilized worked days remain eligible through stays',()=>expect(attendanceEligible(false,true,false)).toBe(true));
test('demobilized worked days remain eligible through ledger entries',()=>expect(attendanceEligible(false,false,true)).toBe(true));
test('assignment covering a historical day is eligible',()=>expect(attendanceEligible(true,false,false)).toBe(true));
test('later dates without assignment or work omit removed workers',()=>expect(attendanceEligible(false,false,false)).toBe(false));