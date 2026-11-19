export interface OnboardingLinkToken {
  token: string;
  used_at: string | null;
  revoked_at: string | null;
  expires_at: string;
  created_at?: string | null;
}

export function currentOnboardingToken(tokens: OnboardingLinkToken[], now = Date.now()) {
  return tokens.filter(t => !t.used_at && !t.revoked_at && Date.parse(t.expires_at) > now)
    .sort((a, b) => Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? ''))[0] ?? null;
}

export function onboardingLink(token: string, origin: string) {
  return `${origin.replace(/\/$/, '')}/onboard/${encodeURIComponent(token)}`;
}

/** Saving and delivery are separate; retrying delivery must never insert again. */
export async function saveThenSend<T>(save: () => Promise<T>, send: (saved: T) => Promise<string>, shouldSend: boolean) {
  const saved = await save();
  if (!shouldSend) return { saved, link: null, deliveryError: null };
  try { return { saved, link: await send(saved), deliveryError: null }; }
  catch (error) { return { saved, link: null, deliveryError: error instanceof Error ? error.message : 'Onboarding email failed' }; }
}