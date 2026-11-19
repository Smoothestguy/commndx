import type { OnboardingLinkToken } from './onboardingLinks';

export function remainingOnboardingDays(expiresAt: string, now = Date.now()) {
  return Math.max(1, Math.ceil((Date.parse(expiresAt) - now) / 86400000));
}

export async function resolveShareToken<T extends OnboardingLinkToken>(current: () => Promise<T | null>, create: () => Promise<T>) {
  const existing = await current();
  return existing ?? await create();
}