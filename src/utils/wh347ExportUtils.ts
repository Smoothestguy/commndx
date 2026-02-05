import jsPDF from "jspdf";
import { format, addDays, startOfWeek, parseISO } from "date-fns";

export interface WH347PersonnelData {
  id: string;
  firstName: string;
  lastName: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  ssnLastFour?: string;
  workClassification?: string;
  hourlyRate: number;
}

export interface WH347DailyHours {
  date: string; // yyyy-MM-dd
  hours: number;
}

export interface WH347EmployeeRow {
  personnel: WH347PersonnelData;
  dailyHours: WH347DailyHours[]; // 7 days Sun-Sat
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  grossEarned: number;
  deductions: {
    fica: number;
    withholding: number;
    other: number;
  };
  netWages: number;
}

export interface WH347ExportData {
  // Header info
  contractorName: string;
  contractorAddress: string;
  payrollNumber: string;
  weekEnding: Date;
  projectName: string;
  projectLocation: string;
  contractNumber: string;
  
  // Employee rows
  employees: WH347EmployeeRow[];
  
  // Certification
  certifierName?: string;
  certifierTitle?: string;
  certificationDate?: Date;
}

// Calculate FICA deduction (7.65% for Social Security + Medicare)
export function calculateFICA(grossPay: number): number {
  return grossPay * 0.0765;
}

// Calculate estimated federal withholding (simplified estimate)
export function calculateWithholding(grossPay: number): number {
  // Simplified flat 10% estimate for withholding
  return grossPay * 0.10;
}

// Format SSN for display (last 4 only)
function formatSSN(lastFour?: string): string {
  if (!lastFour) return "XXX-XX-XXXX";
  return `XXX-XX-${lastFour}`;
}

// Get day abbreviation for WH-347 (S, M, T, W, T, F, S format)
function getDayAbbr(dayIndex: number): string {
  const abbrs = ["S", "M", "T", "W", "T", "F", "S"];
  return abbrs[dayIndex];
}

// Organize time entries by personnel and date for WH-347
export function organizeEntriesForWH347(
  entries: Array<{
    entry_date: string;
    hours: number;
    regular_hours?: number | null;
    overtime_hours?: number | null;
    hourly_rate?: number | null;
    personnel_id?: string | null;
    personnel?: {
      id: string;
      first_name: string;
      last_name: string;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      zip?: string | null;
      ssn_last_four?: string | null;
      hourly_rate?: number | null;
    } | null;
  }>,
  weekEnding: Date,
  assignments: Array<{
    personnel_id: string;
    work_classification?: string | null;
  }>,
  overtimeMultiplier: number = 1.5,
  weeklyThreshold: number = 40
): WH347EmployeeRow[] {
  // Group entries by personnel
  const personnelMap = new Map<string, {
    personnel: WH347PersonnelData;
    entries: Array<{ date: string; hours: number }>;
  }>();

  entries.forEach((entry) => {
    if (!entry.personnel_id || !entry.personnel) return;
    
    const personnelId = entry.personnel_id;
    const assignment = assignments.find(a => a.personnel_id === personnelId);
    
    if (!personnelMap.has(personnelId)) {
      personnelMap.set(personnelId, {
        personnel: {
          id: personnelId,
          firstName: entry.personnel.first_name,
          lastName: entry.personnel.last_name,
          address: entry.personnel.address || undefined,
          city: entry.personnel.city || undefined,
          state: entry.personnel.state || undefined,
          zip: entry.personnel.zip || undefined,
          ssnLastFour: entry.personnel.ssn_last_four || undefined,
          workClassification: assignment?.work_classification || undefined,
          hourlyRate: entry.hourly_rate || entry.personnel.hourly_rate || 0,
        },
        entries: [],
      });
    }
    
    personnelMap.get(personnelId)!.entries.push({
      date: entry.entry_date,
      hours: Number(entry.hours),
    });
  });

  // Convert to WH-347 rows
  const weekStart = startOfWeek(weekEnding, { weekStartsOn: 0 }); // Sunday
  const weekDates = Array.from({ length: 7 }, (_, i) => 
    format(addDays(weekStart, i), "yyyy-MM-dd")
  );

  const rows: WH347EmployeeRow[] = [];

  personnelMap.forEach(({ personnel, entries }) => {
    // Build daily hours array (Sun-Sat)
    const dailyHours: WH347DailyHours[] = weekDates.map((date) => ({
      date,
      hours: entries
        .filter((e) => e.date === date)
        .reduce((sum, e) => sum + e.hours, 0),
    }));

    const totalHours = dailyHours.reduce((sum, d) => sum + d.hours, 0);
    const regularHours = Math.min(totalHours, weeklyThreshold);
    const overtimeHours = Math.max(0, totalHours - weeklyThreshold);

    const regularPay = regularHours * personnel.hourlyRate;
    const overtimePay = overtimeHours * personnel.hourlyRate * overtimeMultiplier;
    const grossEarned = regularPay + overtimePay;

    const fica = calculateFICA(grossEarned);
    const withholding = calculateWithholding(grossEarned);
    const other = 0;
    const netWages = grossEarned - fica - withholding - other;

    rows.push({
      personnel,
      dailyHours,
      totalHours,
      regularHours,
      overtimeHours,
      grossEarned,
      deductions: { fica, withholding, other },
      netWages,
    });
  });

  // Sort by last name
  return rows.sort((a, b) => 
    a.personnel.lastName.localeCompare(b.personnel.lastName)
  );
}

