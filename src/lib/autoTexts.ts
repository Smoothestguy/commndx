export * from '../../supabase/functions/_shared/autoTextEligibility';
import { supabase } from '@/integrations/supabase/client';
import { loadAutoTextContext, checkEligibility } from '../../supabase/functions/_shared/autoTextEligibility';

/** Manual sends: same hard rules as automatic texts. Returns ids that fail them, with a reason. */
export async function manualTextIneligible(locationId: string, personnelIds: string[]) {
  if (!personnelIds.length) return [] as { id: string; reason: string }[];
  const ctx = await loadAutoTextContext(supabase, [locationId], personnelIds);
  return personnelIds.flatMap(id => { const r = checkEligibility(ctx, id, locationId); return r ? [{ id, reason: r }] : []; });
}
/** Asks before texting people who fail the rules. Default (OK) skips them. Returns ids to send, or null to cancel. */
export async function confirmManualRecipients(locationId: string, personnelIds: string[], names: Record<string, string> = {}) {
  let bad: { id: string; reason: string }[];
  try { bad = await manualTextIneligible(locationId, personnelIds); } catch { return personnelIds; }
  if (!bad.length) return personnelIds;
  const list = bad.slice(0, 8).map(b => `• ${names[b.id] || 'Person'} — ${b.reason}`).join('\n');
  const msg = `${bad.length} of ${personnelIds.length} are demobilized/unassigned or otherwise not eligible:\n${list}${bad.length > 8 ? '\n…' : ''}\n\nSkip them? (OK = skip them, Cancel = more choices)`;
  if (window.confirm(msg)) return personnelIds.filter(id => !bad.some(b => b.id === id));
  if (window.confirm(`Send to all ${personnelIds.length}, including the ${bad.length} not eligible?`)) return personnelIds;
  return null;
}
