export function withSearchValue(search: string, key: string, value: string) {
  const params = new URLSearchParams(search);
  params.set(key, value);
  return params;
}
export function locationHref(projectId: string, locationId: string, tab?: string) {
  const path = `/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(locationId)}`;
  return tab ? `${path}?tab=${encodeURIComponent(tab)}` : path;
}