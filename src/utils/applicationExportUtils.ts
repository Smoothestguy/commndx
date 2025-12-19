import { format } from "date-fns";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import type { Application } from "@/integrations/supabase/hooks/useStaffingApplications";

interface ExportApplication {
  name: string;
  email: string;
  phone: string;
  position: string;
  project: string;
  submittedDate: string;
  status: string;
}

function formatApplicationsForExport(applications: Application[]): ExportApplication[] {
  return applications.map((app) => ({
    name: `${app.applicants?.first_name || ""} ${app.applicants?.last_name || ""}`.trim(),
    email: app.applicants?.email || "",
    phone: app.applicants?.phone || "",
    position: app.job_postings?.project_task_orders?.title || "",
    project: app.job_postings?.project_task_orders?.projects?.name || "",
    submittedDate: format(new Date(app.created_at), "MMM d, yyyy"),
    status: app.status.charAt(0).toUpperCase() + app.status.slice(1),
  }));
}

export function exportApplicationsToCSV(applications: Application[], filename = "applications"): void {
  if (applications.length === 0) {
    throw new Error("No applications to export");
  }

  const data = formatApplicationsForExport(applications);
  const headers = ["Name", "Email", "Phone", "Position", "Project", "Submitted Date", "Status"];
  
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      [
        `"${row.name}"`,
        `"${row.email}"`,
        `"${row.phone}"`,
        `"${row.position}"`,
        `"${row.project}"`,
        `"${row.submittedDate}"`,
        `"${row.status}"`,
      ].join(",")
    ),
  ].join("\n");

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

export function exportApplicationsToExcel(applications: Application[], filename = "applications"): void {
  if (applications.length === 0) {
    throw new Error("No applications to export");
  }

  const data = formatApplicationsForExport(applications);
  const worksheet = XLSX.utils.json_to_sheet(data, {
    header: ["name", "email", "phone", "position", "project", "submittedDate", "status"],
  });

  // Rename headers
  worksheet["A1"].v = "Name";
  worksheet["B1"].v = "Email";
  worksheet["C1"].v = "Phone";
  worksheet["D1"].v = "Position";
  worksheet["E1"].v = "Project";
  worksheet["F1"].v = "Submitted Date";
  worksheet["G1"].v = "Status";

  // Set column widths
  worksheet["!cols"] = [
    { wch: 25 }, // Name
    { wch: 30 }, // Email
    { wch: 15 }, // Phone
    { wch: 25 }, // Position
    { wch: 25 }, // Project
    { wch: 15 }, // Submitted Date
    { wch: 12 }, // Status
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Applications");

  XLSX.writeFile(workbook, `${filename}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
}

export function exportApplicationsToPDF(applications: Application[], filename = "applications"): void {
  if (applications.length === 0) {
    throw new Error("No applications to export");
  }

  const data = formatApplicationsForExport(applications);
  const doc = new jsPDF({ orientation: "landscape" });

  // Title
  doc.setFontSize(18);
  doc.text("Applications Report", 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`, 14, 28);

  // Table headers
  const headers = ["Name", "Email", "Phone", "Position", "Project", "Date", "Status"];
  const colWidths = [40, 55, 30, 45, 45, 25, 25];
  const startY = 40;
  let y = startY;

  // Header row
  doc.setFillColor(59, 130, 246);
  doc.rect(14, y - 6, 265, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
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

  data.forEach((row, rowIndex) => {
    if (y > 180) {
      doc.addPage();
      y = 20;
    }

    // Alternate row colors
    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 5, 265, 8, "F");
    }

    x = 14;
    const values = [row.name, row.email, row.phone, row.position, row.project, row.submittedDate, row.status];
    values.forEach((value, i) => {
      const text = String(value).substring(0, Math.floor(colWidths[i] / 2.5));
      doc.text(text, x + 2, y);
      x += colWidths[i];
    });
    y += 8;
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Total: ${data.length} application(s)`, 14, doc.internal.pageSize.height - 10);

  doc.save(`${filename}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
