import * as XLSX from "xlsx";
import type { PersonnelProjectAssignment, PersonnelWithAssignment, RateBracketInfo } from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";

export interface PersonnelAssignmentExportRow {
  id: string;
  personnelId: string;
  personnelName: string;
  email: string;
  phone: string;
  rateBracket: string;
  billRate: number | null;
  payRate: number | null;
  assignedAt: string;
  status: string;
}

export interface ExportColumn {
  key: keyof PersonnelAssignmentExportRow;
  label: string;
  visible: boolean;
  requiresPermission?: boolean;
}

export const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "personnelName", label: "Personnel Name", visible: true },
  { key: "email", label: "Email", visible: true },
  { key: "phone", label: "Phone", visible: true },
  { key: "rateBracket", label: "Rate Bracket", visible: true },
  { key: "billRate", label: "Bill Rate", visible: true },
  { key: "payRate", label: "Pay Rate", visible: false, requiresPermission: true },
  { key: "assignedAt", label: "Assigned Date", visible: true },
  { key: "status", label: "Status", visible: true },
];

export function transformAssignmentToExportRow(
  assignment: PersonnelProjectAssignment & {
    personnel: PersonnelWithAssignment | null;
    project_rate_brackets: RateBracketInfo | null;
  }
): PersonnelAssignmentExportRow {
  const personnel = assignment.personnel;
  const rateBracket = assignment.project_rate_brackets;
  const billRate = assignment.bill_rate ?? rateBracket?.bill_rate ?? null;

  return {
    id: assignment.id,
    personnelId: assignment.personnel_id,
    personnelName: personnel
      ? `${personnel.first_name} ${personnel.last_name}`
      : "Unknown",
    email: personnel?.email || "",
    phone: personnel?.phone || "",
    rateBracket: rateBracket?.name || "",
    billRate,
    payRate: personnel?.pay_rate ?? personnel?.hourly_rate ?? null,
    assignedAt: assignment.assigned_at
      ? new Date(assignment.assigned_at).toLocaleDateString()
      : "",
    status: assignment.status || "active",
  };
}

export function formatCurrency(value: number | null): string {
  if (value == null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function exportToCSV(
  data: PersonnelAssignmentExportRow[],
  columns: ExportColumn[],
  filename: string
): void {
  const visibleColumns = columns.filter((c) => c.visible);
  const headers = visibleColumns.map((c) => c.label);

  const rows = data.map((row) =>
    visibleColumns.map((col) => {
      const value = row[col.key];
      if (col.key === "billRate" || col.key === "payRate") {
        return formatCurrency(value as number | null);
      }
      return value?.toString() || "";
    })
  );

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToXLSX(
  data: PersonnelAssignmentExportRow[],
  columns: ExportColumn[],
  filename: string
): void {
  const visibleColumns = columns.filter((c) => c.visible);
  const headers = visibleColumns.map((c) => c.label);

  const rows = data.map((row) =>
    visibleColumns.reduce((acc, col) => {
      const value = row[col.key];
      if (col.key === "billRate" || col.key === "payRate") {
        acc[col.label] = value != null ? value : "";
      } else {
        acc[col.label] = value?.toString() || "";
      }
      return acc;
    }, {} as Record<string, string | number>)
  );

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });

  // Set column widths
  const colWidths = headers.map((h) => ({ wch: Math.max(h.length, 15) }));
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Personnel Assignments");

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export type ExportFormat = "csv" | "xlsx";
export type ExportScope = "selected" | "filtered" | "all";

export interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  columns: ExportColumn[];
  selectedIds?: string[];
}

export function performExport(
  allData: PersonnelAssignmentExportRow[],
  options: ExportOptions,
  filename: string
): void {
  let dataToExport = allData;

  if (options.scope === "selected" && options.selectedIds?.length) {
    dataToExport = allData.filter((row) => options.selectedIds!.includes(row.id));
  }

  const timestamp = new Date().toISOString().split("T")[0];
  const fullFilename = `${filename}_${timestamp}`;

  if (options.format === "csv") {
    exportToCSV(dataToExport, options.columns, fullFilename);
  } else {
    exportToXLSX(dataToExport, options.columns, fullFilename);
  }
}
