export const EVENT_TABS = ['event', 'locations', 'recruiting', 'financials', 'docs'] as const;
export function eventTabDestination(tab: string | null) {
  if (tab === 'deployment' || tab === 'crew' || tab === 'time') return 'locations';
  return EVENT_TABS.find(t => t === tab) ?? 'event';
}