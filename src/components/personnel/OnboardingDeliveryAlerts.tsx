import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Copy, Send, Mail } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { getCurrentPersonnelOnboardingLink, sendPersonnelOnboardingLink } from '@/lib/personnelOnboardingLink';
import { toast } from 'sonner';
export function OnboardingDeliveryBadges({ personnelId }: { personnelId: string }) {
  const { isAdmin, isManager } = useUserRole();
  const { data } = useQuery({ queryKey: ['onboarding-delivery-warning', personnelId], enabled: isAdmin || isManager, refetchInterval: 15000,
    queryFn: async () => { const { data, error } = await supabase.rpc('get_onboarding_delivery_warning', { p_personnel_id: personnelId }); if (error) throw error; return data as { email_bounced?: boolean; not_opened?: boolean }; } });
  return <>{data?.email_bounced && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Email bounced</Badge>}{data?.not_opened && <Badge variant="outline" className="gap-1 text-destructive"><AlertTriangle className="h-3 w-3" />Onboarding link not opened</Badge>}</>;
}
export function OnboardingNotificationActions({ personnelId }: { personnelId: string | null }) {
  const { isAdmin } = useUserRole(); const navigate = useNavigate(); const [busy, setBusy] = useState(false);
  if (!isAdmin || !personnelId) return null;
  const perform = async (resend: boolean) => {
    setBusy(true);
    try {
      if (resend) {
        const { data, error } = await supabase.from('personnel').select('id,email,first_name,last_name,onboarding_status').eq('id', personnelId).single();
        if (error || !data) throw error ?? new Error('Person not found');
        if (['completed', 'revoked'].includes(data.onboarding_status ?? '')) throw new Error('Open the profile to review onboarding status.');
        await sendPersonnelOnboardingLink(data); toast.success('Onboarding email sent');
      } else {
        const link = await getCurrentPersonnelOnboardingLink(personnelId);
        if (!link) throw new Error('No valid link. Use Resend onboarding to send a new one.');
        await navigator.clipboard.writeText(link); toast.success('Link copied');
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Action failed'); } finally { setBusy(false); }
  };
  return <div className="flex flex-wrap gap-1 mt-2" onClick={e => e.stopPropagation()}>
    <Button size="sm" variant="outline" disabled={busy} onClick={() => void perform(false)}><Copy className="h-3 w-3 mr-1" />Copy link</Button>
    <Button size="sm" variant="outline" disabled={busy} onClick={() => void perform(true)}><Send className="h-3 w-3 mr-1" />Resend onboarding</Button>
    <Button size="sm" variant="outline" onClick={() => navigate(`/personnel/${personnelId}?edit=true`)}><Mail className="h-3 w-3 mr-1" />Edit email</Button>
  </div>;
}
