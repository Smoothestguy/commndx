import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { LinkRow, LinkSection } from '@/components/links/LinkList';

type Link = { id: string; expires_at: string };
const urlOf = (id: string) => `${window.location.origin}/catchup/${id}`;

/** Creates (never sends) a location catch-up link; lists live links with QR on demand and revoke. */
export function CatchupLinkButton({ locationId }: { locationId: string }) {
  const [links, setLinks] = useState<Link[] | null>(null), [busy, setBusy] = useState(false);
  const invoke = async (body: Record<string, unknown>) => { const { data, error } = await supabase.functions.invoke('catchup-link', { body }); if (error || data?.error) throw new Error(data?.error || 'failed'); return data; };
  const load = () => invoke({ action: 'list', location_id: locationId }).then(d => setLinks(d.links)).catch(() => setLinks([]));
  useEffect(() => { void load(); }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps
  const create = async () => { setBusy(true); try { await invoke({ action: 'create', location_id: locationId }); await load(); } catch { toast.error('Could not create link'); } setBusy(false); };
  const revoke = async (id: string) => { setBusy(true); try { await invoke({ action: 'revoke', link_id: id }); await load(); toast.success('Link revoked'); } catch { toast.error('Could not revoke'); } setBusy(false); };
  return <div className="rounded-md border px-3 pb-1 [&>section]:border-t-0 [&>section]:pt-0">
    <LinkSection storageKey={`catchup:${locationId}`} title="Catch-up links" count={links?.length}
      action={<Button size="sm" variant="outline" className="shrink-0" disabled={busy} onClick={() => void create()}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Link2 className="h-4 w-4 mr-1" />}Create link</Button>}>
      <p className="text-[11px] text-muted-foreground py-1">Nothing is sent automatically.</p>
      {links?.map(l => <LinkRow key={l.id} label="Catch-up link" meta={`Expires ${new Date(l.expires_at).toLocaleDateString()}`} url={urlOf(l.id)} qrTitle="Catch-up link" busy={busy} onRevoke={() => void revoke(l.id)} />)}
      {links?.length === 0 && <p className="text-sm text-muted-foreground py-2">No active catch-up links.</p>}
    </LinkSection>
  </div>;
}
