import jsPDF from "jspdf";
import { format } from "date-fns";
import { PDF_COLORS, PDF_MARGIN, setColor } from "./pdfHelpers";
import { loadImage } from "./signInSheetPdf";
import type { TrailRow } from "@/integrations/supabase/hooks/useFieldMode";

/** Per-person time log from personnel_location_trail rows (one person, one window). */
export async function generateTimeLogPDF(d: { personName: string; projectName: string; from: string; to: string; rows: TrailRow[] }) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = PDF_MARGIN;
  let y = 20;

  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  setColor(doc, PDF_COLORS.primary);
  doc.text("Fairfield Response Group", pw / 2, y, { align: "center" }); y += 8;
  setColor(doc, PDF_COLORS.black); doc.setFontSize(14);
  doc.text("PERSONNEL TIME LOG", pw / 2, y, { align: "center" }); y += 8;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text(d.personName, pw / 2, y, { align: "center" }); y += 6;
  const fmtD = (s: string) => format(new Date(s + "T12:00:00"), "MMM d, yyyy");
  doc.text(`${d.projectName} — ${fmtD(d.from)} to ${fmtD(d.to)}`, pw / 2, y, { align: "center" }); y += 10;

  const rows = [...d.rows].sort((a, b) => a.in_at.localeCompare(b.in_at));
  // signature per day: any row that day
  const sigByDay: Record<string, string> = {};
  for (const r of rows) { const k = format(new Date(r.in_at), "yyyy-MM-dd"); if (r.signature_url && !sigByDay[k]) sigByDay[k] = r.signature_url; }
  const imgs: Record<string, Awaited<ReturnType<typeof loadImage>>> = {};
  await Promise.all(Object.entries(sigByDay).map(async ([k, u]) => { imgs[k] = await loadImage(u); }));

  const cols = [m, m + 24, m + 84, m + 108, m + 132, m + 150];
  const header = () => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    ["Date", "Location", "In", "Out", "Hours", "Signature"].forEach((h, i) => doc.text(h, cols[i], y));
    y += 2; doc.line(m, y, pw - m, y); y += 5; doc.setFont("helvetica", "normal");
  };
  header();
  let total = 0;
  for (const r of rows) {
    if (y + 10 > ph - 25) { doc.addPage(); y = 20; header(); }
    const k = format(new Date(r.in_at), "yyyy-MM-dd");
    const h = r.hours != null ? Number(r.hours) : null;
    if (h != null) total += h;
    doc.text(format(new Date(r.in_at), "M/d/yy"), cols[0], y);
    doc.text(doc.splitTextToSize(r.location_name ?? "—", 58)[0], cols[1], y);
    doc.text(format(new Date(r.in_at), "h:mm a"), cols[2], y);
    doc.text(r.out_at ? format(new Date(r.out_at), "h:mm a") : "on site", cols[3], y);
    doc.text(h != null ? h.toFixed(2) : "—", cols[4], y);
    const img = imgs[k];
    if (img) { const w = Math.min(30, (img.w / img.h) * 7); doc.addImage(img.dataUrl, "PNG", cols[5], y - 5, w, 7); }
    y += 9;
  }
  doc.line(m, y - 4, pw - m, y - 4);
  doc.setFont("helvetica", "bold");
  doc.text("Total hours", cols[2], y + 1);
  doc.text(total.toFixed(2), cols[4], y + 1);

  doc.save(`time-log-${d.personName.replace(/\s+/g, "-").toLowerCase()}-${d.from}-to-${d.to}.pdf`);
}
