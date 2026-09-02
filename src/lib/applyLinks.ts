// Helpers for public apply links.
//
// - buildApplyUrl: the direct SPA link applicants use (and what QR codes encode).
// - buildApplyShareUrl: routes through the `apply-share` edge function so that
//   link-preview crawlers (SMS/WhatsApp/Facebook/LinkedIn...) get per-job Open
//   Graph tags with Fairfield branding. Humans are redirected to the direct link.

export function buildApplyUrl(token: string): string {
  return `${window.location.origin}/apply/${token}`;
}

export function buildApplyShareUrl(token: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base) return buildApplyUrl(token);
  return `${base.replace(/\/$/, "")}/functions/v1/apply-share/${token}`;
}
