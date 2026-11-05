import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, ScanLine } from 'lucide-react';
import { badgeId } from '@/lib/badgeRules';

export function BadgeScanner({ onScan, paused = false }: { onScan: (id: string) => void; paused?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onScan); callback.current = onScan;
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [restart, setRestart] = useState(0);
  useEffect(() => {
    if (paused) return;
    let disposed = false; let controls: { stop: () => void } | undefined;
    let accepted = false;
    void import('@zxing/browser').then(async ({ BrowserQRCodeReader }) => {
      if (disposed || !video.current) return;
      const reader = new BrowserQRCodeReader();
      controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, video.current, result => {
        if (disposed || accepted || !result) return;
        const id = badgeId(result.getText());
        if (id) { accepted = true; controls?.stop(); callback.current(id); }
        else setError('This is not an FRG badge.');
      });
      if (disposed) controls.stop();
    }).catch(() => { if (!disposed) setError('Camera unavailable. Allow camera access or enter the badge ID.'); });
    return () => { disposed = true; controls?.stop(); const stream = video.current?.srcObject; if (stream instanceof MediaStream) stream.getTracks().forEach(t => t.stop()); };
  }, [paused, restart]);
  return <section className="space-y-4">
    <h2 className="text-2xl font-semibold flex items-center gap-3"><ScanLine className="h-7 w-7" />Scan your badge</h2>
    <div className="relative aspect-[4/3] max-h-[60dvh] bg-muted overflow-hidden rounded-md"><video ref={video} autoPlay muted playsInline className="h-full w-full object-cover" /><div className="absolute inset-[20%] border-2 border-primary rounded-md pointer-events-none" /></div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex gap-2"><Input aria-label="Badge ID" placeholder="Badge ID" value={manual} onChange={e => setManual(e.target.value)} /><Button aria-label="Use badge ID" disabled={paused || !badgeId(manual)} onClick={() => { const id = badgeId(manual); if (id) callback.current(id); }}><ScanLine className="h-5 w-5" /></Button><Button aria-label="Restart camera" variant="outline" disabled={paused} onClick={() => { setError(''); setRestart(v => v + 1); }}><Camera className="h-5 w-5" /></Button></div>
  </section>;
}
