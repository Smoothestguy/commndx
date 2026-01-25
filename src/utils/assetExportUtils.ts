import * as XLSX from "xlsx";
import type { AssetAssignmentWithDetails } from "@/integrations/supabase/hooks/useAssetAssignments";

export interface AssetExportRow {
  id: string;
  assetId: string;
  assetLabel: string;
  assetType: string;
  serialNumber: string;
  address: string;
  assignedTo: string;
  startAt: string;
  endAt: string;
  status: string;
  notes: string;
}

export interface AssetExportColumn {
  key: keyof AssetExportRow;
  label: string;
  visible: boolean;
  requiresPermission?: boolean;
}

export const DEFAULT_ASSET_EXPORT_COLUMNS: AssetExportColumn[] = [
  { key: "assetLabel", label: "Asset Label", visible: true },
  { key: "assetType", label: "Type", visible: true },
  { key: "serialNumber", label: "Serial Number", visible: true },
  { key: "address", label: "Address", visible: true },
  { key: "assignedTo", label: "Assigned To", visible: true },
  { key: "startAt", label: "Start Date", visible: true },
  { key: "endAt", label: "End Date", visible: true },
  { key: "status", label: "Status", visible: true },
  { key: "notes", label: "Notes", visible: true },
];

export function transformAssetAssignmentToExportRow(
  assignment: AssetAssignmentWithDetails
): AssetExportRow {
  const asset = assignment.assets;
  const personnel = assignment.personnel;

  return {
    id: assignment.id,
    assetId: assignment.asset_id,
    assetLabel: asset?.label || "Unknown",
    assetType: asset?.type || "",
    serialNumber: asset?.serial_number || "",
    address: asset?.address || "",
    assignedTo: personnel
      ? `${personnel.first_name} ${personnel.last_name}`
      : "Project-wide",
    startAt: assignment.start_at
      ? new Date(assignment.start_at).toLocaleDateString()
      : "",
    endAt: assignment.end_at
      ? new Date(assignment.end_at).toLocaleDateString()
      : "",
    status: assignment.status || "active",
    notes: assignment.notes || "",
  };
}

export function exportAssetsToCSV(
  data: AssetExportRow[],
  columns: AssetExportColumn[],
  filename: string
): void {
  const visibleColumns = columns.filter((c) => c.visible);
  const headers = visibleColumns.map((c) => c.label);

  const rows = data.map((row) =>
    visibleColumns.map((col) => {
      const value = row[col.key];
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

export function exportAssetsToXLSX(
  data: AssetExportRow[],
  columns: AssetExportColumn[],
  filename: string
): void {
  const visibleColumns = columns.filter((c) => c.visible);
  const headers = visibleColumns.map((c) => c.label);

  const rows = data.map((row) =>
    visibleColumns.reduce((acc, col) => {
      acc[col.label] = row[col.key]?.toString() || "";
      return acc;
    }, {} as Record<string, string>)
  );

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });

  const colWidths = headers.map((h) => ({ wch: Math.max(h.length, 15) }));
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Asset Assignments");

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export type AssetExportFormat = "csv" | "xlsx";
export type AssetExportScope = "selected" | "filtered" | "all";

export interface AssetExportOptions {
  format: AssetExportFormat;
  scope: AssetExportScope;
  columns: AssetExportColumn[];
  selectedIds?: string[];
}

export function performAssetExport(
  allData: AssetExportRow[],
  options: AssetExportOptions,
  filename: string
): void {
  let dataToExport = allData;

  if (options.scope === "selected" && options.selectedIds?.length) {
    dataToExport = allData.filter((row) => options.selectedIds!.includes(row.id));
  }

  const timestamp = new Date().toISOString().split("T")[0];
  const fullFilename = `${filename}_${timestamp}`;

  if (options.format === "csv") {
    exportAssetsToCSV(dataToExport, options.columns, fullFilename);
  } else {
    exportAssetsToXLSX(dataToExport, options.columns, fullFilename);
  }
}
