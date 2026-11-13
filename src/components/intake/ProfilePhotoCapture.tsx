import { useRef, useState } from "react";
import { Camera, Upload, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { INTAKE_TEXT, IntakeLang } from "@/lib/intakeConsents";
import { uploadPrivateFile } from '@/utils/privateUpload';
import { useSecureUrl } from '@/hooks/useSecureUrl';

/** Center-crops an image file to a square JPEG (max 640px). */
export async function cropSquare(file: File, size = 640): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Unreadable image")); i.src = url;
    });
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const out = Math.min(size, s);
    const c = document.createElement("canvas"); c.width = out; c.height = out;
    const context = c.getContext("2d"); if (!context) throw new Error("Image unavailable");
    context.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, out, out);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Crop failed"))), "image/jpeg", 0.88));
  } finally { URL.revokeObjectURL(url); }
}

export async function uploadProfilePhoto(file: File, bucket = "application-files", folder = "profile-photos"): Promise<string> {
  const blob = await cropSquare(file);
  return (await uploadPrivateFile(bucket, folder, blob)).reference;
}

interface Props {
  lang: IntakeLang;
  value: string | null;
  onChange: (url: string | null) => void;
  consented: boolean;
  required?: boolean;
  error?: string | null;
  onUploadingChange?: (b: boolean) => void;
  onError?: (msg: string) => void;
  disabled?: boolean;
}

export function ProfilePhotoCapture({ lang, value, onChange, consented, required, error, onUploadingChange, onError, disabled }: Props) {
  const t = INTAKE_TEXT[lang];
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const { url: savedPreview } = useSecureUrl('application-files', localPreview ? null : value);
  const locked = !consented || disabled;

  const handle = async (f?: File | null) => {
    if (!f) return;
    setBusy(true); onUploadingChange?.(true);
    try { const uploaded = await uploadProfilePhoto(f); setLocalPreview(URL.createObjectURL(f)); onChange(uploaded); }
    catch (e: any) { onError?.(e?.message || "Upload failed"); }
    finally { setBusy(false); onUploadingChange?.(false); if (camRef.current) camRef.current.value = ""; if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <div className="space-y-2" data-testid="profile-photo-capture">
      <Label>{t.photoTitle}{required && <span className="text-destructive"> *</span>}</Label>
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md border bg-muted flex items-center justify-center">
          {localPreview || savedPreview ? <img src={localPreview || savedPreview || undefined} alt="" className="h-full w-full object-cover" /> : locked ? <Lock className="h-6 w-6 text-muted-foreground" /> : <Camera className="h-6 w-6 text-muted-foreground" />}
        </div>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" disabled={locked || busy} onClick={() => camRef.current?.click()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}{busy ? t.uploading : value ? t.retake : t.takeSelfie}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={locked || busy} onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />{t.upload}
          </Button>
        </div>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => handle(e.target.files?.[0])} data-testid="photo-camera-input" />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handle(e.target.files?.[0])} data-testid="photo-file-input" />
      <p className="text-xs text-muted-foreground">{!consented ? t.photoLocked : t.photoHelp}</p>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
