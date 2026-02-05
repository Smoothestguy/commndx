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
  withholdingExemptions?: number;
}

export interface WH347DailyHours {
  date: string; // yyyy-MM-dd
  hours: number;
  straightHours: number;
  overtimeHours: number;
}

export interface WH347EmployeeRow {
  personnel: WH347PersonnelData;
  dailyHours: WH347DailyHours[]; // 7 days Sun-Sat
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  straightRate: number;
  overtimeRate: number;
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
  isSubcontractor?: boolean;
  
  // Employee rows
  employees: WH347EmployeeRow[];
  
  // Certification
  certifierName?: string;
  certifierTitle?: string;
  certificationDate?: Date;
  
  // Fringe benefits options
  fringePaidToPlan?: boolean; // (a) option
  fringePaidInCash?: boolean; // (b) option
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

// Format SSN for display (last 4 only with prefix)
function formatSSN(lastFour?: string): string {
  if (!lastFour) return "XXX-XX-XXXX";
  return `XXX-XX-${lastFour}`;
}

// Organize time entries by personnel and date for WH-347
// This now calculates daily O/S breakdown based on cumulative weekly threshold
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
    withholding_exemptions?: number | null;
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
          withholdingExemptions: assignment?.withholding_exemptions || 0,
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
    // First, get daily totals in order
    const dailyTotals = weekDates.map((date) => ({
      date,
      hours: entries
        .filter((e) => e.date === date)
        .reduce((sum, e) => sum + e.hours, 0),
    }));

    // Calculate daily S/O breakdown based on cumulative threshold
    let cumulativeHours = 0;
    const dailyHours: WH347DailyHours[] = dailyTotals.map((day) => {
      const prevCumulative = cumulativeHours;
      cumulativeHours += day.hours;
      
      let straightHours = 0;
      let overtimeHours = 0;
      
      if (prevCumulative >= weeklyThreshold) {
        // All hours are overtime
        overtimeHours = day.hours;
      } else if (cumulativeHours <= weeklyThreshold) {
        // All hours are straight time
        straightHours = day.hours;
      } else {
        // Split between straight and overtime
        straightHours = weeklyThreshold - prevCumulative;
        overtimeHours = day.hours - straightHours;
      }
      
      return {
        date: day.date,
        hours: day.hours,
        straightHours,
        overtimeHours,
      };
    });

    const totalHours = dailyHours.reduce((sum, d) => sum + d.hours, 0);
    const regularHours = dailyHours.reduce((sum, d) => sum + d.straightHours, 0);
    const overtimeHours = dailyHours.reduce((sum, d) => sum + d.overtimeHours, 0);

    const straightRate = personnel.hourlyRate;
    const overtimeRate = personnel.hourlyRate * overtimeMultiplier;
    
    const regularPay = regularHours * straightRate;
    const overtimePay = overtimeHours * overtimeRate;
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
      straightRate,
      overtimeRate,
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

// Generate WH-347 PDF (Portrait, matching official DOL form)
export function generateWH347PDF(data: WH347ExportData): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter", // 8.5" x 11"
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // ~215.9mm
  const pageHeight = doc.internal.pageSize.getHeight(); // ~279.4mm
  const margin = 8;
  let y = margin;

