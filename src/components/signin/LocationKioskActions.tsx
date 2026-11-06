import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ProjectLocation } from '@/integrations/supabase/hooks/useProjectLocations';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Copy, QrCode, Tablet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { kioskMode, type KioskMode } from '@/lib/badgeRules';
export async function kioskLink(location: ProjectLocation, mode: KioskMode = 'search') {
 const { data, error } = await supabase.from('kiosk_tokens').select('id,expires_at').eq('location_id',location.id).eq('mode',mode).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1);if(error)throw error;
 let token=data?.[0];if(!token){const {data:{user}}=await supabase.auth.getUser();const result=await supabase.from('kiosk_tokens').insert({location_id:location.id,label:location.name,mode,created_by:user?.id}).select('id,expires_at').single();if(result.error)throw result.error;token=result.data;}
 const origin=window.location.hostname==='localhost'||window.location.hostname.includes('lovable.app')?'https://fairfieldrg.com':window.location.origin;return {url:`${origin}/kiosk/${token.id}?m=${mode}`,expires:token.expires_at};
}
export async function qrPoster(location:ProjectLocation,url:string){
 const [{default:QRCode},{jsPDF}]=await Promise.all([import('qrcode'),import('jspdf')]);const qr=await QRCode.toDataURL(url,{width:1000,margin:2,errorCorrectionLevel:'M'});const pdf=new jsPDF({format:'letter',unit:'pt'});pdf.setFont('helvetica','bold');pdf.setFontSize(26);pdf.text('FAIRFIELD RESPONSE GROUP',306,65,{align:'center'});pdf.setFontSize(22);const names=pdf.splitTextToSize(location.name,510);pdf.text(names,306,110,{align:'center'});pdf.setFont('helvetica','normal');pdf.setFontSize(12);const address=[location.address,location.city,location.state,location.zip].filter(Boolean).join(', ');pdf.text(pdf.splitTextToSize(address,510),306,165,{align:'center'});pdf.addImage(qr,'PNG',126,210,360,360);pdf.setFontSize(20);pdf.text('Scan to sign in',306,615,{align:'center'});pdf.text('Escanea para registrarte',306,646,{align:'center'});pdf.setFontSize(18);pdf.text('(281) 748-3832',306,710,{align:'center'});pdf.save(`${location.name.replace(/[^\w -]/g,'')}-QR-poster.pdf`);
}
export function LocationKioskActions({location,initialOpen=false}:{location:ProjectLocation;initialOpen?:boolean}){
 const [link,setLink]=useState<{url:string;expires:string}|null>(null),[busy,setBusy]=useState(false),[mode,setMode]=useState<KioskMode>('search');
 const run=async(poster:boolean)=>{setBusy(true);try{const value=await kioskLink(location,mode);if(poster)await qrPoster(location,value.url);else setLink(value);}catch(e){toast.error(e instanceof Error?e.message:'Kiosk link failed');}finally{setBusy(false);}};
 useEffect(()=>{if(initialOpen)void run(false);},[initialOpen]);
 return <><div className="flex flex-wrap gap-2"><Select value={mode} disabled={busy} onValueChange={v=>{setMode(kioskMode(v));setLink(null);}}><SelectTrigger aria-label="Kiosk privacy mode" className="w-36 h-9"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="search">Search</SelectItem><SelectItem value="roster">Roster</SelectItem><SelectItem value="badge">Badge</SelectItem></SelectContent></Select><Button size="sm" variant="outline" disabled={busy} onClick={()=>run(false)}><Tablet className="h-4 w-4 mr-1"/>Kiosk link</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>run(true)}><QrCode className="h-4 w-4 mr-1"/>QR poster (PDF)</Button>{busy&&<Loader2 className="h-4 w-4 animate-spin"/>}</div><Dialog open={!!link} onOpenChange={open=>{if(!open)setLink(null);}}><DialogContent><DialogHeader><DialogTitle>Kiosk link — {location.name}</DialogTitle></DialogHeader><Input aria-label="Kiosk URL" value={link?.url||''} readOnly/><p className="text-sm text-muted-foreground">Expires {link?.expires?new Date(link.expires).toLocaleDateString():''}</p><Button onClick={async()=>{try{await navigator.clipboard.writeText(link?.url||'');toast.success('Kiosk link copied');}catch{toast.error('Select and copy the link');}}}><Copy className="h-4 w-4 mr-1"/>Copy link</Button></DialogContent></Dialog></>;
}
