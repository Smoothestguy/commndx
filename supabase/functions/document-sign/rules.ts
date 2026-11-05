export const canSendSignatures = (roles: string[]) => roles.some(role => ['admin', 'manager', 'user'].includes(role));
export const signatureExpired = (expiresAt: string, now = Date.now()) => new Date(expiresAt).getTime() <= now;
export const validSignaturePng = (bytes: Uint8Array) => bytes.length >= 24 && bytes.length <= 204800 && [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n);
