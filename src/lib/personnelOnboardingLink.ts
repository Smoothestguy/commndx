import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { currentOnboardingToken, onboardingLink } from './onboardingLinks';

export async function getCurrentPersonnelOnboardingLink(personnelId: string) {
  const { data, error } = await supabase.from('personnel_onboarding_tokens')
    .select('token,used_at,revoked_at,expires_at,created_at')
    .eq('personnel_id', personnelId).is('used_at', null).is('revoked_at', null)
    .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  const token = currentOnboardingToken(data ?? []);
  return token ? onboardingLink(token.token, window.location.origin) : null;
}

export async function sendPersonnelOnboardingLink(person: { id: string; email: string; first_name: string; last_name: string }) {
  const { data, error } = await supabase.functions.invoke('send-personnel-onboarding-email', {
    body: { personnelId: person.id, email: person.email, firstName: person.first_name, lastName: person.last_name },
  });
  if (error) {
    const detail = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    let message = detail;
    try { message = JSON.parse(detail).error ?? detail; } catch { /* plain-text failure */ }
    throw new Error(message);
  }
  if (!data?.success) throw new Error(data?.error ?? 'Onboarding email failed');
  if (typeof data.token === 'string') return onboardingLink(data.token, window.location.origin);
  const link = await getCurrentPersonnelOnboardingLink(person.id);
  if (!link) throw new Error('Email sent, but the onboarding link could not be loaded. Open the profile to retry copying.');
  return link;
}