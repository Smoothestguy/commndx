import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Download, Send } from 'lucide-react';
import { useSendDocumentSignatures, useSignatureRecipients, type DocumentSignature } from '@/integrations/supabase/hooks/useDocumentSignatures';
import type { ProjectDocument } from '@/integrations/supabase/hooks/useProjectDocuments';
import { signatureTime } from '@/lib/documentSign';
import { signatureImageUrl, downloadSignedDocument } from '@/utils/signedDocumentExport';
import { toast } from 'sonner';
function SignatureThumbnail({ path }: { path: string }) {
  const { data } = useQuery({ queryKey: ['document-signature-image', path], queryFn: () => signatureImageUrl(path), staleTime: 50 * 60000 });
  return data ? <a href={data} target="_blank" rel="noopener noreferrer"><img loading="lazy" src={data} alt="Signature" className="w-20 h-10 object-contain border rounded" /></a> : null;
}
export function DocumentSignaturePanel({ doc, rows, projectName, canSend, canManage }: { doc: ProjectDocument; rows: DocumentSignature[]; projectName: string; canSend: boolean; canManage: boolean }) {
  const [expanded, setExpanded] = useState(false), [picker, setPicker] = useState(false);
  const [scope, setScope] = useState(doc.location_id ? 'location' : 'project'), [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<{ personnel_id: string; status: string; reason?: string }[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const send = useSendDocumentSignatures(doc.project_id);
  const { data: people = [], isLoading, error } = useSignatureRecipients(doc.project_id, doc.location_id, scope, search, picker);
  const pending = rows.filter(r => r.status === 'pending');
  const sendTo = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      const sent = [];
      for (let i = 0; i < ids.length; i += 100) {
        const batch = await send.mutateAsync({ document_id: doc.id, personnel_ids: ids.slice(i, i + 100) });
        sent.push(...batch.results);
      }
      setResults(sent);
      const failures = sent.filter(r => r.status === 'failed');
      if (failures.length) toast.error(`${failures.length} text request(s) failed. Check results below.`);
      else { toast.success(`${sent.filter(r => r.status === 'sent').length} signature request(s) texted`); setPicker(false); setSelected(new Set()); }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to send requests'); }
  };
  return <div className="border-t pt-2 space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}><Badge variant="outline">Signatures {rows.filter(r => r.status === 'signed').length}/{rows.length}</Badge></Button>
      {canSend && <Button variant="outline" size="sm" onClick={() => { setPicker(true); setResults([]); }}><Send className="h-3.5 w-3.5 mr-1" />Request signatures</Button>}
    </div>
    {expanded && <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{pending.length} missing</span>{canSend && pending.length > 0 && <Button size="sm" variant="outline" disabled={send.isPending} onClick={() => sendTo(pending.map(r => r.personnel_id))}>Remind all pending</Button>}</div>
      {!rows.length && <p className="text-sm text-muted-foreground">No requests yet.</p>}
      {rows.map(row => <div key={row.id} className="flex flex-wrap items-center gap-2 border-b py-2 text-sm">
        <span className="font-medium break-words min-w-0">{row.name}</span><Badge variant={row.status === 'signed' ? 'default' : 'secondary'}>{row.status}</Badge>
        <span className="text-xs text-muted-foreground">{row.signed_at ? signatureTime(row.signed_at) : row.sent_at ? `Texted ${signatureTime(row.sent_at)}` : 'Not texted'}</span>
        {row.signature_url && <SignatureThumbnail path={row.signature_url} />}
        <div className="flex gap-1 ml-auto">
          {canSend && row.status === 'pending' && <Button size="sm" variant="outline" disabled={send.isPending} onClick={() => sendTo([row.personnel_id])}>Remind</Button>}
          {canManage && row.status === 'signed' && <Button size="sm" variant="outline" title="Download signed copy" disabled={downloading === row.id} onClick={async () => { setDownloading(row.id); try { await downloadSignedDocument(doc, row, projectName); } catch (e) { toast.error(e instanceof Error ? e.message : 'Download failed'); } finally { setDownloading(null); } }}>{downloading === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}<span className="ml-1">Signed copy</span></Button>}
        </div>
      </div>)}
    </div>}
    {results.some(r => r.status === 'failed') && <div role="alert" className="text-xs text-destructive">{results.filter(r => r.status === 'failed').map(r => <p key={r.personnel_id}>{rows.find(p => p.personnel_id === r.personnel_id)?.name || people.find(p => p.id === r.personnel_id)?.name || 'Recipient'}: {r.reason}</p>)}</div>}
    <Dialog open={picker} onOpenChange={setPicker}><DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Request signatures</DialogTitle></DialogHeader>
      <p className="text-sm break-words">{doc.file_name}</p>
      <Tabs value={scope} onValueChange={setScope}><TabsList className="w-full">{doc.location_id && <TabsTrigger value="location" className="flex-1 px-2">This location</TabsTrigger>}<TabsTrigger value="project" className="flex-1 px-2">This project</TabsTrigger><TabsTrigger value="all" className="flex-1 px-2">All personnel</TabsTrigger></TabsList></Tabs>
      <Input placeholder="Search personnel" value={search} onChange={e => setSearch(e.target.value)} />
      <div className="max-h-[40vh] overflow-y-auto">{isLoading ? <Loader2 className="animate-spin" /> : error ? <p role="alert">Unable to load personnel.</p> : !people.length ? <p className="text-sm text-muted-foreground">No personnel found.</p> : people.map(p => <label key={p.id} className="flex items-center gap-3 min-h-11 border-b py-2"><Checkbox checked={selected.has(p.id)} disabled={rows.some(r => r.personnel_id === p.id && r.status === 'signed')} onCheckedChange={v => setSelected(prev => { const next = new Set(prev); if (v) next.add(p.id); else next.delete(p.id); return next; })} /><span>{p.name}</span>{rows.some(r => r.personnel_id === p.id && r.status === 'signed') && <Badge variant="outline">Signed</Badge>}</label>)}</div>
      <Button disabled={!selected.size || selected.size > 100 || send.isPending} onClick={() => sendTo([...selected])}>{send.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send ({selected.size})</Button>
    </DialogContent></Dialog>
  </div>;
}
