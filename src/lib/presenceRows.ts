import { supabase } from '@/integrations/supabase/client';

export interface PresenceRow { personnelId: string; name: string; signaturePath: string; signedAt: string }

/** Presence-only attestations (dates-only requests with no attendance entry) for one location + date. Never times or money. */
export async function loadPresenceRows(locationId: string, day: string): Promise<PresenceRow[]> {
  const { data, error } = await supabase.from('timesheet_presence_signatures')
    .select('personnel_id,signature_path,signed_at,personnel:personnel_id(first_name,last_name)')
    .eq('location_id', locationId).eq('sign_date', day).limit(1000);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ personnelId: r.personnel_id, name: [r.personnel?.first_name, r.personnel?.last_name].filter(Boolean).join(' ') || 'Unknown', signaturePath: r.signature_path, signedAt: r.signed_at }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Appends a separate "Presence-only attestations (no times recorded)" section; no page when there are none. */
export async function appendPresencePage(bytes: Uint8Array, rows: PresenceRow[], cfg: { day: string; location: string }, loadSignature: (path: string) => Promise<ArrayBuffer>): Promise<Uint8Array> {
  if (!rows.length) return bytes;
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const perPage = 18, rowH = 34, cols = [36, 296], widths = [260, 280];
  for (let p = 0; p < Math.ceil(rows.length / perPage); p++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Presence-only attestations (no times recorded) — ${cfg.location} — ${cfg.day}`.slice(0, 95), { x: 36, y: 750, size: 12, font: bold });
    page.drawText('Signed attestation of presence on this date only. No check-in/out times or hours are recorded for these people.', { x: 36, y: 732, size: 8.5, font });
    const top = 700;
    ['Employee Name', 'Signature'].forEach((h, c) => { page.drawRectangle({ x: cols[c], y: top, width: widths[c], height: 20, borderWidth: 0.5, borderColor: rgb(0, 0, 0) }); page.drawText(h, { x: cols[c] + 4, y: top + 6, size: 9, font: bold }); });
    for (const [i, r] of rows.slice(p * perPage, (p + 1) * perPage).entries()) {
      const y = top - rowH * (i + 1);
      cols.forEach((x, c) => page.drawRectangle({ x, y, width: widths[c], height: rowH, borderWidth: 0.5, borderColor: rgb(0, 0, 0) }));
      page.drawText(r.name.slice(0, 45), { x: cols[0] + 4, y: y + rowH / 2 - 3, size: 9, font });
      try {
        const img = await doc.embedPng(await loadSignature(r.signaturePath));
        const s = Math.min((widths[1] - 8) / img.width, (rowH - 4) / img.height);
        page.drawImage(img, { x: cols[1] + 4, y: y + 2, width: img.width * s, height: img.height * s });
      } catch { page.drawText('(signature on file)', { x: cols[1] + 4, y: y + rowH / 2 - 3, size: 8, font }); }
    }
  }
  return new Uint8Array(await doc.save());
}
