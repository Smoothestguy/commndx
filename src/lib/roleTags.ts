export const ROLE_TAGS = [
  "Forklift Operator",
  "General Labor",
  "Janitorial",
  "Kitchen",
  "Admin",
  "CDL Driver",
  "Roofer",
  "Welder",
  "Carpenter",
  "Electrician",
  "Supervisor",
  "Skilled Trades",
] as const;

export type RoleTag = (typeof ROLE_TAGS)[number];

/** Visible badges + overflow count for compact list rows. */
export function splitRoleTags(tags: string[] | null | undefined, max = 2) {
  const list = tags ?? [];
  return { shown: list.slice(0, max), overflow: Math.max(0, list.length - max) };
}
