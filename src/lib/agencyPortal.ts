import { z } from 'zod';
import { weekDays } from '@/lib/shifts';

export const agencyStatus = z.enum(['unassigned', 'no_show', 'on_site', 'done']);
export const agencyLogo = z.string().url().refine(value => new URL(value).protocol === 'https:').nullable().optional().catch(null);
const text = z.string().nullable();
// Recursive allow-list: extra fields (including financial metadata) never enter portal state.
export const agencyOverview = z.object({
  valid: z.boolean(), agency_name: z.string().optional(), agency_logo_url: agencyLogo,
  customer_name: z.literal('Fairfield Response Group').optional(), date: z.string().optional(),
  people: z.array(z.object({ name: z.string(), role: text, site: text, project: text,
    in_at: text, out_at: text, hours: z.number().nonnegative().nullable(), status: agencyStatus })).optional(),
});
export const agencyWeek = z.object({valid: z.boolean().optional(), week_start: z.string().optional(), rows: z.array(z.object({name: z.string(), date: z.string(), site: text, hours: z.number().nonnegative().nullable()})).optional()});
export type AgencyWeekRow = NonNullable<z.infer<typeof agencyWeek>['rows']>[number];
export function canManageAgency(role: string | null | undefined) { return role === 'admin' || role === 'manager'; }
export function agencyExpiry(now = new Date()) { return new Date(now.getTime() + 120 * 86400000).toISOString(); }
export function agencyUrl(token: string, origin = window.location.origin) {
  const host = new URL(origin).hostname;
  return `${host === 'localhost' || host.endsWith('.lovable.app') ? 'https://fairfieldrg.com' : origin}/agency/${token}`;
}
export function agencyMatrix(rows: AgencyWeekRow[], start: string) {
  const days = weekDays(start), people = new Map<string, number[]>();
  for (const row of rows) {
    const index = days.indexOf(row.date); if (index < 0) continue;
    const hours = people.get(row.name) || days.map(() => 0);
    hours[index] += row.hours || 0; people.set(row.name, hours);
  }
  return [...people].sort(([a], [b]) => a.localeCompare(b)).map(([name, hours]) => ({name, hours, total: hours.reduce((a,b)=>a+b,0)}));
}
export async function buildAgencyPortalWorkbook(rows: AgencyWeekRow[], start: string) {
  const ExcelJS = (await import('exceljs')).default, wb = new ExcelJS.Workbook();
  const days = weekDays(start), sheet = wb.addWorksheet('Timesheet');
  sheet.addRow(['Person', ...days.map((d,i)=>`${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]} ${d}`), 'Total']).font = {bold:true};
  const matrix = agencyMatrix(rows, start);
  matrix.forEach(p => sheet.addRow([p.name, ...p.hours, p.total]));
  sheet.addRow(['Total', ...days.map((_,i)=>matrix.reduce((sum,p)=>sum+p.hours[i],0)), matrix.reduce((sum,p)=>sum+p.total,0)]).font={bold:true};
  sheet.getColumn(1).width=28;
  for(let i=2;i<=9;i++){sheet.getColumn(i).width=18;sheet.getColumn(i).numFmt='0.00';}
  const detail=wb.addWorksheet('Detail');detail.addRow(['Person','Date','Location','Hours']).font={bold:true};
  // No spreading RPC rows: only these four non-financial columns can be exported.
  rows.filter(r=>days.includes(r.date)).forEach(r=>detail.addRow([r.name,r.date,r.site||'',r.hours||0]));
  [28,14,30,12].forEach((w,i)=>detail.getColumn(i+1).width=w);detail.getColumn(4).numFmt='0.00';
  return wb;
}