import { getStateWithFallback } from './locationUtils';
export const US_STATE_CODES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const stateNames = 'Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|District of Columbia|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming'.toUpperCase().split('|');
export function recruitingState(state?: string | null, answers?: Record<string, unknown> | null): string {
  const raw = (getStateWithFallback(state, answers) || '').trim().toUpperCase();
  return US_STATE_CODES.includes(raw) ? raw : US_STATE_CODES[stateNames.indexOf(raw)] || ''; 
}
export function submissionTime(row: { submitted_at?: string | null; last_applied_at?: string | null; created_at: string }): string {
  return row.submitted_at || row.last_applied_at || row.created_at;
}
export function canMergeApplicants(manager: boolean, ids: string[]): boolean {
  return manager && ids.length === 2 && new Set(ids).size === 2;
}