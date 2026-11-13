import { supabase } from '@/integrations/supabase/client';
export async function uploadPrivateFile(bucket: string, folder: string, file: File | Blob) {
  const {data:{session}}=await supabase.auth.getSession();
  if(session){
    const ext=file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':'jpg';
    const path=`${folder}/${crypto.randomUUID()}.${ext}`;
    const {error}=await supabase.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;
    const signed=await supabase.storage.from(bucket).createSignedUrl(path,600);if(signed.error)throw signed.error;
    return {path,reference:supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl,preview:signed.data.signedUrl};
  }
  const segments=window.location.pathname.split('/').filter(Boolean);
  const purpose=segments[0]==='apply'&&segments[1]==='edit'?'edit':({'apply':'apply','quick-apply':'quick','photo':'photo','onboard':'onboard','vendor-onboarding':'vendor'} as Record<string,string>)[segments[0]];
  const token=segments.at(-1);if(!purpose||!token)throw new Error('A valid upload link is required');
  const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const {data,error}=await supabase.functions.invoke('intake-upload',{body:{purpose,token,bucket,folder:folder==='form-uploads'?'form-uploads':folder==='certifications'?'certifications':folder==='profile-photos'?'profile-photos':'uploads',type:file.type,bytes:btoa(binary)}});
  if(error||!data?.reference)throw new Error(data?.error||'Upload unavailable');
  return data as {path:string;reference:string;preview:string};
}