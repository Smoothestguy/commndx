import { useRef, useState, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function SelfieCapture({ onCapture, disabled }: { onCapture: (base64: string) => void; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(''); const [error, setError] = useState('');
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const capture = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) { setError('Choose a photo under 20 MB.'); return; }
    try {
      const image = await createImageBitmap(file); const scale = Math.min(1, 800 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Camera image unavailable');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height); image.close();
      const data = canvas.toDataURL('image/jpeg', .8); onCapture(data.split(',')[1]); setPreview(URL.createObjectURL(file)); setError('');
    } catch { setError('This photo could not be opened. Take another photo.'); }
  };
  return <div className="space-y-3"><input ref={input} type="file" accept="image/*" capture="user" className="sr-only" aria-label="Take a selfie" disabled={disabled} onChange={e => void capture(e.target.files?.[0])} />
    {preview && <img src={preview} alt="Your verification selfie" className="h-40 w-40 rounded-md object-cover mx-auto" />}
    <Button size="lg" variant="outline" className="w-full h-14" disabled={disabled} onClick={() => input.current?.click()}><Camera className="h-5 w-5 mr-2" />{preview ? 'Retake selfie' : 'Take a selfie'}</Button>{error && <p role="alert" className="text-destructive">{error}</p>}</div>;
}