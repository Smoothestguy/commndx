// Shared applicant-facing email helpers: bulletproof CTA, preheader, and plain-text version.

export function preheader(text: string): string {
  // Hidden preheader text — visible in inbox preview but not in the body.
  return `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${text}</div>`;
}

export function ctaButton(url: string, label: string, bg = "#1d4ed8"): string {
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto;">
  <tr>
    <td bgcolor="${bg}" style="border-radius:8px;">
      <a href="${url}" target="_blank" rel="noopener noreferrer"
         style="display:inline-block;padding:16px 36px;font-size:17px;font-weight:700;color:#ffffff !important;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
        ${label}
      </a>
    </td>
  </tr>
</table>
<p style="text-align:center;margin:8px 0 24px;font-size:14px;color:#374151;">
  Or tap this link:
  <a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;word-break:break-all;">${url}</a>
</p>`;
}

export function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
