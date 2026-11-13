export function mobileDestinations(role: string | null | undefined) {
  return role === 'admin' || role === 'manager'
    ? ['/', '/locations', '/approvals', '/time-tracking', 'more']
    : ['/', '/messages', 'more'];
}
export function pendingInboxCount(groups: { joins: unknown[]; shifts: unknown[]; requests: unknown[]; orders: unknown[]; signatures: { count: number }[] }) {
  return groups.joins.length + groups.shifts.length + groups.requests.length + groups.orders.length + groups.signatures.reduce((n, s) => n + s.count, 0);
}