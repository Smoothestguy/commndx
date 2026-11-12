export type ProjectVendorName = { id: string; name: string; active: boolean };
export function selectableProjectVendors(rows: ProjectVendorName[] = []) {
  return rows.filter(row => row.active);
}
export function projectVendorAllowed(rows: ProjectVendorName[], id: string) {
  return !id || rows.some(row => row.id === id && row.active);
}