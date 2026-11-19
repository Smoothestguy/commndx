import { UNOPENED_MS } from './onboardingDelivery.ts';
export function terminalAlertQuery(db: any) {
  return db.from('onboarding_email_deliveries')
    .select('id,final_status,email_keys:onboarding_delivery_alert_keys(event_key)')
    .in('final_status', ['bounced','complained','failed'])
    .like('email_keys.event_key', 'email:%').is('email_keys', null);
}
export function unopenedAlertQuery(db: any, now: number) {
  return db.from('onboarding_email_deliveries')
    .select('id,token:personnel_onboarding_tokens!inner(id,not_opened:onboarding_delivery_alert_keys(event_key))')
    .lte('sent_at', new Date(now - UNOPENED_MS).toISOString())
    .gt('token.expires_at', new Date(now).toISOString())
    .is('token.used_at', null).is('token.revoked_at', null).is('token.first_opened_at', null)
    .like('token.not_opened.event_key', 'token:%:not_opened').is('token.not_opened', null);
}
export async function pendingAlertCandidates(db: any, now = Date.now()) {
  const load = async (query: () => any, event?: string) => {
    const rows: { id: string; event: string }[] = [];
    for (let offset=0; ; offset+=500) {
      const { data, error } = await query().order('id').range(offset,offset+499);
      if (error) throw error;
      for (const row of data ?? []) rows.push({id:row.id,event:event ?? row.final_status});
      if ((data?.length ?? 0) < 500) break;
    }
    return rows;
  };
  const [terminal, unopened] = await Promise.all([load(() => terminalAlertQuery(db)), load(() => unopenedAlertQuery(db,now),'not_opened')]);
  return [...terminal,...unopened];
}