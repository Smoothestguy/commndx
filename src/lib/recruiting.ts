export const US_STATE_CODES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const stateNames = 'Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|District of Columbia|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming'.toUpperCase().split('|');
export function recruitingState(state?: string | null, answers?: Record<string, unknown> | null): string {
  const normalize = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const raw = value.trim().toUpperCase();
    return US_STATE_CODES.includes(raw) ? raw : US_STATE_CODES[stateNames.indexOf(raw)] || '';
  };
  const structured = normalize(state);
  if (structured) return structured;
  if (!answers) return '';
  // Address fields have generated IDs, but their nested state is structured.
  for (const [key, value] of Object.entries(answers)) {
    if (/^(state|province|state_province|home_state)$/i.test(key)) {
      const code = normalize(value);
      if (code) return code;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const code = recruitingState(null, value as Record<string, unknown>);
      if (code) return code;
    }
  }
  // Only inspect address-labelled strings, never arbitrary answers or files.
  for (const [key, value] of Object.entries(answers)) {
    if (!/address/i.test(key) || typeof value !== 'string') continue;
    const match = value.toUpperCase().match(/(?:,|\s)([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/);
    const code = normalize(match?.[1]);
    if (code) return code;
  }
  return '';
}
export function submissionTime(row: { submitted_at?: string | null; last_applied_at?: string | null; created_at: string }): string {
  return row.submitted_at || row.last_applied_at || row.created_at;
}
export function canMergeApplicants(manager: boolean, ids: string[]): boolean {
  return manager && ids.length === 2 && new Set(ids).size === 2;
}