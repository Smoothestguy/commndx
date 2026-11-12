export type SizingColumn = { key: string; header: string; width?: number; frozen?: boolean };
export const actionColumn = (c: SizingColumn) => /^actions?$/i.test(c.header || c.key) || /^actions?$/i.test(c.key);
export const identityColumn = (c: SizingColumn) => c.frozen || /^(name|person|location|asset|company)$/i.test(c.header);
export function defaultColumnWidth(c: SizingColumn): number {
  if (actionColumn(c)) return 100;
  if (/^(avatar|photo)$/i.test(c.key)) return 48;
  if (identityColumn(c)) return Math.min(c.width ?? 220, 220);
  if (/^(status|gender|ownership|type|texted|hours?|hrs|days|in|out|phone)$/i.test(c.header)) return Math.min(c.width ?? 100, 120);
  return c.width ?? 150;
}
export function gridColumnWidths(columns: SizingColumn[], saved: Record<string, number>, available: number, lead = 0): number[] {
  const sizes = columns.map(c => saved[c.key] ?? defaultColumnWidth(c));
  const extra = Math.max(0, available - lead - sizes.reduce((n, w) => n + w, 0));
  const flex = columns.map((c, i) => ({ c, i })).filter(({ c }) => !actionColumn(c) && !identityColumn(c) && !/^(avatar|photo)$/i.test(c.key) && saved[c.key] == null).at(-1)?.i;
  if (flex != null) sizes[flex] += extra;
  return sizes;
}