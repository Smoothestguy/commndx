import { useEffect, useState, type ReactNode } from 'react';
import { useSessionState } from '@/hooks/useSessionState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, Copy, MessageSquare, MoreHorizontal, QrCode, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export async function copyLink(text: string, done = 'Link copied') {
  try { await navigator.clipboard.writeText(text); toast.success(done); } catch { toast.error('Select and copy the link'); }
}

/** QR shown only on demand, in a dialog — never inline in lists. */
export function QrDialog({ url, title = 'QR code', open, onOpenChange }: { url: string; title?: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [qr, setQr] = useState('');
  useEffect(() => {
    let live = true; setQr('');
    if (open && url) import('qrcode').then(({ default: QR }) => QR.toDataURL(url, { width: 320, margin: 2 })).then(v => { if (live) setQr(v); }).catch(() => { if (live) toast.error('Unable to create QR code'); });
    return () => { live = false; };
  }, [open, url]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
    <div className="flex flex-col items-center gap-3">{qr ? <img src={qr} alt={`${title} QR code`} className="w-64 h-64 rounded bg-white" /> : <div className="w-64 h-64 rounded bg-muted animate-pulse" />}
      <p className="text-xs font-mono break-all text-muted-foreground text-center">{url}</p>
      <Button variant="outline" size="sm" onClick={() => void copyLink(url)}><Copy className="h-4 w-4 mr-1" />Copy link</Button></div>
  </DialogContent></Dialog>;
}

/** Collapsible list section, closed by default; open state remembered per session. */
export function LinkSection({ storageKey, title, count, action, children, className }: { storageKey: string; title: string; count?: number; action?: ReactNode; children: ReactNode; className?: string }) {
  const [open, setOpen] = useSessionState<boolean>(`links-open:${storageKey}`, false);
  return <section className={cn('border-t pt-2', className)}>
    <div className="flex items-center gap-2 min-h-11">
      <button type="button" className="flex flex-1 min-w-0 items-center gap-2 text-left text-sm font-semibold" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', !open && '-rotate-90')} />
        <span className="truncate">{title}</span>{count != null && <Badge variant="secondary" className="h-5 px-1.5 text-xs">{count}</Badge>}
      </button>{action}
    </div>
    {open && <div className="divide-y">{children}</div>}
  </section>;
}

/** One compact ~44px link row: label, small meta, Copy / QR / Text, revoke in ⋯. */
export function LinkRow({ label, meta, url, copyText, smsText, qrTitle, onRevoke, revokeLabel = 'Revoke', busy, highlight }: { label: ReactNode; meta?: ReactNode; url: string; copyText?: string; smsText?: string; qrTitle?: string; onRevoke?: () => void; revokeLabel?: string; busy?: boolean; highlight?: boolean }) {
  const [qrOpen, setQrOpen] = useState(false);
  return <div className={cn('flex items-center gap-1 min-h-11 py-1', highlight && 'bg-accent/40 -mx-1 px-1 rounded')}>
    <div className="flex-1 min-w-0"><p className="text-sm truncate">{label}</p>{meta && <p className="text-[11px] leading-tight text-muted-foreground truncate">{meta}</p>}</div>
    <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label="Copy link" title="Copy link" onClick={() => void copyLink(copyText ?? url)}><Copy className="h-4 w-4" /></Button>
    <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label="Show QR code" title="QR code" onClick={() => setQrOpen(true)}><QrCode className="h-4 w-4" /></Button>
    {smsText && <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" asChild><a href={`sms:?body=${encodeURIComponent(smsText)}`} aria-label="Text link" title="Text link"><MessageSquare className="h-4 w-4" /></a></Button>}
    {onRevoke && <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label="More link actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end"><DropdownMenuItem disabled={busy} className="text-destructive" onSelect={onRevoke}><X className="h-4 w-4 mr-2" />{revokeLabel}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
    <QrDialog url={url} title={qrTitle} open={qrOpen} onOpenChange={setQrOpen} />
  </div>;
}
