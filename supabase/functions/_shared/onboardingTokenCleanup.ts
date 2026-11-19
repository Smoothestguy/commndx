export async function revokeOlderOnboardingTokens(db: any, personnelId: string, newTokenId: string, now = new Date().toISOString()) {
  const { error } = await db.from('personnel_onboarding_tokens').update({ revoked_at: now }).eq('personnel_id', personnelId).neq('id', newTokenId).is('used_at', null).is('revoked_at', null);
  if (error) throw error;
}