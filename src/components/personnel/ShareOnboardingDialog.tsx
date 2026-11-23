import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createPersonnelOnboardingToken, getCurrentPersonnelOnboardingToken } from '@/lib/personnelOnboardingLink';
import { onboardingLink } from '@/lib/onboardingLinks';
import { remainingOnboardingDays, resolveShareToken } from '@/lib/onboardingShare';

type Person = { id: string; email: string; first_name: string; last_name: string };
export function ShareOnboardingDialog({ person, open, onOpenChange }: { person: Person; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [message, setMessage] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState(false); const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    let live = true; setLoading(true); setError(false);
    resolveShareToken(() => getCurrentPersonnelOnboardingToken(person.id), () => createPersonnelOnboardingToken(person)).then(token => {
      if (!live) return;
      const days = remainingOnboardingDays(token.expires_at); const link = onboardingLink(token.token, window.location.origin);
      setMessage(`Fairfield Response Group\nHi ${person.first_name}, please complete your onboarding here. / Hola ${person.first_name}, por favor complete su registro aquí.\n${link}\nExpires in ${days} ${days === 1 ? 'day' : 'days'} / Vence en ${days} ${days === 1 ? 'día' : 'días'}`);
    }).catch(() => { if (live) setError(true); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [open, person.id, retry]);
  return <Dialog open={open} onOpenChange={value => { if (!loading) onOpenChange(value); }}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Share onboarding link</DialogTitle></DialogHeader>
    {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" aria-label="Loading link" /></div> : error ? <div className="space-y-3"><p role="alert">Could not load the onboarding link.</p><Button onClick={() => setRetry(value => value + 1)}>Retry</Button></div> : <><Textarea aria-label="Onboarding message" value={message} onChange={e => setMessage(e.target.value)} className="min-h-44" /><div className="flex justify-end"><Button onClick={async () => { try { await navigator.clipboard.writeText(message); toast.success('Message copied'); } catch { toast.error('Could not copy message'); } }}><Copy className="h-4 w-4 mr-2" />Copy</Button></div></>}
  </DialogContent></Dialog>;
}
