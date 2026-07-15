// Merge-tag renderer for dynamic template & SMS content.
// Unresolvable tags become empty strings; doubled spaces are collapsed afterward.

export interface MergeTagContext {
  project?: {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    customers?: { name?: string | null; company?: string | null } | null;
    customer?: { name?: string | null; company?: string | null } | null;
    customer_name?: string | null;
  } | null;
  taskOrder?: {
    title?: string | null;
    location_address?: string | null;
    start_at?: string | null;
    approx_duration?: string | null;
    per_diem_amount?: number | null;
  } | null;
  positions?: Array<{
    show_pay_publicly?: boolean | null;
    advertised_pay_rate?: number | null;
  }> | null;
}

function fmtDate(v?: string | null): string {
  if (!v) return "";
  try {
    // Prefer local date parsing for YYYY-MM-DD
    const d = /^\d{4}-\d{2}-\d{2}$/.test(v)
      ? new Date(v + "T00:00:00")
      : new Date(v);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function resolveMergeTag(
  tag: string,
  ctx: MergeTagContext
): string {
  const p = ctx.project ?? undefined;
  const t = ctx.taskOrder ?? undefined;
  const positions = ctx.positions ?? [];

  switch (tag) {
    case "project_name":
      return p?.name || "";
    case "customer_name": {
      const c = p?.customers || p?.customer;
      return (
        p?.customer_name ||
        c?.company ||
        c?.name ||
        ""
      );
    }
    case "location": {
      if (t?.location_address) return t.location_address;
      if (!p) return "";
      const line = [p.address, p.city, p.state, p.zip].filter(Boolean).join(", ");
      return line;
    }
    case "start_date":
      return fmtDate(t?.start_at || p?.start_date || null);
    case "end_date":
      return fmtDate(p?.end_date || null);
    case "duration":
      return t?.approx_duration || "";
    case "pay_rate": {
      const rates = positions
        .filter((x) => x.show_pay_publicly && x.advertised_pay_rate != null)
        .map((x) => Number(x.advertised_pay_rate));
      if (!rates.length) return "";
      const top = Math.max(...rates);
      return `$${top}/hr`;
    }
    case "per_diem": {
      const v = t?.per_diem_amount;
      if (v == null) return "";
      return `$${v}/day`;
    }
    default:
      return "";
  }
}

const TAG_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export function renderMergeTags(
  text: string | null | undefined,
  ctx: MergeTagContext
): string {
  if (!text) return "";
  const replaced = text.replace(TAG_RE, (_m, tag) => resolveMergeTag(tag, ctx));
  // Collapse multiple whitespaces but preserve newlines
  return replaced
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/ +([,.;:!?])/g, "$1").trim())
    .join("\n");
}

export const AVAILABLE_MERGE_TAGS = [
  "project_name",
  "customer_name",
  "location",
  "start_date",
  "end_date",
  "duration",
  "pay_rate",
  "per_diem",
] as const;
