import { test, expect } from 'bun:test';
import { rosterContains, rosterChoices } from './projectPersonnel';
test('outsider is excluded until added to project', () => { expect(rosterContains([{id:'crew'}],'outsider')).toBe(false); expect(rosterContains([{id:'crew'},{id:'outsider'}],'outsider')).toBe(true); });
test('empty roster never supplies global choices', () => { expect(rosterChoices([{personnel_id:'global'}],[])).toEqual([]); });
test('worked history remains eligible after deactivation', () => { expect(rosterChoices([{personnel_id:'worked'},{personnel_id:'outsider'}],[],['worked'])).toEqual([{personnel_id:'worked'}]); });