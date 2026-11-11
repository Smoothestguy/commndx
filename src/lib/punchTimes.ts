export function punchTimeDetail(actual: string | null | undefined, counted: string | null | undefined, zone: string) {
  if (!actual || !counted || Date.parse(actual) === Date.parse(counted)) return undefined;
  const clock = (at: string) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at));
  return `tapped ${clock(actual)} → counted ${clock(counted)}`;
}
