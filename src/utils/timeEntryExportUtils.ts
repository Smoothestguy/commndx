import { format, startOfWeek, endOfWeek } from "date-fns";
import jsPDF from "jspdf";
import ExcelJS from "exceljs";
import type { TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";

export interface TimeEntryExportData {
  entries: TimeEntryWithDetails[];
  weekStart?: Date;
  weekEnd?: Date;
  projectFilter?: string;
  personnelFilter?: string;
  overtimeMultiplier?: number;
  weeklyOvertimeThreshold?: number;
  visibleColumns?: string[];
}

// All available columns for export
export const ALL_EXPORT_COLUMNS = [
  "date",
  "personnel",
  "project",
  "customer",
  "hours",
  "regularHours",
  "overtimeHours",
  "rate",
  "regularPay",
  "overtimePay",
  "totalPay",
  "billable",
  "status",
  "description",
];

// Column metadata for headers and widths
const COLUMN_CONFIG: Record<string, { header: string; width: number; pdfWidth: number }> = {
  date: { header: "Date", width: 12, pdfWidth: 25 },
  personnel: { header: "Personnel", width: 25, pdfWidth: 45 },
  project: { header: "Project", width: 30, pdfWidth: 55 },
  customer: { header: "Customer", width: 25, pdfWidth: 35 },
  hours: { header: "Hours", width: 10, pdfWidth: 18 },
  regularHours: { header: "Regular Hrs", width: 12, pdfWidth: 20 },
  overtimeHours: { header: "OT Hrs", width: 10, pdfWidth: 18 },
  rate: { header: "Rate", width: 12, pdfWidth: 22 },
  regularPay: { header: "Regular Pay", width: 14, pdfWidth: 25 },
  overtimePay: { header: "OT Pay", width: 12, pdfWidth: 22 },
  totalPay: { header: "Total Pay", width: 14, pdfWidth: 28 },
  billable: { header: "Billable", width: 10, pdfWidth: 18 },
  status: { header: "Status", width: 12, pdfWidth: 20 },
  description: { header: "Description", width: 40, pdfWidth: 50 },
};

// Format currency consistently
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

// Get personnel name from entry
function getPersonnelName(entry: TimeEntryWithDetails): string {
  if (entry.personnel) {
    return `${entry.personnel.first_name} ${entry.personnel.last_name}`;
  }
  if (entry.profiles) {
    return `${entry.profiles.first_name || ""} ${
      entry.profiles.last_name || ""
    }`.trim();
  }
  return "Unknown";
}

// Get hourly rate from entry
function getHourlyRate(entry: TimeEntryWithDetails): number | null {
  if (entry.personnel?.hourly_rate) return entry.personnel.hourly_rate;
  if (entry.profiles?.hourly_rate) return entry.profiles.hourly_rate;
  return null;
}

// Calculate totals for entries
function calculateTotals(
  entries: TimeEntryWithDetails[],
  overtimeMultiplier = 1.5
) {
  let totalHours = 0;
  let totalRegularHours = 0;
  let totalOvertimeHours = 0;
  let totalPay = 0;
  let totalRegularPay = 0;
  let totalOvertimePay = 0;

  entries.forEach((entry) => {
    const hours = Number(entry.hours) || 0;
    const regularHours = Number(entry.regular_hours) || hours;
    const overtimeHours = Number(entry.overtime_hours) || 0;
    const rate = getHourlyRate(entry) || 0;

    totalHours += hours;
    totalRegularHours += regularHours;
    totalOvertimeHours += overtimeHours;
    totalRegularPay += regularHours * rate;
    totalOvertimePay += overtimeHours * rate * overtimeMultiplier;
    totalPay += regularHours * rate + overtimeHours * rate * overtimeMultiplier;
  });

  return {
    totalHours,
    totalRegularHours,
    totalOvertimeHours,
    totalPay,
    totalRegularPay,
    totalOvertimePay,
  };
}

// Get row values for an entry based on selected columns
function getEntryRowValues(
  entry: TimeEntryWithDetails,
  visibleColumns: string[],
  overtimeMultiplier: number
): Record<string, string> {
  const rate = getHourlyRate(entry) || 0;
  const regularHours = Number(entry.regular_hours) || Number(entry.hours);
  const overtimeHours = Number(entry.overtime_hours) || 0;
  const regularPay = regularHours * rate;
  const overtimePay = overtimeHours * rate * overtimeMultiplier;

  const allValues: Record<string, string> = {
    date: format(new Date(entry.entry_date), "MMM d, yyyy"),
    personnel: getPersonnelName(entry),
    project: entry.projects?.name || "Unknown",
    customer: entry.projects?.customers?.name || "-",
    hours: Number(entry.hours).toFixed(2),
    regularHours: regularHours.toFixed(2),
    overtimeHours: overtimeHours.toFixed(2),
    rate: rate ? formatCurrency(rate) : "-",
    regularPay: rate ? formatCurrency(regularPay) : "-",
    overtimePay: rate ? formatCurrency(overtimePay) : "-",
    totalPay: rate ? formatCurrency(regularPay + overtimePay) : "-",
    billable: entry.billable ? "Yes" : "No",
    status:
      (entry.status || "pending").charAt(0).toUpperCase() +
      (entry.status || "pending").slice(1),
    description: entry.description || "",
  };

  const result: Record<string, string> = {};
  visibleColumns.forEach((col) => {
    result[col] = allValues[col] || "";
  });
  return result;
}

// Get totals row values based on selected columns
function getTotalsRowValues(
  totals: ReturnType<typeof calculateTotals>,
  visibleColumns: string[]
): Record<string, string> {
  const allValues: Record<string, string> = {
    date: "TOTALS",
    personnel: "",
    project: "",
    customer: "",
    hours: totals.totalHours.toFixed(2),
    regularHours: totals.totalRegularHours.toFixed(2),
    overtimeHours: totals.totalOvertimeHours.toFixed(2),
    rate: "",
    regularPay: formatCurrency(totals.totalRegularPay),
    overtimePay: formatCurrency(totals.totalOvertimePay),
    totalPay: formatCurrency(totals.totalPay),
    billable: "",
    status: "",
    description: "",
  };

  const result: Record<string, string> = {};
  visibleColumns.forEach((col) => {
    result[col] = allValues[col] || "";
  });
  return result;
}

// Export to CSV
export function exportTimeEntriesToCSV(
  data: TimeEntryExportData,
  filename = "time-entries"
): void {
  const { 
    entries, 
    overtimeMultiplier = 1.5,
    visibleColumns = ALL_EXPORT_COLUMNS 
  } = data;

  if (entries.length === 0) {
    throw new Error("No time entries to export");
  }

  // Filter to only visible columns
  const columns = visibleColumns.filter((col) => COLUMN_CONFIG[col]);
  const headers = columns.map((col) => COLUMN_CONFIG[col].header);

  // Build CSV rows
  const rows = entries.map((entry) => {
    const values = getEntryRowValues(entry, columns, overtimeMultiplier);
    return columns
      .map((col) => `"${(values[col] || "").replace(/"/g, '""')}"`)
      .join(",");
  });

  // Add totals row
  const totals = calculateTotals(entries, overtimeMultiplier);
  const totalsValues = getTotalsRowValues(totals, columns);
  const totalsRow = columns
    .map((col) => `"${totalsValues[col] || ""}"`)
    .join(",");

  const csvContent = [headers.join(","), ...rows, totalsRow].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}-${format(new Date(), "yyyy-MM-dd")}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export to JSON
export function exportTimeEntriesToJSON(
  data: TimeEntryExportData,
  filename = "time-entries"
): void {
  const { 
    entries, 
    weekStart, 
    weekEnd, 
    overtimeMultiplier = 1.5,
    visibleColumns = ALL_EXPORT_COLUMNS 
  } = data;

  if (entries.length === 0) {
    throw new Error("No time entries to export");
  }

  const totals = calculateTotals(entries, overtimeMultiplier);

  // Build entry data based on visible columns
  const mappedEntries = entries.map((entry) => {
    const rate = getHourlyRate(entry);
    const result: Record<string, any> = { id: entry.id };
    
    if (visibleColumns.includes("date")) result.date = entry.entry_date;
    if (visibleColumns.includes("personnel")) {
      result.personnel = {
        id: entry.personnel_id || entry.user_id,
        name: getPersonnelName(entry),
        ...(visibleColumns.includes("rate") && { hourlyRate: rate }),
      };
    }
    if (visibleColumns.includes("project")) {
      result.project = {
        id: entry.project_id,
        name: entry.projects?.name || "Unknown Project",
        ...(visibleColumns.includes("customer") && { customer: entry.projects?.customers?.name || null }),
      };
    }
    if (visibleColumns.includes("hours")) result.hours = Number(entry.hours);
    if (visibleColumns.includes("regularHours")) result.regularHours = Number(entry.regular_hours) || Number(entry.hours);
    if (visibleColumns.includes("overtimeHours")) result.overtimeHours = Number(entry.overtime_hours) || 0;
    if (visibleColumns.includes("billable")) result.billable = entry.billable;
    if (visibleColumns.includes("status")) result.status = entry.status || "pending";
    if (visibleColumns.includes("description")) result.description = entry.description || null;
    
    return result;
  });

  const exportData: Record<string, any> = {
    exportDate: new Date().toISOString(),
    includedColumns: visibleColumns,
  };
  
  if (weekStart && weekEnd) {
    exportData.dateRange = {
      start: format(weekStart, "yyyy-MM-dd"),
      end: format(weekEnd, "yyyy-MM-dd"),
    };
  }
  
  exportData.summary = {
    totalEntries: entries.length,
    ...(visibleColumns.includes("hours") && { totalHours: totals.totalHours }),
    ...(visibleColumns.includes("regularHours") && { regularHours: totals.totalRegularHours }),
    ...(visibleColumns.includes("overtimeHours") && { overtimeHours: totals.totalOvertimeHours }),
    ...(visibleColumns.includes("totalPay") && { totalPay: totals.totalPay }),
    ...(visibleColumns.includes("regularPay") && { regularPay: totals.totalRegularPay }),
    ...(visibleColumns.includes("overtimePay") && { overtimePay: totals.totalOvertimePay }),
  };
  
  exportData.entries = mappedEntries;

  const jsonContent = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}-${format(new Date(), "yyyy-MM-dd")}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export to Excel
export async function exportTimeEntriesToExcel(
  data: TimeEntryExportData,
  filename = "time-entries"
): Promise<void> {
  const { 
    entries, 
    overtimeMultiplier = 1.5,
    visibleColumns = ALL_EXPORT_COLUMNS 
  } = data;

  if (entries.length === 0) {
    throw new Error("No time entries to export");
  }

  const columns = visibleColumns.filter((col) => COLUMN_CONFIG[col]);
  const totals = calculateTotals(entries, overtimeMultiplier);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Command X Time Tracking";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Time Entries", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // Define columns dynamically
  worksheet.columns = columns.map((col) => ({
    header: COLUMN_CONFIG[col].header,
    key: col,
    width: COLUMN_CONFIG[col].width,
  }));

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF3B82F6" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 25;

  // Add data rows
  entries.forEach((entry, index) => {
    const rowValues = getEntryRowValues(entry, columns, overtimeMultiplier);
    const row = worksheet.addRow(rowValues);

    row.alignment = { vertical: "middle", wrapText: true };
    if (index % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8FAFC" },
      };
    }
  });

  // Add totals row
  const totalsValues = getTotalsRowValues(totals, columns);
  const totalsRow = worksheet.addRow(totalsValues);
  totalsRow.font = { bold: true };
  totalsRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };

  // Add borders
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export to PDF
export function exportTimeEntriesToPDF(
  data: TimeEntryExportData,
  filename = "time-entries"
): void {
  const { 
    entries, 
    weekStart, 
    weekEnd, 
    overtimeMultiplier = 1.5,
    visibleColumns = ALL_EXPORT_COLUMNS 
  } = data;

  if (entries.length === 0) {
    throw new Error("No time entries to export");
  }

  const columns = visibleColumns.filter((col) => COLUMN_CONFIG[col]);
  const totals = calculateTotals(entries, overtimeMultiplier);
  const doc = new jsPDF({ orientation: "landscape" });

  // Title
  doc.setFontSize(18);
  doc.text("Time Entries Report", 14, 20);

  // Subtitle with date range
  doc.setFontSize(10);
  if (weekStart && weekEnd) {
    doc.text(
      `Week: ${format(weekStart, "MMM d, yyyy")} - ${format(
        weekEnd,
        "MMM d, yyyy"
      )}`,
      14,
      28
    );
  }
  doc.text(`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`, 14, 35);

  // Summary box
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 40, 265, 20, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Summary:", 18, 48);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Total Hours: ${totals.totalHours.toFixed(
      2
    )} (Regular: ${totals.totalRegularHours.toFixed(
      2
    )}, OT: ${totals.totalOvertimeHours.toFixed(2)})`,
    60,
    48
  );
  doc.text(
    `Total Pay: ${formatCurrency(totals.totalPay)} (Regular: ${formatCurrency(
      totals.totalRegularPay
    )}, OT: ${formatCurrency(totals.totalOvertimePay)})`,
    18,
    55
  );
  doc.text(`Entries: ${entries.length}`, 180, 55);

  // Table headers
  const headers = columns.map((col) => COLUMN_CONFIG[col].header);
  const colWidths = columns.map((col) => COLUMN_CONFIG[col].pdfWidth);
  
  // Scale widths to fit page if needed
  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
  const maxWidth = 265;
  const scale = totalWidth > maxWidth ? maxWidth / totalWidth : 1;
  const scaledWidths = colWidths.map((w) => w * scale);

  let y = 70;
  doc.setFillColor(59, 130, 246);
  doc.rect(14, y - 6, maxWidth, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");

  let x = 14;
  headers.forEach((header, i) => {
    doc.text(header, x + 2, y);
    x += scaledWidths[i];
  });

  // Data rows
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  y += 10;

  entries.forEach((entry, rowIndex) => {
    if (y > 180) {
      doc.addPage();
      y = 20;
    }

    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 5, maxWidth, 8, "F");
    }

    const rowValues = getEntryRowValues(entry, columns, overtimeMultiplier);
    // Use shorter date format for PDF
    if (rowValues.date) {
      rowValues.date = format(new Date(entry.entry_date), "MMM d");
    }

    x = 14;
    columns.forEach((col, i) => {
      const value = rowValues[col] || "";
      const maxChars = Math.floor(scaledWidths[i] / 2);
      const text =
        String(value).length > maxChars
          ? String(value).substring(0, maxChars - 1) + "…"
          : String(value);
      doc.text(text, x + 2, y);
      x += scaledWidths[i];
    });
    y += 8;
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Total: ${entries.length} entries | ${totals.totalHours.toFixed(
      2
    )} hours | ${formatCurrency(totals.totalPay)}`,
    14,
    doc.internal.pageSize.height - 10
  );

  doc.save(`${filename}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
