export const constructionModules = [
  { key: 'estimates', label: 'Estimates / Takeoff', paths: ['/estimates','/takeoff','/estimating','/roof-measurements'] },
  { key: 'change_orders', label: 'Change Orders', paths: ['/change-orders'] },
  { key: 'tm_tickets', label: 'T&M tickets', paths: ['/tm-tickets'] },
  { key: 'work_orders', label: 'Work Orders', paths: ['/purchase-orders','/completion-reviews','/admin/contractor-submissions'] },
  { key: 'job_orders', label: 'Job Orders', paths: ['/job-orders'] },
] as const;
export type ModuleKey = typeof constructionModules[number]['key'];
export type ModuleFlags = Partial<Record<ModuleKey, boolean>>;
export function moduleVisible(path: string, flags: ModuleFlags = {}) {
  const module = constructionModules.find(m=>m.paths.some(p=>path===p||path.startsWith(p+'/')||path.startsWith(p+'?')));
  return !module || flags[module.key] === true;
}
export function parseModuleFlags(value: unknown): ModuleFlags {
  if (!value || typeof value!=='object' || Array.isArray(value)) return {};
  return Object.fromEntries(constructionModules.map(m=>[m.key,(value as Record<string,unknown>)[m.key]===true]));
}