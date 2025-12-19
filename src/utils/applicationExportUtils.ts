import { format } from "date-fns";
import jsPDF from "jspdf";
import ExcelJS from "exceljs";
import type { Application } from "@/integrations/supabase/hooks/useStaffingApplications";
import type { ApplicationFormTemplate, FormField } from "@/integrations/supabase/hooks/useApplicationFormTemplates";

interface ExportApplication {
  name: string;
  email: string;
  phone: string;
  position: string;
  project: string;
  submittedDate: string;
  status: string;
}

// Helper to get field value from answers
function getAnswerValue(answers: Record<string, any> | null, fieldId: string): any {
  if (!answers) return null;
  return answers[fieldId];
}

// Format field value based on type
function formatFieldValue(value: any, field: FormField): string {
  if (value === null || value === undefined || value === "") return "";
  
  switch (field.type) {
    case "date":
      try {
        return format(new Date(value), "dd-MMM-yyyy");
      } catch {
        return String(value);
      }
    case "checkbox":
      return value === true || value === "true" ? "Yes" : "No";
    case "multiselect":
      if (Array.isArray(value)) return value.join(", ");
      return String(value);
    case "address":
      if (typeof value === "object") {
        const parts = [
          value.street,
          value.city,
          value.state,
          value.zip,
          value.country,
        ].filter(Boolean);
        return parts.join(", ");
      }
      return String(value);
    case "file":
      // Return URL or empty if it's an empty object
      if (typeof value === "object" && Object.keys(value).length === 0) return "";
      if (typeof value === "string" && value.startsWith("http")) return value;
      return "";
    case "signature":
      return value ? "[Signature]" : "";
    default:
      return String(value);
  }
}

// Check if a field is a profile picture field
function isProfilePictureField(field: FormField): boolean {
  const label = field.label.toLowerCase();
  return field.type === "file" && (
    label.includes("profile") || 
    label.includes("photo") || 
    label.includes("picture") ||
    label.includes("headshot")
  );
}

// Fetch image as base64
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Get form template for an application
function getTemplateForApplication(
  application: Application,
  templates: ApplicationFormTemplate[]
): ApplicationFormTemplate | null {
  const templateId = application.job_postings?.form_template_id;
  if (!templateId) return null;
  return templates.find(t => t.id === templateId) || null;
}

// Build dynamic columns from form template
function buildColumnsFromTemplate(template: ApplicationFormTemplate | null): FormField[] {
  if (!template) return [];
  
  // Filter out section fields and sort by layout order if available
  return template.fields.filter(f => f.type !== "section");
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

export async function exportApplicationsToExcel(
  applications: Application[], 
  templates: ApplicationFormTemplate[],
  filename = "applications"
): Promise<void> {
  if (applications.length === 0) {
    throw new Error("No applications to export");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Staffing Applications";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Applications", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // Get the first application's template to determine columns
  const firstTemplate = getTemplateForApplication(applications[0], templates);
  const formFields = buildColumnsFromTemplate(firstTemplate);
  
  // Find profile picture field
  const profilePicField = formFields.find(isProfilePictureField);
  const otherFields = formFields.filter(f => !isProfilePictureField(f));

  // Build column headers: Photo | Name | Email | Phone | Dynamic Fields... | Submitted
  const columns: Partial<ExcelJS.Column>[] = [];
  
  // Photo column (if profile picture field exists)
  if (profilePicField) {
    columns.push({ header: "Photo", key: "photo", width: 12 });
  }
  
  // Core columns
  columns.push({ header: "Name", key: "name", width: 25 });
  columns.push({ header: "Email", key: "email", width: 30 });
  columns.push({ header: "Phone", key: "phone", width: 18 });
  
  // Dynamic form field columns
  for (const field of otherFields) {
    // Skip core fields that are already added
    if (["firstname", "lastname", "email", "phone"].includes(field.type)) continue;
    
    columns.push({
      header: field.label,
      key: field.id,
      width: Math.min(Math.max(field.label.length + 5, 15), 40),
    });
  }
  
  // Submitted date column
  columns.push({ header: "Submitted", key: "submitted", width: 15 });

  worksheet.columns = columns;

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

  // Collect image URLs for fetching
  const imagePromises: Promise<{ rowIndex: number; base64: string | null }>[] = [];

  // Add data rows
  for (let i = 0; i < applications.length; i++) {
    const app = applications[i];
    const answers = (app.answers || {}) as Record<string, any>;
    const rowData: Record<string, any> = {};
    
    // Core fields
    rowData.name = `${app.applicants?.first_name || ""} ${app.applicants?.last_name || ""}`.trim();
    rowData.email = app.applicants?.email || "";
    rowData.phone = app.applicants?.phone || "";
    rowData.submitted = format(new Date(app.created_at), "dd-MMM-yyyy");
    
    // Photo placeholder
    if (profilePicField) {
      rowData.photo = ""; // Will be filled with image
    }
    
    // Dynamic form fields
    for (const field of otherFields) {
      if (["firstname", "lastname", "email", "phone"].includes(field.type)) continue;
      const value = getAnswerValue(answers, field.id);
      rowData[field.id] = formatFieldValue(value, field);
    }
    
    const row = worksheet.addRow(rowData);
    row.height = profilePicField ? 60 : 20;
    row.alignment = { vertical: "middle", wrapText: true };
    
    // Alternate row colors
    if (i % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8FAFC" },
      };
    }

    // Queue image fetch if profile picture exists
    if (profilePicField) {
      const imageUrl = getAnswerValue(answers, profilePicField.id);
      if (typeof imageUrl === "string" && imageUrl.startsWith("http")) {
        const rowIndex = i + 2; // Excel rows are 1-indexed, +1 for header
        imagePromises.push(
          fetchImageAsBase64(imageUrl).then(base64 => ({ rowIndex, base64 }))
        );
      }
    }
  }

  // Add images to worksheet
  const imageResults = await Promise.all(imagePromises);
  for (const { rowIndex, base64 } of imageResults) {
    if (base64) {
      try {
        // Extract the extension from base64 data URL
        const match = base64.match(/^data:image\/(\w+);base64,/);
        const extension = match ? match[1] as "png" | "jpeg" | "gif" : "png";
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
        
        const imageId = workbook.addImage({
          base64: base64Data,
          extension,
        });

        worksheet.addImage(imageId, {
          tl: { col: 0.1, row: rowIndex - 1 + 0.1 },
          ext: { width: 50, height: 50 },
        });
      } catch (e) {
        console.error("Failed to add image:", e);
      }
    }
  }

  // Add borders to all cells
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  // Generate and download file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
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
