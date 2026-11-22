import { supabase } from '@/integrations/supabase/client';

export interface MobeRow { id: string; personnelId: string; name: string; origin: string; travelHours: number; kind: 'mobe' | 'demobe' }

/** Origin from the TO-generated description: "MOBE travel from Fort Myers — …" → "Fort Myers"; local / zero-hour → "Local". */
export function mobeOrigin(description: string | null | undefined, hours: number): string {
  const d = String(description ?? '');
  const m = d.match(/\bfrom\s+(.+?)\s*(?:—|-{1,2}\s|\(|$)/i);
  if (m && m[1].trim() && !/^local$/i.test(m[1].trim())) return m[1].trim();
  return hours > 0 && !/\blocal\b/i.test(d) ? '—' : 'Local';
}
export const travelLabel = (h: number) => (h > 0 ? h.toFixed(2) : 'Local');
/** Day headcount = people worked onsite + MOBE/DEMOBE rows for that location/date. */
export const dayHeadcount = (onsite: number, mobe: number) => onsite + mobe;

/** Hours-only projection of MOBE/DEMOBE time entries for one location + local date (no money columns). */
export async function loadMobeRows(locationId: string, day: string): Promise<MobeRow[]> {
  const { data, error } = await supabase.from('time_entries')
    .select('id,personnel_id,hours,description,entry_source,personnel:personnel_id(first_name,last_name)')
    .eq('location_id', locationId).eq('entry_date', day).in('entry_source', ['mobe', 'demobe']).limit(1000);
  if (error) throw error;
  return (data ?? []).map((r: any) => {
    const hours = Number(r.hours ?? 0);
    return { id: r.id, personnelId: r.personnel_id ?? '', name: [r.personnel?.first_name, r.personnel?.last_name].filter(Boolean).join(' ') || 'Unknown', origin: mobeOrigin(r.description, hours), travelHours: hours, kind: r.entry_source };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/** Appends a MOBE section page (name, origin, travel hours) and the day total to a generated sheet PDF. */
export async function appendMobePage(bytes: Uint8Array, mobe: MobeRow[], cfg: { day: string; location: string; onsite: number }): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const total = `Day total: ${cfg.onsite} worked + ${mobe.length} MOBE = ${dayHeadcount(cfg.onsite, mobe.length)}`;
  const perPage = 30, cols = [36, 276, 466], widths = [240, 190, 110];
  for (let p = 0; p < Math.max(1, Math.ceil(mobe.length / perPage)); p++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`MOBE — ${cfg.location} — ${cfg.day}`, { x: 36, y: 750, size: 13, font: bold });
    page.drawText(total, { x: 36, y: 730, size: 10, font });
    const top = 705;
    ['Employee Name', 'Origin', 'Travel Hours'].forEach((h, c) => { page.drawRectangle({ x: cols[c], y: top - 6, width: widths[c], height: 20, borderWidth: 0.5, borderColor: rgb(0, 0, 0) }); page.drawText(h, { x: cols[c] + 4, y: top, size: 9, font: bold }); });
    mobe.slice(p * perPage, (p + 1) * perPage).forEach((r, i) => {
      const y = top - 20 * (i + 1);
      [r.name + (r.kind === 'demobe' ? ' (DEMOBE)' : ''), r.origin, travelLabel(r.travelHours)].forEach((v, c) => {
        page.drawRectangle({ x: cols[c], y: y - 6, width: widths[c], height: 20, borderWidth: 0.5, borderColor: rgb(0, 0, 0) });
        page.drawText(v.slice(0, 45), { x: cols[c] + 4, y, size: 9, font });
      });
    });
    if (!mobe.length) page.drawText('No MOBE rows for this day.', { x: 36, y: top - 24, size: 9, font });
  }
  return new Uint8Array(await doc.save());
}
