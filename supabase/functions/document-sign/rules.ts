export const canSendSignatures = (roles: string[]) => roles.some(role => ['admin', 'manager', 'user'].includes(role));
export const signatureExpired = (expiresAt: string, now = Date.now()) => new Date(expiresAt).getTime() <= now;
export { validSignaturePng } from '../_shared/signatureRules.ts';
