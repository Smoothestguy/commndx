import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Copy, Link2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

type Link = { id: string; expires_at: string };
const urlOf = (id: string) => `${window.location.origin}/catchup/${id}`;

/** Creates (never sends) a location catch-up link + QR; lists live links with revoke. */
export function CatchupLinkButton({ locationId }: { locationId: string }) {
  const [links, setLinks] = useState<Link[] | null>(null), [busy, setBusy] = useState(false), [qr, setQr] = useState<Record<string, string>>({});
  const invoke = async (body: Record<string, unknown>) => { const { data, error } = await supabase.functions.invoke('catchup-link', { body }); if (error || data?.error) throw new Error(data?.error || 'failed'); return data; };
  const load = () => invoke({ action: 'list', location_id: locationId }).then(d => setLinks(d.links)).catch(() => setLinks([]));
  useEffect(() => { void load(); }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { links?.forEach(l => { if (!qr[l.id]) void QRCode.toDataURL(urlOf(l.id), { width: 220, margin: 1 }).then(u => setQr(q => ({ ...q, [l.id]: u }))); }); }, [links]); // eslint-disable-line react-hooks/exhaustive-deps
  const create = async () => { setBusy(true); try { await invoke({ action: 'create', location_id: locationId }); await load(); } catch { toast.error('Could not create link'); } setBusy(false); };
  const revoke = async (id: string) => { setBusy(true); try { await invoke({ action: 'revoke', link_id: id }); await load(); toast.success('Link revoked'); } catch { toast.error('Could not revoke'); } setBusy(false); };
  return <div className="space-y-2 rounded-md border p-3">
    <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">Catch-up links <span className="text-muted-foreground font-normal">· nothing is sent</span></p>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void create()}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Link2 className="h-4 w-4 mr-1" />}Create catch-up link</Button></div>
    {links?.map(l => <div key={l.id} className="flex flex-wrap items-center gap-3 border-t pt-2">
      {qr[l.id] && <img src={qr[l.id]} alt="Catch-up link QR code" className="h-28 w-28 rounded bg-background" />}
      <div className="min-w-0 flex-1 space-y-1"><p className="text-xs break-all font-mono">{urlOf(l.id)}</p><p className="text-xs text-muted-foreground">Expires {new Date(l.expires_at).toLocaleDateString()}</p>
        <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => { void navigator.clipboard.writeText(urlOf(l.id)); toast.success('Link copied'); }}><Copy className="h-3.5 w-3.5 mr-1" />Copy</Button>
          <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => void revoke(l.id)}><X className="h-3.5 w-3.5 mr-1" />Revoke</Button></div></div>
    </div>)}
  </div>;
}
