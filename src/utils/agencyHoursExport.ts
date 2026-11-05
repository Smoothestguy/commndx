import type { TimesheetEntry } from '@/integrations/supabase/hooks/useTimekeeping';
import { chicagoTime, dayLabel, weekDays } from '@/lib/shifts';
const r2=(n:number)=>Math.round(n*100)/100;
/** Deliberately allow-listed hours-only workbook; never spread source objects into rows. */
export async function buildAgencyHoursWorkbook(vendorId:string,weekStart:string,entries:TimesheetEntry[],vendorByPerson:Record<string,string>) {
 if(!vendorId || vendorId==='all')throw new Error('Choose an agency');
 const days=weekDays(weekStart);
 const selected=entries.filter(e=>vendorByPerson[e.personnel_id]===vendorId&&days.includes(e.date));
 const ExcelJS=(await import('exceljs')).default;
 const wb=new ExcelJS.Workbook();
 const matrix=wb.addWorksheet('Timesheet');
 matrix.addRow(['Person',...days.map(dayLabel),'Total']).font={bold:true};
 const people=new Map<string,{name:string;hours:Record<string,number>}>();
 for(const e of selected){let person=people.get(e.personnel_id);if(!person){person={name:e.name,hours:{}};people.set(e.personnel_id,person);}if(!e.open)person.hours[e.date]=(person.hours[e.date]||0)+e.hours;}
 const totals=days.map(()=>0);
 for(const p of [...people.values()].sort((a,b)=>a.name.localeCompare(b.name))){const hours=days.map((d,i)=>{const h=p.hours[d]||0;totals[i]+=h;return r2(h);});matrix.addRow([p.name,...hours,r2(hours.reduce((a,b)=>a+b,0))]);}
 matrix.addRow(['Total',...totals.map(r2),r2(totals.reduce((a,b)=>a+b,0))]).font={bold:true};
 matrix.getColumn(1).width=28;for(let i=2;i<=9;i++){matrix.getColumn(i).width=12;matrix.getColumn(i).numFmt='0.00';}
 const detail=wb.addWorksheet('Detail');detail.addRow(['Person','Location','Date','Shift','In','Out','Hours','Source']).font={bold:true};
 for(const e of [...selected].sort((a,b)=>a.name.localeCompare(b.name)||a.date.localeCompare(b.date)||a.in_at.localeCompare(b.in_at))){detail.addRow([e.name,e.location_name,e.date,e.shift==='day'?'Day':'Night',chicagoTime(e.in_at),e.open?'Open':chicagoTime(e.out_at),e.open?0:r2(e.hours),e.source]);}
 [28,28,14,10,12,12,12,18].forEach((w,i)=>detail.getColumn(i+1).width=w);detail.getColumn(7).numFmt='0.00';
 return wb;
}
export async function exportAgencyHours(vendor:{id:string;name:string},weekStart:string,entries:TimesheetEntry[],vendorByPerson:Record<string,string>){
 const wb=await buildAgencyHoursWorkbook(vendor.id,weekStart,entries,vendorByPerson);
 const bytes=await wb.xlsx.writeBuffer();const url=URL.createObjectURL(new Blob([bytes as ArrayBuffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const a=document.createElement('a');a.href=url;a.download=`${vendor.name.replace(/[^\p{L}\p{N} -]/gu,'').trim().replace(/\s+/g,'-')||'agency'}-hours-${weekStart}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
