import {test} from 'node:test';
import assert from 'node:assert/strict';
import {locationZone,localStamp,preshiftMessage} from '../../supabase/functions/_shared/locationTime.ts';
import {preshiftAt,shiftAt} from '../../supabase/functions/_shared/rosterRules.ts';
test('5049 0730 Eastern has 0725 Eastern reminder, not Central',()=>{
 const now=Date.parse('2026-11-07T12:25:00Z');
 const p=preshiftAt(now,'America/New_York','07:30:00','19:30:00',5);
 assert.equal(p?.start,Date.parse('2026-11-07T12:30:00Z'));
 assert.equal(localStamp(now,'America/New_York'),'2026-11-07 0725 Eastern (America/New_York)');
 assert.equal(preshiftMessage(p.time,'America/New_York',p.start,'5049-FCOCO','[signing link]'),'FRG: Clock in for your 0730 Eastern shift at 5049-FCOCO. Early taps count from 0730; extra time requires approval: [signing link]');
 assert.equal(preshiftAt(Date.parse('2026-11-07T12:24:59Z'),'America/New_York','07:30','19:30',5),null);
 assert.equal(preshiftAt(p.start,'America/New_York','07:30','19:30',5),null);
});
test('timezone fallback is location then project then Chicago',()=>{
 assert.equal(locationZone({timezone:'America/New_York'},{timezone:'America/Denver'}),'America/New_York');
 assert.equal(locationZone({}, {timezone:'America/Denver'}),'America/Denver');
 assert.equal(locationZone({}),'America/Chicago');
});
test('Eastern shifts retain 0730 across DST transition',()=>{
 assert.equal(new Date(shiftAt('2026-10-31','07:30','America/New_York')).toISOString(),'2026-10-31T11:30:00.000Z');
 assert.equal(new Date(shiftAt('2026-11-01','07:30','America/New_York')).toISOString(),'2026-11-01T12:30:00.000Z');
});