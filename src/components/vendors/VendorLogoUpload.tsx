import {useId, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useUserRole} from '@/hooks/useUserRole';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Loader2, X} from 'lucide-react';
import {toast} from 'sonner';
import {agencyLogo} from '@/lib/agencyPortal';

export function VendorLogoUpload({vendorId,logoUrl}:{vendorId:string;logoUrl?:string|null}) {
 const {isAdmin,isManager}=useUserRole(),queryClient=useQueryClient(),id=useId();
 const [busy,setBusy]=useState(false),[preview,setPreview]=useState<string|null|undefined>(undefined);
 const shown=agencyLogo.parse(preview===undefined?logoUrl:preview);
 if(!isAdmin&&!isManager)return null;
 async function save(url:string|null){
  const {error}=await supabase.from('vendors').update({logo_url:url}).eq('id',vendorId).select('id').single();
  if(error)throw error;setPreview(url);await queryClient.invalidateQueries({queryKey:['vendors']});
 }
 return <section className="space-y-3 border-b pb-4"><Label htmlFor={id}>Logo</Label>{shown&&<img src={shown} alt="Agency logo preview" className="max-h-20 max-w-full object-contain object-left"/>}<div className="flex items-center gap-2"><Input id={id} aria-label="Upload agency logo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file||busy)return;
  if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)){toast.error('Choose a PNG, JPEG, WebP or GIF image');return;}
  if(file.size>5*1024*1024){toast.error('Choose an image smaller than 5 MB');return;}
  setBusy(true);try{
   const extension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}[file.type];
   const path=`agencies/${vendorId}/${crypto.randomUUID()}.${extension}`;
   const {error}=await supabase.storage.from('logos').upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;
   const {data}=supabase.storage.from('logos').getPublicUrl(path);await save(data.publicUrl);toast.success('Agency logo saved');
  }catch{toast.error('Unable to save logo. Please try again.');}finally{setBusy(false);}
 }}/>{shown&&<Button type="button" variant="outline" size="icon" aria-label="Remove agency logo" disabled={busy} onClick={async()=>{setBusy(true);try{await save(null);toast.success('Logo removed');}catch{toast.error('Unable to remove logo');}finally{setBusy(false);}}}><X className="h-4 w-4"/></Button>}{busy&&<Loader2 role="status" aria-label="Saving logo" className="h-4 w-4 animate-spin shrink-0"/>}</div></section>;
}