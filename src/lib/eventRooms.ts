import type {CampData} from './eventManager';
import {locationTimeIso} from './manualTime';
import {nextDay} from './signinSheets';
export function trailerGroups(data:CampData,day:string,zone:string) {
 const start=locationTimeIso(day,'00:00',zone),end=locationTimeIso(nextDay(day),'00:00',zone);
 if(!start||!end)return [];
 const placements=(data.eventAssets??[]).filter(p=>p.start_at<end&&(!p.end_at||p.end_at>start));
 return placements.flatMap(p=>{
  const rooms=data.bunks.filter(b=>b.placement_id===p.id&&!b.retired).sort((a,b)=>(a.room_number??0)-(b.room_number??0));
  if(!rooms.length)return [];
  const ids=new Set(rooms.map(r=>r.id));
  const occupied=new Set(data.assignments.filter(a=>ids.has(a.bunk_id)&&a.checked_in_at<end&&(!a.checked_out_at||a.checked_out_at>start)).map(a=>a.bunk_id)).size;
  return [{id:p.id,assetId:p.asset_id,rooms,occupied,total:rooms.length,active:!p.end_at}];
 });
}