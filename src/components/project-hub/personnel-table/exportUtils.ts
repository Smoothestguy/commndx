import * as XLSX from "xlsx";
import type { PersonnelColumnConfig, PersonnelRowData } from "./types";

function formatCurrency(value: number | null): string {
  if (value == null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getAssetsSummary(assets: PersonnelRowData["assets"]): string {
  if (!assets || assets.length === 0) return "";
  return assets.map((a) => `${a.type}: ${a.label}`).join(" | ");
}

function getColumnValue(
  row: PersonnelRowData,
  columnKey: string,
  isAdmin: boolean
): string {
  switch (columnKey) {
    case "name":
      return row.name;
    case "email":
      return row.email;
    case "phone":
      return row.phone || "";
    case "city":
      return row.city || "";
    case "state":
      return row.state || "";
    case "payRate":
      return row.payRate != null ? formatCurrency(row.payRate) : "";
    case "billRate":
      return row.billRate != null ? formatCurrency(row.billRate) : "";
    case "rateBracket":
      return row.rateBracket || "";
    case "assignedDate":
      return formatDate(row.assignedAt);
    case "assets":
      return getAssetsSummary(row.assets);
    default:
      return "";
  }
}

export function exportPersonnelToCSV(
  data: PersonnelRowData[],
  columns: PersonnelColumnConfig[],
  filename: string,
  isAdmin: boolean
): void {
  const visibleColumns = columns.filter((c) => c.visible);
  const headers = visibleColumns.map((c) => c.label);

  const rows = data.map((row) =>
    visibleColumns.map((col) => getColumnValue(row, col.key, isAdmin))
  );

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${(cell || "").replace(/"/g, '""')}"`).join(",")
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

export function exportPersonnelToXLSX(
  data: PersonnelRowData[],
  columns: PersonnelColumnConfig[],
  filename: string,
  isAdmin: boolean
): void {
  const visibleColumns = columns.filter((c) => c.visible);
  const headers = visibleColumns.map((c) => c.label);

  // Sheet 1: Personnel Summary
  const summaryRows = data.map((row) =>
    visibleColumns.reduce((acc, col) => {
      const value = getColumnValue(row, col.key, isAdmin);
      // Keep numeric values as numbers for rate columns
      if ((col.key === "payRate" || col.key === "billRate") && row[col.key as keyof PersonnelRowData] != null) {
        acc[col.label] = row[col.key as keyof PersonnelRowData] as number;
      } else {
        acc[col.label] = value;
      }
      return acc;
    }, {} as Record<string, string | number>)
  );

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows, { header: headers });

  // Set column widths
  summarySheet["!cols"] = headers.map((h) => ({
    wch: Math.max(h.length, 15),
  }));

  // Sheet 2: Asset Details (if assets column is visible)
  let assetRows: Record<string, string>[] = [];
  if (visibleColumns.some((c) => c.key === "assets")) {
    data.forEach((person) => {
      if (person.assets && person.assets.length > 0) {
        person.assets.forEach((asset) => {
          assetRows.push({
            "Personnel Name": person.name,
            "Personnel Email": person.email,
            "Asset Type": asset.type,
            "Asset Label": asset.label,
            "Address": asset.address || "",
            "Access Hours": asset.accessHours || "",
            "Instructions": asset.instructions || "",
            "End Date": asset.endAt ? formatDate(asset.endAt) : "",
          });
        });
      }
    });
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Assigned Personnel");

  if (assetRows.length > 0) {
    const assetSheet = XLSX.utils.json_to_sheet(assetRows);
    assetSheet["!cols"] = [
      { wch: 25 }, // Personnel Name
      { wch: 30 }, // Personnel Email
      { wch: 15 }, // Asset Type
      { wch: 25 }, // Asset Label
      { wch: 35 }, // Address
      { wch: 20 }, // Access Hours
      { wch: 40 }, // Instructions
      { wch: 15 }, // End Date
    ];
    XLSX.utils.book_append_sheet(workbook, assetSheet, "Personnel Assets");
  }

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
