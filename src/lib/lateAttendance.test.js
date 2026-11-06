import { it, expect } from 'bun:test';
import { maxLate, lateDayKey } from './lateAttendance';
it('any positive lateness is retained including one minute', () => expect(maxLate([{late_minutes:0}, {late_minutes:1,late_reason:'Traffic'}])).toEqual({late_minutes:1,late_reason:'Traffic'}));
it('a later on-time stay cannot erase the late day', () => expect(maxLate([{late_minutes:20,late_reason:'Overslept'},{late_minutes:0}])).toEqual({late_minutes:20,late_reason:'Overslept'}));
it('different days and locations remain independent', () => { expect(lateDayKey('p','2026-11-06','a')).not.toBe(lateDayKey('p','2026-11-07','a')); expect(lateDayKey('p','2026-11-06','a')).not.toBe(lateDayKey('p','2026-11-06','b')); });