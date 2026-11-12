import { z } from 'zod';
import { agencyLogo } from './agencyPortal';
export const joinToken = z.string().uuid();
export const joinInfoSchema = z.object({ valid: z.boolean(), project_name: z.string().optional(), location_name: z.string().nullable().optional(), role_label: z.string().nullable().optional(), agency_name: z.string().nullable().optional(), agency_logo_url: agencyLogo });
// Strip unexpected identity/link fields: public registration never exposes approval evidence.
export const joinResultSchema = z.object({ ok: z.boolean(), reason: z.string().optional(), status: z.literal('pending').optional() });
export const joinApprovalSchema = z.object({ ok: z.boolean(), reason: z.string().optional(), personnel_id: z.string().uuid().optional(), punch_token: z.string().uuid().nullable().optional(), phone: z.string().optional(), first_name: z.string().optional() });
export const canReviewJoinRequests = (role: string | null | undefined) => ['admin', 'manager', 'user'].includes(role || '');
export function pendingJoinRequests<T extends { status: string; location_id: string | null }>(rows: T[], locationId?: string) {
  return rows.filter(r => r.status === 'pending' && (!locationId || r.location_id === locationId));
}
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