  // Draw checkbox
  const drawCheckbox = (x: number, yPos: number, checked: boolean) => {
    doc.setDrawColor(0, 0, 0);
    doc.rect(x, yPos, 3, 3, "S");
    if (checked) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("X", x + 0.5, yPos + 2.5);
    }
  };

  // ========== PAGE 1: WH-347 PAYROLL FORM ==========

  // Title Block
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("U.S. Department of Labor", margin, y + 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("WAGE AND HOUR DIVISION", margin, y + 6);

  // Center title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("PAYROLL", pageWidth / 2, y + 5, { align: "center" });
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("(For Contractor's Optional Use; See Instructions at www.dol.gov/whd/forms/wh347instr.htm)", 
    pageWidth / 2, y + 9, { align: "center" });

  // Right side - form number
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("WH-347", pageWidth - margin - 15, y + 4);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("OMB No.: 1235-0008", pageWidth - margin - 20, y + 7);
  doc.text("Expires: 09/30/2026", pageWidth - margin - 20, y + 10);

  y += 15;

  // Main info box
  const boxHeight = 25;
  doc.setDrawColor(0, 0, 0);
  doc.rect(margin, y, pageWidth - 2 * margin, boxHeight, "S");

  // Left column - Contractor info
  doc.setFontSize(6);
  doc.text("NAME OF CONTRACTOR", margin + 2, y + 3);
  drawCheckbox(margin + 32, y + 1, !data.isSubcontractor);
  doc.text("OR SUBCONTRACTOR", margin + 37, y + 3);
  drawCheckbox(margin + 56, y + 1, !!data.isSubcontractor);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(data.contractorName, margin + 2, y + 8);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("ADDRESS", margin + 2, y + 12);
  doc.setFontSize(7);
  doc.text(data.contractorAddress.substring(0, 60), margin + 2, y + 16);

  // Vertical divider
  const dividerX = pageWidth / 2 + 20;
  doc.line(dividerX, y, dividerX, y + boxHeight);

  // Right column - Payroll info
  doc.setFontSize(6);
  doc.text("PAYROLL NO.", dividerX + 2, y + 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(data.payrollNumber, dividerX + 2, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("FOR WEEK ENDING", dividerX + 30, y + 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(format(data.weekEnding, "MM/dd/yyyy"), dividerX + 30, y + 8);

  y += boxHeight;

  // Project info box
  doc.rect(margin, y, pageWidth - 2 * margin, 15, "S");
  doc.line(dividerX, y, dividerX, y + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("PROJECT AND LOCATION", margin + 2, y + 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(data.projectName.substring(0, 50), margin + 2, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(data.projectLocation.substring(0, 55), margin + 2, y + 11);

  doc.setFontSize(6);
  doc.text("PROJECT OR CONTRACT NO.", dividerX + 2, y + 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(data.contractNumber || "N/A", dividerX + 2, y + 8);

  y += 17;

  // ========== DATA TABLE ==========
  
  // Column definitions for the main table
  const tableWidth = pageWidth - 2 * margin;
  const col = {
    name: 40,        // (1) Name, Address, SSN
    wh: 8,          // (2) No. W/H Exemptions  
    class: 22,       // (3) Work Classification
    day: 10,         // Each day column (7 days)
    total: 12,       // (5) Total Hours
    rate: 14,        // (6) Rate of Pay
    gross: 16,       // (7) Gross Earned
    fica: 12,        // (8a) FICA
    withhold: 12,    // (8b) Withholding
    other: 12,       // (8c) Other
    net: 16,         // (9) Net Wages
  };

  const tableStartX = margin;
  const headerHeight = 16;

  // Week dates for header
  const weekStart = startOfWeek(data.weekEnding, { weekStartsOn: 0 });
  const dayDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  // Draw header row
  doc.setFillColor(240, 240, 240);
  doc.rect(tableStartX, y, tableWidth, headerHeight, "FD");

  let x = tableStartX;
  doc.setFontSize(5);
  doc.setFont("helvetica", "bold");

  // Column headers
  const headers = [
    { label: "(1)\nNAME, ADDRESS,\nAND SSN", width: col.name },
    { label: "(2)\nNO.\nW/H\nEXEMP.", width: col.wh },
    { label: "(3)\nWORK\nCLASS.", width: col.class },
  ];

  headers.forEach((h) => {
    doc.rect(x, y, h.width, headerHeight, "S");
    const lines = h.label.split("\n");
    lines.forEach((line, i) => {
      doc.text(line, x + h.width / 2, y + 3 + i * 2.5, { align: "center" });
    });
    x += h.width;
  });

  // Day columns with dates - "(4) DAY AND DATE"
  doc.rect(x, y, col.day * 7, 5, "S");
  doc.text("(4) DAY AND DATE", x + (col.day * 7) / 2, y + 3.5, { align: "center" });
  
  // Individual day headers with O/S rows
  for (let i = 0; i < 7; i++) {
    const dayX = x + i * col.day;
    doc.rect(dayX, y + 5, col.day, 11, "S");
    doc.text(dayLabels[i], dayX + col.day / 2, y + 8, { align: "center" });
    doc.setFontSize(4);
    doc.text(format(dayDates[i], "M/d"), dayX + col.day / 2, y + 11, { align: "center" });
    // O and S labels
    doc.text("O", dayX + 2, y + 14);
    doc.text("S", dayX + col.day - 3, y + 14);
    doc.setFontSize(5);
  }
  x += col.day * 7;

  // Remaining headers
  const headers2 = [
    { label: "(5)\nTOTAL\nHOURS", width: col.total },
    { label: "(6)\nRATE\nOF PAY", width: col.rate },
    { label: "(7)\nGROSS\nEARNED", width: col.gross },
  ];

  headers2.forEach((h) => {
    doc.rect(x, y, h.width, headerHeight, "S");
    const lines = h.label.split("\n");
    lines.forEach((line, i) => {
      doc.text(line, x + h.width / 2, y + 3 + i * 3, { align: "center" });
    });
    x += h.width;
  });

  // Deductions header "(8) DEDUCTIONS"
  doc.rect(x, y, col.fica + col.withhold + col.other, 5, "S");
  doc.text("(8) DEDUCTIONS", x + (col.fica + col.withhold + col.other) / 2, y + 3.5, { align: "center" });
  
  // Sub-headers for deductions
  doc.rect(x, y + 5, col.fica, 11, "S");
  doc.text("FICA", x + col.fica / 2, y + 11, { align: "center" });
  x += col.fica;
  
  doc.rect(x, y + 5, col.withhold, 11, "S");
  doc.text("WITH-\nHOLD.", x + col.withhold / 2, y + 10, { align: "center" });
  x += col.withhold;
  
  doc.rect(x, y + 5, col.other, 11, "S");
  doc.text("OTHER", x + col.other / 2, y + 11, { align: "center" });
  x += col.other;

  // Net wages header
  doc.rect(x, y, col.net, headerHeight, "S");
  doc.text("(9)\nNET\nWAGES\nPAID", x + col.net / 2, y + 3, { align: "center" });

  y += headerHeight;

  // ========== EMPLOYEE ROWS ==========
  const rowHeight = 14; // Each employee gets 2 sub-rows (O and S)
  doc.setFont("helvetica", "normal");

  data.employees.forEach((employee, rowIndex) => {
    // Check for page break
    if (y + rowHeight > pageHeight - 50) {
      doc.addPage();
      y = margin;
    }

    x = tableStartX;
    const p = employee.personnel;
    
    // (1) Name, Address, SSN cell
    doc.rect(x, y, col.name, rowHeight, "S");
    doc.setFontSize(6);
    doc.text(`${p.lastName}, ${p.firstName}`, x + 1, y + 3);
    if (p.address) {
      doc.setFontSize(5);
      doc.text(p.address.substring(0, 22), x + 1, y + 6);
      if (p.city || p.state) {
        doc.text(`${p.city || ""}, ${p.state || ""} ${p.zip || ""}`.substring(0, 22), x + 1, y + 9);
      }
    }
    doc.text(formatSSN(p.ssnLastFour), x + 1, y + 12);
    x += col.name;

    // (2) Withholding Exemptions
    doc.rect(x, y, col.wh, rowHeight, "S");
    doc.setFontSize(7);
    doc.text(String(p.withholdingExemptions || 0), x + col.wh / 2, y + 8, { align: "center" });
    x += col.wh;

    // (3) Work Classification
    doc.rect(x, y, col.class, rowHeight, "S");
    doc.setFontSize(5);
    doc.text((p.workClassification || "").substring(0, 12), x + 1, y + 8);
    x += col.class;

    // (4) Daily hours - O row and S row
    const halfRow = rowHeight / 2;
    employee.dailyHours.forEach((day) => {
      doc.rect(x, y, col.day, rowHeight, "S");
      doc.line(x, y + halfRow, x + col.day, y + halfRow); // Horizontal divider
      
      doc.setFontSize(6);
      // O (overtime) row
      if (day.overtimeHours > 0) {
        doc.text(day.overtimeHours.toFixed(1), x + col.day / 2, y + 4, { align: "center" });
      }
      // S (straight) row
      if (day.straightHours > 0) {
        doc.text(day.straightHours.toFixed(1), x + col.day / 2, y + halfRow + 4, { align: "center" });
      }
      x += col.day;
    });

    // (5) Total Hours - with O/S breakdown
    doc.rect(x, y, col.total, rowHeight, "S");
    doc.line(x, y + halfRow, x + col.total, y + halfRow);
    doc.setFontSize(6);
    if (employee.overtimeHours > 0) {
      doc.text(employee.overtimeHours.toFixed(1), x + col.total / 2, y + 4, { align: "center" });
    }
    doc.text(employee.regularHours.toFixed(1), x + col.total / 2, y + halfRow + 4, { align: "center" });
    x += col.total;

    // (6) Rate of Pay - with O/S rates
    doc.rect(x, y, col.rate, rowHeight, "S");
    doc.line(x, y + halfRow, x + col.rate, y + halfRow);
    doc.setFontSize(6);
    if (employee.overtimeHours > 0) {
      doc.text(`$${employee.overtimeRate.toFixed(2)}`, x + 1, y + 4);
    }
    doc.text(`$${employee.straightRate.toFixed(2)}`, x + 1, y + halfRow + 4);
    x += col.rate;

    // (7) Gross Earned
    doc.rect(x, y, col.gross, rowHeight, "S");
    doc.setFontSize(7);
    doc.text(`$${employee.grossEarned.toFixed(2)}`, x + 1, y + 8);
    x += col.gross;

    // (8a) FICA
    doc.rect(x, y, col.fica, rowHeight, "S");
    doc.setFontSize(6);
    doc.text(`$${employee.deductions.fica.toFixed(2)}`, x + 1, y + 8);
    x += col.fica;

    // (8b) Withholding
    doc.rect(x, y, col.withhold, rowHeight, "S");
    doc.text(`$${employee.deductions.withholding.toFixed(2)}`, x + 1, y + 8);
    x += col.withhold;

    // (8c) Other
    doc.rect(x, y, col.other, rowHeight, "S");
    if (employee.deductions.other > 0) {
      doc.text(`$${employee.deductions.other.toFixed(2)}`, x + 1, y + 8);
    }
    x += col.other;

    // (9) Net Wages
    doc.rect(x, y, col.net, rowHeight, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(`$${employee.netWages.toFixed(2)}`, x + 1, y + 8);
    doc.setFont("helvetica", "normal");

    y += rowHeight;
  });

  // ========== PAGE 2: WH-348 STATEMENT OF COMPLIANCE ==========
  doc.addPage();
  y = margin;

  // Header
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("STATEMENT OF COMPLIANCE", pageWidth / 2, y + 5, { align: "center" });
  
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("Rev. Dec. 2008", pageWidth - margin - 15, y + 3);

  y += 12;

  // Date field
  doc.setFontSize(8);
  doc.text("Date", margin, y);
  doc.line(margin + 8, y, margin + 50, y);
  if (data.certificationDate) {
    doc.text(format(data.certificationDate, "MM/dd/yyyy"), margin + 10, y - 1);
  }

  y += 8;

  // Signatory info
  doc.text(`I, ${data.certifierName || "_____________________________"}, `, margin, y);
  doc.text(`${data.certifierTitle || "(Title)"}`, margin + 60, y);
  
  y += 6;
  doc.setFontSize(7);
  doc.text("(Name of Signatory Party)", margin + 5, y);
  doc.text("(Title)", margin + 60, y);

  y += 8;
  doc.setFontSize(8);
  doc.text("do hereby state:", margin, y);

  y += 8;

  // Compliance statements
  const statements = [
    `(1) That I pay or supervise the payment of the persons employed by ${data.contractorName} on the ${data.projectName}; that during the payroll period commencing on the ${format(startOfWeek(data.weekEnding, { weekStartsOn: 0 }), "do")} day of ${format(data.weekEnding, "MMMM, yyyy")} and ending the ${format(data.weekEnding, "do")} day of ${format(data.weekEnding, "MMMM, yyyy")} all persons employed on said project have been paid the full weekly wages earned, that no rebates have been or will be made either directly or indirectly to or on behalf of said ${data.contractorName} from the full weekly wages earned by any person and that no deductions have been made either directly or indirectly from the full wages earned by any person, other than permissible deductions as defined in Regulations, Part 3 (29 C.F.R. Subtitle A), issued by the Secretary of Labor under the Copeland Act, as amended (48 Stat. 948, 63 Stat. 108, 72 Stat. 967; 76 Stat. 357; 40 U.S.C. § 3145), and described below:`,
    `(2) That any payrolls otherwise under this contract required to be submitted for the above period are correct and complete; that the wage rates for laborers or mechanics contained therein are not less than the applicable wage rates contained in any wage determination incorporated into the contract; that the classifications set forth therein for each laborer or mechanic conform with the work he performed.`,
    `(3) That any apprentices employed in the above period are duly registered in a bona fide apprenticeship program registered with a State apprenticeship agency recognized by the Bureau of Apprenticeship and Training, United States Department of Labor, or if no such recognized agency exists in a State, are registered with the Bureau of Apprenticeship and Training, United States Department of Labor.`,
    `(4) That:`
  ];

  doc.setFontSize(7);
  statements.forEach((statement, index) => {
    const lines = doc.splitTextToSize(statement, pageWidth - 2 * margin - 5);
    lines.forEach((line: string) => {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin + 3, y);
      y += 3.5;
    });
    y += 2;
  });

  // Fringe benefit checkboxes
  y += 2;
  drawCheckbox(margin + 8, y - 2, !!data.fringePaidToPlan);
  doc.text("(a) WHERE FRINGE BENEFITS ARE PAID TO APPROVED PLANS, FUNDS, OR PROGRAMS", margin + 14, y);
  y += 5;
  
  const fringeTextA = "— in addition to the basic hourly wage rates paid to each laborer or mechanic listed in the above referenced payroll, payments of fringe benefits as listed in the contract have been or will be made to appropriate programs for the benefit of such employees, except as noted in section 4(c) below.";
  const linesA = doc.splitTextToSize(fringeTextA, pageWidth - 2 * margin - 15);
  linesA.forEach((line: string) => {
    doc.text(line, margin + 14, y);
    y += 3.5;
  });

  y += 3;
  drawCheckbox(margin + 8, y - 2, !!data.fringePaidInCash);
  doc.text("(b) WHERE FRINGE BENEFITS ARE PAID IN CASH", margin + 14, y);
  y += 5;
  
  const fringeTextB = "— Each laborer or mechanic listed in the above referenced payroll has been paid, as indicated on the payroll, an amount not less than the sum of the applicable basic hourly wage rate plus the amount of the required fringe benefits as listed in the contract, except as noted in section 4(c) below.";
  const linesB = doc.splitTextToSize(fringeTextB, pageWidth - 2 * margin - 15);
  linesB.forEach((line: string) => {
    doc.text(line, margin + 14, y);
    y += 3.5;
  });

  y += 5;
  doc.text("(c) EXCEPTIONS", margin + 8, y);
  y += 8;

  // Exceptions table
  doc.rect(margin, y, (pageWidth - 2 * margin) / 2, 5, "S");
  doc.rect(margin + (pageWidth - 2 * margin) / 2, y, (pageWidth - 2 * margin) / 2, 5, "S");
  doc.setFontSize(6);
  doc.text("EXCEPTION (CRAFT)", margin + 2, y + 3.5);
  doc.text("EXPLANATION", margin + (pageWidth - 2 * margin) / 2 + 2, y + 3.5);
  
  // Empty rows for exceptions
  for (let i = 0; i < 3; i++) {
    y += 5;
    doc.rect(margin, y, (pageWidth - 2 * margin) / 2, 5, "S");
    doc.rect(margin + (pageWidth - 2 * margin) / 2, y, (pageWidth - 2 * margin) / 2, 5, "S");
  }

  y += 10;

  // Remarks
  doc.setFontSize(7);
  doc.text("REMARKS:", margin, y);
  y += 3;
  doc.rect(margin, y, pageWidth - 2 * margin, 15, "S");

  y += 20;

  // Signature section
  doc.setFontSize(8);
  doc.text("NAME AND TITLE", margin, y);
  doc.line(margin + 25, y, margin + 90, y);
  if (data.certifierName && data.certifierTitle) {
    doc.text(`${data.certifierName}, ${data.certifierTitle}`, margin + 27, y - 1);
  }

  doc.text("SIGNATURE", margin + 100, y);
  doc.line(margin + 120, y, pageWidth - margin, y);

  y += 8;

  // Legal warning
  doc.setFontSize(6);
  doc.setFont("helvetica", "italic");
  const warningText = "THE WILLFUL FALSIFICATION OF ANY OF THE ABOVE STATEMENTS MAY SUBJECT THE CONTRACTOR OR SUBCONTRACTOR TO CIVIL OR CRIMINAL PROSECUTION. SEE SECTION 1001 OF TITLE 18 AND SECTION 231 OF TITLE 31 OF THE UNITED STATES CODE.";
  const warningLines = doc.splitTextToSize(warningText, pageWidth - 2 * margin);
  warningLines.forEach((line: string) => {
    doc.text(line, margin, y);
    y += 3;
  });

  // Save
  const filename = `WH-347_${data.projectName.replace(/[^a-zA-Z0-9]/g, "_")}_${format(data.weekEnding, "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}
