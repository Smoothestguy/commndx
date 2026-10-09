type Starrable = { starred_at?: string | null } | null | undefined;

/** Stable sort: starred first (newest starred_at first), rest keep incoming order. */
export function sortStarredFirst<T>(rows: T[], getApplicant: (row: T) => Starrable): T[] {
  return rows
    .map((row, i) => ({ row, i, s: getApplicant(row)?.starred_at ?? null }))
    .sort((a, b) => {
      if (a.s && b.s) return a.s === b.s ? a.i - b.i : a.s < b.s ? 1 : -1;
      if (a.s) return -1;
      if (b.s) return 1;
      return a.i - b.i;
    })
    .map((x) => x.row);
}

/** Stable sort keeping a chosen comparator as secondary within starred/unstarred blocks. */
export function sortStarredBlocks<T>(
  rows: T[],
  getApplicant: (row: T) => Starrable,
  compare: (a: T, b: T) => number,
): T[] {
  return rows
    .map((row, i) => ({ row, i, s: !!getApplicant(row)?.starred_at }))
    .sort((a, b) => {
      if (a.s !== b.s) return a.s ? -1 : 1;
      return compare(a.row, b.row) || a.i - b.i;
    })
    .map((x) => x.row);
}

export function countStarred<T>(rows: T[], getApplicant: (row: T) => Starrable): number {
  return rows.filter((r) => !!getApplicant(r)?.starred_at).length;
}
