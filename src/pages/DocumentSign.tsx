import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, FileText, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { SignaturePad } from '@/components/documents/SignaturePad';
import { documentSign, signatureTime } from '@/lib/documentSign';
import { toast } from 'sonner';
interface Info { first_name: string; title: string; notes: string | null; already_signed: boolean; signed_at: string | null; pdf_url: string; has_fields?: boolean; }
function gps(): Promise<{ lat: number | null; lng: number | null }> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve({ lat: null, lng: null }), 4000);
    if (!navigator.geolocation) { clearTimeout(timer); resolve({ lat: null, lng: null }); return; }
    navigator.geolocation.getCurrentPosition(p => { clearTimeout(timer); resolve({ lat: p.coords.latitude, lng: p.coords.longitude }); }, () => { clearTimeout(timer); resolve({ lat: null, lng: null }); }, { timeout: 4000, maximumAge: 0 });
  });
}
export default function DocumentSign() {
  const { token } = useParams();
  const [info, setInfo] = useState<Info | null>(null), [error, setError] = useState(''), [name, setName] = useState('');
  const [pad, setPad] = useState(false), [png, setPng] = useState<string | null>(null), [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    documentSign<Info>({ action: 'info', token }).then(data => { if (active) { setInfo(data); setName(data.first_name || ''); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [token]);
  const submit = async () => {
    if (!png || !name.trim() || saving) return;
    setSaving(true);
    try {
      const coords = await gps();
      const result = await documentSign<{ signed_at: string }>({ action: 'sign', token, signature_png_base64: png, sign_name: name.trim(), ...coords });
      setInfo(prev => prev ? { ...prev, already_signed: true, signed_at: result.signed_at } : prev);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to sign. Please try again.'); }
    finally { setSaving(false); }
  };
  return <main className="min-h-screen bg-background text-foreground px-4 py-6">
    <div className="max-w-2xl mx-auto space-y-5">
      <p className="text-sm font-semibold text-primary">Fairfield Response Group</p>
      {error ? <div role="alert" className="space-y-3"><h1 className="text-xl font-semibold">{error}</h1><p>Call the office: <a className="text-primary underline" href="tel:+12817483832">(281) 748-3832</a></p></div> : !info ? <Loader2 className="animate-spin mx-auto" aria-label="Loading document" /> : info.already_signed ? <div className="py-12 text-center space-y-3"><CheckCircle2 className="h-14 w-14 mx-auto text-primary" /><h1 className="text-xl font-semibold">Signed {info.signed_at ? signatureTime(info.signed_at) : ''} ✓</h1><p className="text-muted-foreground">Firmado. Gracias — su firma ha sido guardada.</p><p>{info.title}</p></div> : <>
        <h1 className="text-2xl font-semibold break-words flex items-start gap-2"><FileText className="h-6 w-6 shrink-0 mt-1" />{info.title}</h1>
        <iframe src={info.pdf_url} title={info.title} className="w-full h-[48vh] border rounded-md bg-muted" />
        {info.has_fields && <p className="text-sm text-muted-foreground">Your signature will be placed on the document where indicated.</p>}
        <a href={info.pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline"><ExternalLink className="h-4 w-4" />Open PDF</a>
        {info.notes && <p className="whitespace-pre-wrap break-words">{info.notes}</p>}
        <label className="block space-y-2"><span>I,</span><Input aria-label="Signer name" value={name} onChange={e => setName(e.target.value)} maxLength={150} /><span className="block">have read and agree to this document.</span></label>
        {png && <img src={png} alt="Your signature" className="h-24 max-w-full object-contain border rounded-md" />}
        <Button variant="outline" className="w-full h-12" disabled={!name.trim() || saving} onClick={() => setPad(true)}>{png ? 'Redraw signature' : 'Sign with your finger'}</Button>
        <Button className="w-full h-12" disabled={!png || !name.trim() || saving} onClick={submit}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit signature</Button>
      </>}
    </div>
    <Dialog open={pad} onOpenChange={setPad}><DialogContent className="w-screen max-w-none h-[100dvh] p-0 rounded-none flex flex-col [&>button]:hidden"><DialogTitle className="sr-only">Sign document</DialogTitle><SignaturePad name={name} description="I have read and agree to this document." saving={false} onSkip={() => setPad(false)} onSave={blob => { const reader = new FileReader(); reader.onload = () => { setPng(String(reader.result)); setPad(false); }; reader.readAsDataURL(blob); }} /></DialogContent></Dialog>
  </main>;
}
