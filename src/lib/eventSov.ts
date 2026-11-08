import {campCounts,type CampData,type EventRow} from './eventManager';
import {localDay,nextDay} from './signinSheets';
import {locationTimeIso} from './manualTime';
export function assetOnDay(a:{start_at:string;end_at:string|null},day:string,zone:string) {
 const start=locationTimeIso(day,'00:00',zone),end=locationTimeIso(nextDay(day),'00:00',zone);
 return !!start&&!!end&&a.start_at<end&&(!a.end_at||a.end_at>start);
}
export function assetDays(a:{start_at:string;end_at:string|null},through:string,zone:string) {
 let n=0;for(let day=localDay(a.start_at,zone);day<=through;day=nextDay(day)){if(assetOnDay(a,day,zone))n++;if(n>36500)break;}return n;
}
export function sovQuantity(data:CampData,line:EventRow<'event_sov_lines'>,day:string,zone:string,companyFilter='') {
 if(companyFilter&&line.company_id&&line.company_id!==companyFilter)return 0;
 const scope=line.company_id||companyFilter;
 const counts=campCounts(data,day,zone).filter(r=>!scope||data.companies.find(c=>c.name===r.Company)?.id===scope);
 const key={lodging:'Bunk heads',breakfast:'Breakfast',lunch:'Lunch',dinner:'Dinner',laundry:'Laundry in'}[line.source] as 'Bunk heads'|'Breakfast'|'Lunch'|'Dinner'|'Laundry in'|undefined;
 if(key)return counts.reduce((n,r)=>n+r[key],0);
 if(line.source==='fuel')return (data.fuel??[]).filter(f=>localDay(f.logged_at,zone)===day&&(!scope||f.company_id===scope)).reduce((n,f)=>n+f.gallons,0);
 if(line.source==='equipment')return new Set((data.eventAssets??[]).filter(a=>assetOnDay(a,day,zone)&&(!scope||a.company_id===scope)).map(a=>a.asset_id)).size;
 return (data.quantities??[]).filter(q=>q.sov_line_id===line.id&&q.service_date===day&&(!scope||q.company_id===scope)).reduce((n,q)=>n+q.quantity,0);
}
export function sovReport(data:CampData,from:string,to:string,zone:string,companyFilter='',internal=false) {
 if(!from||!to||from>to)throw new Error('Choose a valid date range');
 const days:string[]=[];for(let day=from;day<=to;day=nextDay(day)){if(days.length>=366)throw new Error('Choose up to 366 days');days.push(day);}
 return (data.sov??[]).filter(l=>!companyFilter||!l.company_id||l.company_id===companyFilter).sort((a,b)=>a.sort_order-b.sort_order||a.label.localeCompare(b.label)).map(line=>{
  const daily=days.map(day=>({Date:day,Quantity:sovQuantity(data,line,day,zone,companyFilter)}));const total=daily.reduce((n,r)=>n+r.Quantity,0);
  const summary={Line:line.label,Unit:line.unit_type,Description:line.unit_description,Company:line.company_id?data.companies.find(c=>c.id===line.company_id)?.name??'—':companyFilter?data.companies.find(c=>c.id===companyFilter)?.name??'—':'Whole location','Total qty':total};
  return {label:line.label,daily,summary:internal?{...summary,'Internal rate':line.internal_rate,'Internal amount':line.internal_rate===null?null:total*line.internal_rate}:summary};
 });
}
export async function downloadSov(data:CampData,from:string,to:string,zone:string,companyFilter:string,internal:boolean) {
 const report=sovReport(data,from,to,zone,companyFilter,internal);if(!report.length)throw new Error('Add SOV lines first');
 const XLSX=await import('xlsx');const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(report.map(r=>r.summary)),'Summary');
 report.forEach((r,i)=>XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(r.daily),`${i+1} ${r.label.replace(/[\\/?*\[\]:]/g,' ')}`.slice(0,31)));
 const url=URL.createObjectURL(new Blob([XLSX.write(book,{type:'array',bookType:'xlsx'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download=`SOV-${internal?'internal':'customer'}-${from}-${to}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}