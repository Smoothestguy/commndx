export function mobileDestinations(role: string | null | undefined) {
  return role === 'admin' || role === 'manager'
    ? ['/', 'search', 'add', '/approvals', 'profile']
    : ['/', 'search', 'add', '/?mobile=hours', 'profile'];
}
export function pendingInboxCount(groups: { joins: unknown[]; shifts: unknown[]; requests: unknown[]; orders: unknown[]; signatures: { count: number }[] }) {
  return groups.joins.length + groups.shifts.length + groups.requests.length + groups.orders.length + groups.signatures.reduce((n, s) => n + s.count, 0);
}
export function fieldPhoneHomeAllowed(role:string|null|undefined,mobile:boolean,path:string){return role==='user'&&mobile&&path==='/';}
export function phoneDefaultSite(sites: { id: string; openAt?: string | null }[]) {
  return [...sites].sort((a, b) => Date.parse(b.openAt || '') - Date.parse(a.openAt || '')).find(s => s.openAt)?.id || sites[0]?.id;
}
