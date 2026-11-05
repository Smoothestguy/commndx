import {it,expect} from 'bun:test';
import {buildAgencyHoursWorkbook} from './agencyHoursExport';
const entry=(personnel_id,date,hours,extra={})=>({id:personnel_id+date,personnel_id,name:personnel_id,location_id:'loc',location_name:'Site',visit_id:'visit',in_at:date+'T14:00:00Z',out_at:date+'T22:00:00Z',date,shift:'day',hours,open:false,source:'Supervisor',...extra});
it('agency workbook includes only selected vendor personnel and selected Mon–Sun week',async()=>{
 const entries=[entry('Agency Person','2026-11-02',8),entry('Agency Person','2026-11-08',4),entry('Agency Person','2026-11-09',10),entry('Other Person','2026-11-02',20)];
 const wb=await buildAgencyHoursWorkbook('agency','2026-11-02',entries,{'Agency Person':'agency','Other Person':'other'});
 expect(wb.worksheets.map(s=>s.name)).toEqual(['Timesheet','Detail']);
 expect(wb.getWorksheet('Timesheet').getRow(2).getCell(9).value).toBe(12);
 expect(wb.getWorksheet('Detail').rowCount).toBe(3);
 expect(wb.getWorksheet('Detail').getColumn(1).values.filter(Boolean)).toEqual(['Person','Agency Person','Agency Person']);
});
it('agency export allow-lists hours fields and never exports rate/pay/bill data',async()=>{
 const wb=await buildAgencyHoursWorkbook('agency','2026-11-02',[entry('Worker','2026-11-02',8,{pay_rate:12345,bill_rate:23456,amount:34567})],{Worker:'agency'});
 expect(wb.getWorksheet('Detail').getRow(1).values.slice(1)).toEqual(['Person','Location','Date','Shift','In','Out','Hours','Source']);
 expect(wb.getWorksheet('Timesheet').columnCount).toBe(9);
 const values=[];for(const ws of wb.worksheets)ws.eachRow(r=>r.eachCell(c=>values.push(c.value)));
 expect(values).not.toContain(12345);expect(values).not.toContain(23456);expect(values).not.toContain(34567);
});
it('open punches contribute zero hours to agency totals',async()=>{
 const wb=await buildAgencyHoursWorkbook('agency','2026-11-02',[entry('Worker','2026-11-02',8,{open:true,out_at:null})],{Worker:'agency'});
 expect(wb.getWorksheet('Timesheet').getRow(2).getCell(9).value).toBe(0);
 expect(wb.getWorksheet('Detail').getRow(2).getCell(6).value).toBe('Open');
 expect(wb.getWorksheet('Detail').getRow(2).getCell(7).value).toBe(0);
});