// Generate WH-347 PDF
export function generateWH347PDF(data: WH347ExportData): void {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "letter",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  let y = margin;

  // Colors
  const headerBg = [240, 240, 240];
  const borderColor = [0, 0, 0];

  // Helper functions
  const drawRect = (x: number, yPos: number, w: number, h: number, fill = false) => {
    if (fill) {
      doc.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
      doc.rect(x, yPos, w, h, "F");
    }
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.rect(x, yPos, w, h, "S");
  };

  // Header Section
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("U.S. DEPARTMENT OF LABOR", margin, y + 5);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("WAGE AND HOUR DIVISION", margin, y + 9);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("PAYROLL", pageWidth / 2, y + 5, { align: "center" });
  doc.setFontSize(8);
  doc.text("(For Contractor's Optional Use; See Instructions at www.dol.gov/whd/forms/wh347instr.htm)", 
    pageWidth / 2, y + 10, { align: "center" });

  doc.setFontSize(10);
  doc.text("WH-347", pageWidth - margin - 20, y + 5);
  doc.setFontSize(8);
  doc.text("OMB No.: 1235-0008", pageWidth - margin - 25, y + 9);
  doc.text("Expires: 02/28/2027", pageWidth - margin - 25, y + 13);

  y += 18;

  // Contractor Info Box
  const infoBoxHeight = 20;
  drawRect(margin, y, pageWidth - 2 * margin, infoBoxHeight);
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("NAME OF CONTRACTOR OR SUBCONTRACTOR", margin + 2, y + 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(data.contractorName, margin + 2, y + 8);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("ADDRESS", margin + 2, y + 12);
  doc.setFontSize(8);
  doc.text(data.contractorAddress, margin + 2, y + 17);

  // Right side of info box
  const midX = pageWidth / 2 + 20;
  doc.setFontSize(7);
  doc.text("PAYROLL NO.", midX, y + 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(data.payrollNumber, midX, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("FOR WEEK ENDING", midX + 40, y + 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(format(data.weekEnding, "MM/dd/yyyy"), midX + 40, y + 8);

  y += infoBoxHeight;

  // Project Info Box
  drawRect(margin, y, pageWidth - 2 * margin, infoBoxHeight);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("PROJECT AND LOCATION", margin + 2, y + 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`${data.projectName}`, margin + 2, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(data.projectLocation, margin + 2, y + 13);

  doc.setFontSize(7);
  doc.text("PROJECT OR CONTRACT NO.", midX, y + 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(data.contractNumber || "N/A", midX, y + 8);

  y += infoBoxHeight + 2;

  // Table Header
  const colWidths = {
    name: 45,
    classification: 25,
    sun: 10, mon: 10, tue: 10, wed: 10, thu: 10, fri: 10, sat: 10,
    total: 12,
    rate: 15,
    gross: 20,
    fica: 15,
    wh: 15,
    other: 15,
    net: 20,
  };

  const tableWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);
  const tableStartX = (pageWidth - tableWidth) / 2;
  
  const headerHeight = 12;
  let x = tableStartX;

  // Draw header background
  drawRect(tableStartX, y, tableWidth, headerHeight, true);

  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");

  // Header cells
  const headers = [
    { text: "NAME, ADDRESS,\nSSN (Last 4)", width: colWidths.name },
    { text: "WORK\nCLASS.", width: colWidths.classification },
    { text: "S", width: colWidths.sun },
    { text: "M", width: colWidths.mon },
    { text: "T", width: colWidths.tue },
    { text: "W", width: colWidths.wed },
    { text: "T", width: colWidths.thu },
    { text: "F", width: colWidths.fri },
    { text: "S", width: colWidths.sat },
    { text: "TOTAL\nHRS", width: colWidths.total },
    { text: "RATE\nOF PAY", width: colWidths.rate },
    { text: "GROSS\nEARNED", width: colWidths.gross },
    { text: "FICA", width: colWidths.fica },
    { text: "W/H", width: colWidths.wh },
    { text: "OTHER", width: colWidths.other },
    { text: "NET\nWAGES", width: colWidths.net },
  ];

  headers.forEach((header) => {
    drawRect(x, y, header.width, headerHeight);
    const lines = header.text.split("\n");
    lines.forEach((line, i) => {
      doc.text(line, x + header.width / 2, y + 4 + i * 3, { align: "center" });
    });
    x += header.width;
  });

  y += headerHeight;

  // Data rows
  const rowHeight = 12;
  doc.setFont("helvetica", "normal");

  data.employees.forEach((employee, rowIndex) => {
    // Check for page break
    if (y + rowHeight > pageHeight - 40) {
      doc.addPage();
      y = margin;
    }

    x = tableStartX;
    const p = employee.personnel;
    
    // Name/Address/SSN cell
    drawRect(x, y, colWidths.name, rowHeight);
    doc.setFontSize(6);
    doc.text(`${p.firstName} ${p.lastName}`, x + 1, y + 3);
    if (p.address) {
      doc.text(p.address.substring(0, 25), x + 1, y + 6);
    }
    doc.text(formatSSN(p.ssnLastFour), x + 1, y + 9);
    x += colWidths.name;

    // Classification
    drawRect(x, y, colWidths.classification, rowHeight);
    doc.text((p.workClassification || "").substring(0, 10), x + 1, y + 6);
    x += colWidths.classification;

    // Daily hours (Sun-Sat)
    employee.dailyHours.forEach((day) => {
      drawRect(x, y, 10, rowHeight);
      if (day.hours > 0) {
        doc.text(day.hours.toFixed(1), x + 5, y + 6, { align: "center" });
      }
      x += 10;
    });

    // Total hours
    drawRect(x, y, colWidths.total, rowHeight);
    doc.text(employee.totalHours.toFixed(1), x + colWidths.total / 2, y + 6, { align: "center" });
    x += colWidths.total;

    // Rate
    drawRect(x, y, colWidths.rate, rowHeight);
    doc.text(`$${p.hourlyRate.toFixed(2)}`, x + 1, y + 6);
    x += colWidths.rate;

    // Gross earned
    drawRect(x, y, colWidths.gross, rowHeight);
    doc.text(`$${employee.grossEarned.toFixed(2)}`, x + 1, y + 6);
    x += colWidths.gross;

    // FICA
    drawRect(x, y, colWidths.fica, rowHeight);
    doc.text(`$${employee.deductions.fica.toFixed(2)}`, x + 1, y + 6);
    x += colWidths.fica;

    // Withholding
    drawRect(x, y, colWidths.wh, rowHeight);
    doc.text(`$${employee.deductions.withholding.toFixed(2)}`, x + 1, y + 6);
    x += colWidths.wh;

    // Other
    drawRect(x, y, colWidths.other, rowHeight);
    doc.text(`$${employee.deductions.other.toFixed(2)}`, x + 1, y + 6);
    x += colWidths.other;

    // Net wages
    drawRect(x, y, colWidths.net, rowHeight);
    doc.setFont("helvetica", "bold");
    doc.text(`$${employee.netWages.toFixed(2)}`, x + 1, y + 6);
    doc.setFont("helvetica", "normal");

    y += rowHeight;
  });

  y += 5;

  // Certification Section
  if (y + 35 > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("STATEMENT OF COMPLIANCE", margin, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const complianceText = `I, ${data.certifierName || "_________________"}, ${data.certifierTitle || "(Title)"}, do hereby state:
(1) That I pay or supervise the payment of the persons employed by ${data.contractorName} on the ${data.projectName};
that during the payroll period commencing on the ${format(startOfWeek(data.weekEnding, { weekStartsOn: 0 }), "do")} day of ${format(data.weekEnding, "MMMM, yyyy")} and ending the ${format(data.weekEnding, "do")} day of ${format(data.weekEnding, "MMMM, yyyy")},
all persons employed on said project have been paid the full weekly wages earned, that no rebates have been or will be made either directly or indirectly to or on behalf of said
${data.contractorName} from the full weekly wages earned by any person and that no deductions have been made either directly or indirectly from the full wages earned by any person,
other than permissible deductions as defined in Regulations, Part 3 (29 CFR Subtitle A), issued by the Secretary of Labor under the Copeland Act, as amended (48 Stat. 948, 63 Stat. 108, 72 Stat. 967; 76 Stat. 357; 40 U.S.C. 3145),
and described below:`;

  const splitText = doc.splitTextToSize(complianceText, pageWidth - 2 * margin);
  doc.text(splitText, margin, y);
  y += splitText.length * 3 + 5;

  // Signature line
  doc.line(margin, y + 5, margin + 60, y + 5);
  doc.text("Signature", margin, y + 8);

  doc.line(margin + 70, y + 5, margin + 100, y + 5);
  doc.text("Date", margin + 70, y + 8);
  if (data.certificationDate) {
    doc.text(format(data.certificationDate, "MM/dd/yyyy"), margin + 70, y + 3);
  }

  doc.line(margin + 110, y + 5, margin + 180, y + 5);
  doc.text("Title", margin + 110, y + 8);
  if (data.certifierTitle) {
    doc.text(data.certifierTitle, margin + 110, y + 3);
  }

  // Save
  const filename = `WH-347_${data.projectName.replace(/[^a-zA-Z0-9]/g, "_")}_${format(data.weekEnding, "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}
