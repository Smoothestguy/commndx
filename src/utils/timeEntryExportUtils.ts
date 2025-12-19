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
}

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

// Export to JSON
export function exportTimeEntriesToJSON(
  data: TimeEntryExportData,
  filename = "time-entries"
): void {
  const { entries, weekStart, weekEnd, overtimeMultiplier = 1.5 } = data;

  if (entries.length === 0) {
    throw new Error("No time entries to export");
  }

  const totals = calculateTotals(entries, overtimeMultiplier);

  const exportData = {
    exportDate: new Date().toISOString(),
    dateRange:
      weekStart && weekEnd
        ? {
            start: format(weekStart, "yyyy-MM-dd"),
            end: format(weekEnd, "yyyy-MM-dd"),
          }
        : null,
    summary: {
      totalEntries: entries.length,
      totalHours: totals.totalHours,
      regularHours: totals.totalRegularHours,
      overtimeHours: totals.totalOvertimeHours,
      totalPay: totals.totalPay,
      regularPay: totals.totalRegularPay,
      overtimePay: totals.totalOvertimePay,
      overtimeMultiplier,
    },
    entries: entries.map((entry) => ({
      id: entry.id,
      date: entry.entry_date,
      personnel: {
        id: entry.personnel_id || entry.user_id,
        name: getPersonnelName(entry),
        hourlyRate: getHourlyRate(entry),
      },
      project: {
        id: entry.project_id,
        name: entry.projects?.name || "Unknown Project",
        customer: entry.projects?.customers?.name || null,
      },
      hours: Number(entry.hours),
      regularHours: Number(entry.regular_hours) || Number(entry.hours),
      overtimeHours: Number(entry.overtime_hours) || 0,
      isHoliday: entry.is_holiday || false,
      billable: entry.billable,
      status: entry.status || "pending",
      description: entry.description || null,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    })),
  };

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

// Export to Excel - defined first part
export async function exportTimeEntriesToExcel(
  data: TimeEntryExportData,
  filename = "time-entries"
): Promise<void> {
  const { entries, weekStart, weekEnd, overtimeMultiplier = 1.5 } = data;

  if (entries.length === 0) {
    throw new Error("No time entries to export");
  }

  const totals = calculateTotals(entries, overtimeMultiplier);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Command X Time Tracking";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Time Entries", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // Define columns
  worksheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Personnel", key: "personnel", width: 25 },
    { header: "Project", key: "project", width: 30 },
    { header: "Customer", key: "customer", width: 25 },
    { header: "Hours", key: "hours", width: 10 },
    { header: "Regular Hrs", key: "regularHours", width: 12 },
    { header: "OT Hrs", key: "overtimeHours", width: 10 },
    { header: "Rate", key: "rate", width: 12 },
    { header: "Regular Pay", key: "regularPay", width: 14 },
    { header: "OT Pay", key: "overtimePay", width: 12 },
    { header: "Total Pay", key: "totalPay", width: 14 },
    { header: "Billable", key: "billable", width: 10 },
    { header: "Status", key: "status", width: 12 },
    { header: "Description", key: "description", width: 40 },
  ];

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
    const rate = getHourlyRate(entry) || 0;
    const regularHours = Number(entry.regular_hours) || Number(entry.hours);
    const overtimeHours = Number(entry.overtime_hours) || 0;
    const regularPay = regularHours * rate;
    const overtimePay = overtimeHours * rate * overtimeMultiplier;

    const row = worksheet.addRow({
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
    });

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
  const totalsRow = worksheet.addRow({
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
  });
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
  const { entries, weekStart, weekEnd, overtimeMultiplier = 1.5 } = data;

  if (entries.length === 0) {
    throw new Error("No time entries to export");
  }

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
  const headers = [
    "Date",
    "Personnel",
    "Project",
    "Hours",
    "Reg Hrs",
    "OT Hrs",
    "Rate",
    "Total Pay",
    "Status",
  ];
  const colWidths = [25, 45, 55, 18, 20, 18, 22, 28, 20];

  let y = 70;
  doc.setFillColor(59, 130, 246);
  doc.rect(14, y - 6, 265, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");

  let x = 14;
  headers.forEach((header, i) => {
    doc.text(header, x + 2, y);
    x += colWidths[i];
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
      doc.rect(14, y - 5, 265, 8, "F");
    }

    const rate = getHourlyRate(entry) || 0;
    const regularHours = Number(entry.regular_hours) || Number(entry.hours);
    const overtimeHours = Number(entry.overtime_hours) || 0;
    const totalPay =
      regularHours * rate + overtimeHours * rate * overtimeMultiplier;

    const values = [
      format(new Date(entry.entry_date), "MMM d"),
      getPersonnelName(entry),
      entry.projects?.name || "Unknown",
      Number(entry.hours).toFixed(2),
      regularHours.toFixed(2),
      overtimeHours.toFixed(2),
      rate ? formatCurrency(rate) : "-",
      rate ? formatCurrency(totalPay) : "-",
      (entry.status || "pending").charAt(0).toUpperCase() +
        (entry.status || "pending").slice(1),
    ];

    x = 14;
    values.forEach((value, i) => {
      const maxChars = Math.floor(colWidths[i] / 2);
      const text =
        String(value).length > maxChars
          ? String(value).substring(0, maxChars - 1) + "…"
          : String(value);
      doc.text(text, x + 2, y);
      x += colWidths[i];
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
