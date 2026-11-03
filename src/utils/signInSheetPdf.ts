import jsPDF from "jspdf";
import { format } from "date-fns";
import { PDF_COLORS, PDF_MARGIN, setColor } from "./pdfHelpers";
import type { VisitRow, VisitPerson } from "@/integrations/supabase/hooks/useFieldMode";
import { fullName } from "@/integrations/supabase/hooks/useCrews";

export interface SignInSheetSite {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

interface SignInSheetData {
  projectName: string;
  date: string; // yyyy-MM-dd
  sites: SignInSheetSite[];
  visits: VisitRow[];
  people: VisitPerson[];
  locationId?: string; // per-location variant
}

const hoursBetween = (a: string, b: string | null) =>
  b ? Math.round(((new Date(b).getTime() - new Date(a).getTime()) / 3_600_000) * 10) / 10 : null;

/** Load a public signature image into a data URL for jsPDF. Returns null on failure. */
export async function loadImage(src: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve({ dataUrl: canvas.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function generateSignInSheetPDF(data: SignInSheetData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PDF_MARGIN;
  let y = 20;

  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  setColor(doc, PDF_COLORS.primary);
  doc.text("Fairfield Response Group", pageWidth / 2, y, { align: "center" });
  y += 8;
  setColor(doc, PDF_COLORS.black);
  doc.setFontSize(14);
  doc.text("DAILY SIGN-IN SHEET", pageWidth / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.projectName} — ${format(new Date(data.date + "T12:00:00"), "EEEE, MMMM d, yyyy")}`, pageWidth / 2, y, { align: "center" });
  y += 12;

  const sites = data.locationId ? data.sites.filter((s) => s.id === data.locationId) : data.sites;
  const visits = data.locationId ? data.visits.filter((v) => v.location_id === data.locationId) : data.visits;

  // Site visit table
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Site Visits", margin, y);
  y += 7;

  for (const site of sites) {
    const siteVisits = visits.filter((v) => v.location_id === site.id);
    if (!siteVisits.length) continue;
    checkPage(30);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(site.name, margin, y);
    doc.setFont("helvetica", "normal");
    const addr = [site.address, site.city, site.state].filter(Boolean).join(", ");
    if (addr) doc.text(addr, margin + 60, y);
    y += 6;

    for (const v of siteVisits) {
      checkPage(8);
      const hrs = hoursBetween(v.check_in_at, v.check_out_at);
      const crewCount = data.people.filter((p) => p.visit_id === v.id).length;
      doc.setFontSize(9);
      doc.text(
        `In: ${format(new Date(v.check_in_at), "HH:mm")}   Out: ${v.check_out_at ? format(new Date(v.check_out_at), "HH:mm") : "—"}   Hours: ${hrs ?? "—"}   Crew: ${crewCount}`,
        margin + 5,
        y,
      );
      y += 5;
    }
    y += 4;
  }

  // Personnel table with signatures
  checkPage(40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Personnel", margin, y);
  y += 8;

  // Aggregate per person
  const byPerson = new Map<string, { name: string; sites: Set<string>; hours: number; signature: string | null }>();
  for (const p of data.people) {
    const v = visits.find((x) => x.id === p.visit_id);
    if (!v) continue;
    if (data.locationId && v.location_id !== data.locationId) continue;
    const name = fullName(p.personnel);
    const entry = byPerson.get(p.personnel_id) ?? { name, sites: new Set<string>(), hours: 0, signature: null };
    const site = data.sites.find((s) => s.id === v.location_id);
    if (site) entry.sites.add(site.name);
    entry.hours += hoursBetween(v.check_in_at, v.check_out_at) ?? 0;
    if (p.signature_url) entry.signature = p.signature_url;
    byPerson.set(p.personnel_id, entry);
  }

  // Table header
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setColor(doc, PDF_COLORS.gray600);
  doc.text("Name", margin, y);
  doc.text("Sites", margin + 55, y);
  doc.text("Hours", margin + 115, y);
  doc.text("Signature", margin + 135, y);
  setColor(doc, PDF_COLORS.black);
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  for (const entry of byPerson.values()) {
    checkPage(24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(entry.name, margin, y + 4);
    doc.text([...entry.sites].join(", ").slice(0, 40), margin + 55, y + 4);
    doc.text(entry.hours.toFixed(1), margin + 115, y + 4);
    if (entry.signature) {
      const img = await loadImage(entry.signature);
      if (img) {
        const h = 14;
        const w = Math.min(45, (img.w / img.h) * h);
        try {
          doc.addImage(img.dataUrl, "PNG", margin + 135, y - 3, w, h);
        } catch {
          doc.text("(signed)", margin + 135, y + 4);
        }
      } else {
        doc.text("(signed)", margin + 135, y + 4);
      }
    } else {
      doc.setDrawColor(150, 150, 150);
      doc.line(margin + 135, y + 8, margin + 180, y + 8);
    }
    y += 18;
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y - 4, pageWidth - margin, y - 4);
  }

  // Customer POC signature footer
  checkPage(35);
  y += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.line(margin, y, margin + 80, y);
  doc.line(margin + 100, y, margin + 160, y);
  y += 5;
  doc.setFontSize(8);
  setColor(doc, PDF_COLORS.gray500);
  doc.text("Customer POC signature", margin, y);
  doc.text("Date", margin + 100, y);

  // Page footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Generated ${format(new Date(), "MMM d, yyyy 'at' HH:mm")} — Page ${i} of ${pages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" },
    );
  }

  const suffix = data.locationId ? `_${sites[0]?.name.replace(/\s+/g, "_") ?? "site"}` : "";
  doc.save(`SignInSheet_${data.projectName.replace(/\s+/g, "_")}${suffix}_${data.date}.pdf`);
}
