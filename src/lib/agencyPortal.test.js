import {it,expect} from 'bun:test';
import {agencyOverview,agencyWeek,agencyMatrix,agencyExpiry,canManageAgency,buildAgencyPortalWorkbook} from './agencyPortal';
const rows=[{name:'Worker A',date:'2026-11-02',site:'Site 1',hours:8},{name:'Worker A',date:'2026-11-02',site:'Site 2',hours:2},{name:'Worker A',date:'2026-11-08',site:'Site 1',hours:4},{name:'Outside',date:'2026-11-09',site:'Site 1',hours:50}];
it('Mon–Sun matrix sums multiple sites and excludes dates outside the selected week',()=>{
 expect(agencyMatrix(rows,'2026-11-02')).toEqual([{name:'Worker A',hours:[10,0,0,0,0,0,4],total:14}]);
});
it('recursive portal projection strips unexpected financial and identity fields',()=>{
 const overview=agencyOverview.parse({valid:true,agency_name:'Agency',bill_rate:450,people:[{name:'Worker',role:null,site:null,project:null,in_at:null,out_at:null,hours:null,status:'unassigned',pay_rate:100,ssn:'private'}]});
 expect(overview.bill_rate).toBeUndefined();expect(overview.people[0].pay_rate).toBeUndefined();expect(overview.people[0].ssn).toBeUndefined();
 const week=agencyWeek.parse({valid:true,rows:[{...rows[0],amount:1000}]});expect(week.rows[0].amount).toBeUndefined();
});
it('agency workbook has exactly hours-only Timesheet and Detail sheets',async()=>{
 const wb=await buildAgencyPortalWorkbook(rows.map(r=>({...r,bill_rate:99999,pay_rate:88888})),'2026-11-02');
 expect(wb.worksheets.map(w=>w.name)).toEqual(['Timesheet','Detail']);
 expect(wb.getWorksheet('Detail').getRow(1).values.slice(1)).toEqual(['Person','Date','Location','Hours']);
 expect(wb.getWorksheet('Timesheet').getRow(2).getCell(9).value).toBe(14);
 expect(wb.getWorksheet('Detail').rowCount).toBe(4);
 const values=[];for(const ws of wb.worksheets)ws.eachRow(r=>r.eachCell(c=>values.push(c.value)));
 expect(values).not.toContain(99999);expect(values).not.toContain(88888);expect(values).not.toContain('Outside');
});
it('portal links expire exactly 120 days after creation',()=>{
 expect(agencyExpiry(new Date('2026-11-06T02:22:00Z'))).toBe('2027-03-06T02:22:00.000Z');
});
it('only admin and manager can manage agency links and logos',()=>{
 expect(canManageAgency('admin')).toBe(true);expect(canManageAgency('manager')).toBe(true);
 for(const role of ['user','vendor','personnel','accounting',null])expect(canManageAgency(role)).toBe(false);
});