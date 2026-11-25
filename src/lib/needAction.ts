/** Roster people for the day with no stay at this location and no saved resolution. */
export function needActionIds(rosterIds: Iterable<string>, withStayIds: Iterable<string>, resolvedIds: Iterable<string>): string[] {
  const done = new Set([...withStayIds, ...resolvedIds]);
  return [...new Set(rosterIds)].filter(id => !done.has(id));
}

export type NeedHint = { kind: 'other_site' | 'opened_link' | 'last' | 'none'; text: string; warn?: boolean };

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);

/** First match wins: other site that day → opened link → last clock-in anywhere → none. Times are HHmm, dates YYYY-MM-DD. */
export function needHint(day: string, o: { otherSite?: { name: string; time: string } | null; openedLink?: string | null; lastDay?: string | null }): NeedHint {
  if (o.otherSite) return { kind: 'other_site', text: `Clocked in at ${o.otherSite.name} ${o.otherSite.time}` };
  if (o.openedLink) return { kind: 'opened_link', text: `Opened link ${o.openedLink}, never clocked in` };
  if (o.lastDay) return { kind: 'last', text: `Last clocked in ${o.lastDay.slice(5, 7)}/${o.lastDay.slice(8, 10)}`, warn: daysBetween(o.lastDay, day) >= 2 };
  return { kind: 'none', text: 'No clock-ins yet' };
}
