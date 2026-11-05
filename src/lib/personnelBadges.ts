import { supabase } from '@/integrations/supabase/client';
export async function activeBadge(personnelId: string) {
  const { data, error } = await supabase.from('personnel_badges').select('id').eq('personnel_id', personnelId).eq('active', true).maybeSingle();
  if (error) throw error; return data;
}
export async function issueBadge(personnelId: string) {
  const { data, error } = await supabase.functions.invoke('badge-management', { body: { action: 'issue', personnel_id: personnelId } });
  if (error || !data?.id) throw new Error('Badge could not be issued. Try again.'); return data as { id: string };
}
export async function revokeBadge(personnelId: string) {
  const { data, error } = await supabase.functions.invoke('badge-management', { body: { action: 'revoke', personnel_id: personnelId } });
  if (error || !data?.ok) throw new Error('Badge could not be revoked');
}
export async function printBadges(personnelIds: string[]) {
  const [{ jsPDF }, { default: QRCode }] = await Promise.all([import('jspdf'), import('qrcode')]);
  const pdf = new jsPDF({ unit: 'in', format: [3.5, 2.25], orientation: 'landscape' });
  for (const [index, pid] of [...new Set(personnelIds)].entries()) {
    const badge = await activeBadge(pid); if (!badge) throw new Error('Issue badges before printing. No badges were changed.');
    const { data: person, error } = await supabase.from('personnel_directory').select('first_name,last_name,photo_url').eq('id', pid).single();
    if (error) throw error;
    const { data: roles } = await supabase.from('personnel_capabilities').select('capability').eq('personnel_id', pid).limit(1);
    if (index) pdf.addPage([3.5, 2.25], 'landscape');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.text('FAIRFIELD RESPONSE GROUP', .15, .27);
    pdf.setFontSize(13); pdf.text(pdf.splitTextToSize(`${person.first_name} ${person.last_name}`, 2), .15, .6);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.text(pdf.splitTextToSize(roles?.[0]?.capability || 'Personnel', 1.9), .15, 1.05);
    if (person.photo_url) {
      let path = person.photo_url;
      if (path.startsWith('http')) { const match = path.match(/\/storage\/v1\/object\/(?:public|sign)\/personnel-photos\/([^?]+)/); path = match ? decodeURIComponent(match[1]) : ''; }
      if (path) { const { data: image } = await supabase.storage.from('personnel-photos').download(path); if (image) { try { const bytes = new Uint8Array(await image.arrayBuffer()); pdf.addImage(bytes, image.type.includes('png') ? 'PNG' : 'JPEG', .15, 1.2, .7, .7); } catch { /* Unsupported photo format must not hide QR. */ } } }
    }
    const qr = await QRCode.toDataURL(badge.id, { margin: 1, width: 500 }); pdf.addImage(qr, 'PNG', 2.15, .5, 1.2, 1.2);
    pdf.setFontSize(8); pdf.text(`Badge ${badge.id.slice(0, 8)}`, 2.15, 1.9); pdf.text('FRG', .15, 2.1);
  }
  pdf.save('FRG-personnel-badges.pdf');
}