import { z } from 'zod';
export const joinToken = z.string().uuid();
export const joinInfoSchema = z.object({ valid: z.boolean(), project_name: z.string().optional(), location_name: z.string().nullable().optional(), role_label: z.string().nullable().optional() });
export const joinResultSchema = z.object({ ok: z.boolean(), reason: z.string().optional(), status: z.string().optional(), first_name: z.string().optional(), punch_token: z.string().uuid().nullable().optional() });
export const joinFormSchema = z.object({
  first: z.string().trim().min(2, 'Enter your first name / Escribe tu nombre').max(60),
  last: z.string().trim().min(2, 'Enter your last name / Escribe tu apellido').max(60),
  phone: z.string().refine(v => /^(1)?\d{10}$/.test(v.replace(/\D/g, '')), 'Enter a 10-digit mobile number / Escribe un número móvil de 10 dígitos'),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email / Escribe un correo válido').max(120)]),
});
export function joinExpiry(days: number, now = new Date()) {
  if (!Number.isInteger(days) || days < 1) throw new Error('Expiry must be at least one day');
  return new Date(now.getTime() + days * 86400000).toISOString();
}
export function publicJoinUrl(token: string, origin = window.location.origin) {
  const host = new URL(origin).hostname;
  const base = host === 'localhost' || host.endsWith('.lovable.app') ? 'https://fairfieldrg.com' : origin;
  return `${base}/join/${token}`;
}