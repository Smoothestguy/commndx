// Tokenized personnel search → PostgREST or() groups (AND across tokens, OR across fields).
// Characters that break or() syntax are stripped; values are double-quoted.
const UNSAFE = /[,()%*\\":;'`{}[\]<>|&!]/g;

export function personnelSearchGroups(raw: string | null | undefined): string[] {
  const input = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!input) return [];
  // Pure phone-ish input ("(980) 501-2303", "980.501.2303", "+1 980…") → one digits token.
  if (/^[\d\s()+.\-]+$/.test(input)) {
    let digits = input.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
    if (!digits) return [];
    return [`phone.ilike."%${digits}%",personnel_number.ilike."%${digits}%"`];
  }
  return input.split(" ").map(tok => tok.replace(UNSAFE, "")).filter(Boolean).map(tok => {
    const parts = ["first_name", "last_name", "email", "personnel_number"].map(c => `${c}.ilike."%${tok}%"`);
    const digits = tok.replace(/\D/g, "");
    if (digits.length >= 3 && digits.length === tok.replace(/[\s()+.\-]/g, "").length) parts.push(`phone.ilike."%${digits}%"`);
    return parts.join(",");
  });
}

/** Same rule for client-side filtering of already-loaded rows. */
export function personnelMatches(p: { first_name?: string | null; last_name?: string | null; email?: string | null; personnel_number?: string | null; phone?: string | null }, raw: string): boolean {
  const input = String(raw ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!input) return true;
  const phone = String(p.phone ?? "").replace(/\D/g, "");
  if (/^[\d\s()+.\-]+$/.test(input)) {
    let d = input.replace(/\D/g, ""); if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
    return !!d && (phone.includes(d) || String(p.personnel_number ?? "").includes(d));
  }
  const fields = [p.first_name, p.last_name, p.email, p.personnel_number].map(v => String(v ?? "").replace(/\s+/g, " ").toLowerCase());
  return input.split(" ").map(t => t.replace(UNSAFE, "")).filter(Boolean).every(t => {
    const d = t.replace(/\D/g, "");
    return fields.some(f => f.includes(t)) || (d.length >= 3 && d.length === t.replace(/[\s()+.\-]/g, "").length && phone.includes(d));
  });
}
