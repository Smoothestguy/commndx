import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProjectLocations } from '@/integrations/supabase/hooks/useProjectLocations';
import type { ProjectDocument } from '@/integrations/supabase/hooks/useProjectDocuments';
import { copySigninTemplate } from '@/lib/signinTemplateData';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
export function ReusableSigninPicker({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false), [templateId, setTemplateId] = useState(''), [ids, setIds] = useState<string[]>([]), [busy, setBusy] = useState(false);
  const qc = useQueryClient(); const { data: locations = [] } = useProjectLocations(projectId);
  const { data: templates = [], isLoading, error } = useQuery({ queryKey: ['reusable-signin-templates'], enabled: open, queryFn: async () => { const { data, error } = await supabase.from('project_documents').select('*').eq('is_reusable_template', true).eq('is_signin_template', true).order('file_name'); if (error) throw error; return data as ProjectDocument[]; } });
  return <><Button size="sm" variant="outline" onClick={() => setOpen(true)}><Copy className="h-4 w-4 mr-1" />Use sign-in template</Button><Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Enable sign-in sheets</DialogTitle></DialogHeader>
    {isLoading ? <Loader2 className="animate-spin" /> : error ? <p role="alert">Unable to load reusable templates.</p> : !templates.length ? <p>No reusable sign-in templates available.</p> : <Select value={templateId} onValueChange={setTemplateId}><SelectTrigger aria-label="Reusable template"><SelectValue placeholder="Choose template" /></SelectTrigger><SelectContent>{templates.map(d => <SelectItem key={d.id} value={d.id}>{d.file_name}</SelectItem>)}</SelectContent></Select>}
    <div>{locations.map(l => <label key={l.id} className="flex items-center gap-3 min-h-11"><Checkbox checked={ids.includes(l.id)} onCheckedChange={v => setIds(prev => v ? [...prev, l.id] : prev.filter(id => id !== l.id))} />{l.name}</label>)}</div>
    <Button disabled={!templateId || !ids.length || busy} onClick={async () => { const source = templates.find(d => d.id === templateId); if (!source) return; setBusy(true); try { await copySigninTemplate(source, projectId, ids); qc.invalidateQueries({ queryKey: ['project-documents', projectId] }); setOpen(false); toast.success('Sign-in template added'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Template copy failed'); } finally { setBusy(false); } }}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Enable sheets</Button>
  </DialogContent></Dialog></>;
}