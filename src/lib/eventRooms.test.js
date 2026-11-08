import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trailerGroups} from './eventRooms.ts';
import {sovQuantity} from './eventSov.ts';
const data={companies:[{id:'c',name:'Crew'}],people:[{id:'p',company_id:'c'}],meals:[],laundry:[],eventAssets:[{id:'a',asset_id:'trailer',start_at:'2026-11-08T05:00:00Z',end_at:null}],bunks:Array.from({length:10},(_,i)=>({id:`r${i+1}`,placement_id:'a',room_number:i+1,code:`26B01-${String(i+1).padStart(2,'0')}`,retired:false})),assignments:[{bunk_id:'r3',person_id:'p',checked_in_at:'2026-11-08T12:30:00Z',checked_out_at:null}]};
test('26B01 has ten rooms and room 03 counts one occupied',()=>{const [g]=trailerGroups(data,'2026-11-08','America/New_York');assert.equal(g.total,10);assert.equal(g.occupied,1);assert.equal(g.rooms[2].code,'26B01-03');});
test('room heads still feed Lodging PPPD',()=>assert.equal(sovQuantity(data,{source:'lodging',company_id:null},'2026-11-08','America/New_York'),1));
test('departed trailers remain on historical day only',()=>{const d={...data,eventAssets:[{...data.eventAssets[0],end_at:'2026-11-09T05:00:00Z'}]};assert.equal(trailerGroups(d,'2026-11-08','America/New_York').length,1);assert.equal(trailerGroups(d,'2026-11-09','America/New_York').length,0);});