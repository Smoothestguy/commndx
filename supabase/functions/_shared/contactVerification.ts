export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const MAX_SENDS_PER_HOUR = 3;
export function normalizeContact(type: 'email' | 'phone', raw: string): string | null {
  if (type === 'email') { const e = raw.trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null; }
  const d = raw.replace(/\D/g, '').slice(-10); return d.length === 10 ? d : null;
}
export function codeMessage(code: string) {
  return `Your Fairfield verification code is ${code}. Expires in 10 minutes. / Tu código de verificación de Fairfield es ${code}. Vence en 10 minutos.`;
}
export async function hashCode(id: string, code: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${id}:${code}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
