export const CHECK_WINDOW_MS = 72 * 60 * 60 * 1000;
export const UNOPENED_MS = 24 * 60 * 60 * 1000;
export function deliveryEvent(value: unknown): { event: string; final: string | null } | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const event = value.replace(/^email\./, '');
  return { event, final: ['bounced', 'complained', 'failed'].includes(event) ? event : null };
}
export async function retrieveDelivery(id: string, key: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(`https://api.resend.com/emails/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`Resend [${response.status}]: ${await response.text()}`);
  return deliveryEvent((await response.json()).last_event);
}
