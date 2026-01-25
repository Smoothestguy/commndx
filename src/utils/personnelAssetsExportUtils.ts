import * as XLSX from "xlsx";
import type { PersonnelWithAssets } from "@/integrations/supabase/hooks/usePersonnelWithAssets";
import { format } from "date-fns";

interface ExportOptions {
  projectName: string;
  isAdmin: boolean;
}

// Extended type that includes unassignment fields
interface PersonnelWithAssetsExtended extends PersonnelWithAssets {
  status?: string;
  unassignedAt?: string | null;
  unassignedReason?: string | null;
  unassignedNotes?: string | null;
}

const REASON_LABELS: Record<string, string> = {
  sent_home: "Sent Home",
  no_show: "No Show",
  left_site: "Left Site",
  terminated: "Terminated",
  project_ended: "Project Ended",
  other: "Other",
};

/**
 * Generate multi-sheet Excel file for personnel with assets
 * Sheet 1: Assigned Personnel (summary)
 * Sheet 2: Personnel Assets (detailed)
 */
export function exportPersonnelWithAssetsToXLSX(
  data: PersonnelWithAssetsExtended[],
  options: ExportOptions
): void {
  const workbook = XLSX.utils.book_new();
  
  // ============ Sheet 1: Assigned Personnel (Summary) ============
  const personnelRows = data.map((p) => {
    // Build assets summary string
    const assetsSummary = p.assets.length > 0
      ? p.assets.map((a) => `${formatAssetType(a.type)}: ${a.label}`).join(" | ")
      : "No assets assigned";

    const isUnassigned = p.status && p.status !== "active";
    
    const row: Record<string, string> = {
      "Name": p.name,
      "Email": p.email,
      "Rate Bracket": p.rateBracket || "—",
      "Bill Rate": p.billRate != null ? formatCurrency(p.billRate) : "—",
      "Assigned Date": p.assignedAt ? format(new Date(p.assignedAt), "MMM d, yyyy") : "—",
      "Status": isUnassigned ? "Unassigned" : "Active",
      "Assets Summary": assetsSummary,
    };

    // Add unassignment info if applicable
    if (isUnassigned) {
      row["Unassigned Date"] = p.unassignedAt ? format(new Date(p.unassignedAt), "MMM d, yyyy") : "—";
      row["Unassignment Reason"] = p.unassignedReason ? (REASON_LABELS[p.unassignedReason] || p.unassignedReason) : "—";
      row["Unassignment Notes"] = p.unassignedNotes || "—";
    } else {
      row["Unassigned Date"] = "—";
      row["Unassignment Reason"] = "—";
      row["Unassignment Notes"] = "—";
    }

    return row;
  });

  const personnelSheet = XLSX.utils.json_to_sheet(personnelRows);
  
  // Set column widths for Sheet 1
  personnelSheet["!cols"] = [
    { wch: 25 }, // Name
    { wch: 30 }, // Email
    { wch: 15 }, // Rate Bracket
    { wch: 12 }, // Bill Rate
    { wch: 15 }, // Assigned Date
    { wch: 12 }, // Status
    { wch: 60 }, // Assets Summary
    { wch: 15 }, // Unassigned Date
    { wch: 18 }, // Unassignment Reason
    { wch: 40 }, // Unassignment Notes
  ];
  
  XLSX.utils.book_append_sheet(workbook, personnelSheet, "Assigned Personnel");

  // ============ Sheet 2: Personnel Assets (Detailed) ============
  const assetRows: Record<string, string>[] = [];
  
  data.forEach((p) => {
    if (p.assets.length === 0) {
      // Still include personnel with no assets
      assetRows.push({
        "Personnel Name": p.name,
        "Personnel Email": p.email,
        "Personnel Status": p.status === "active" ? "Active" : "Unassigned",
        "Asset Type": "—",
        "Asset Label": "No assets assigned",
        "Address": "—",
        "Access Hours": "—",
        "Instructions": "—",
        "Assigned At": p.assignedAt ? format(new Date(p.assignedAt), "MMM d, yyyy") : "—",
        "End At": "—",
      });
    } else {
      p.assets.forEach((asset: any) => {
        const row: Record<string, string> = {
          "Personnel Name": p.name,
          "Personnel Email": p.email,
          "Personnel Status": p.status === "active" ? "Active" : "Unassigned",
          "Asset Type": formatAssetType(asset.type),
          "Asset Label": asset.label,
          "Address": asset.address || "—",
          "Access Hours": asset.accessHours || "—",
          "Instructions": asset.instructions || "—",
          "Assigned At": asset.startAt ? format(new Date(asset.startAt), "MMM d, yyyy") : "—",
          "End At": asset.endAt ? format(new Date(asset.endAt), "MMM d, yyyy") : "—",
        };

        // Only include access codes for admin users
        if (options.isAdmin && asset.accessCode) {
          row["Access Code"] = asset.accessCode;
        }

        assetRows.push(row);
      });
    }
  });

  // Build headers based on whether we include access codes
  const headers = options.isAdmin
    ? [
        "Personnel Name",
        "Personnel Email",
        "Personnel Status",
        "Asset Type",
        "Asset Label",
        "Address",
        "Access Hours",
        "Instructions",
        "Access Code",
        "Assigned At",
        "End At",
      ]
    : [
        "Personnel Name",
        "Personnel Email",
        "Personnel Status",
        "Asset Type",
        "Asset Label",
        "Address",
        "Access Hours",
        "Instructions",
        "Assigned At",
        "End At",
      ];

  const assetsSheet = XLSX.utils.json_to_sheet(assetRows, { header: headers });
  
  // Set column widths for Sheet 2
  const colWidths = options.isAdmin
    ? [
        { wch: 25 }, // Personnel Name
        { wch: 30 }, // Personnel Email
        { wch: 12 }, // Personnel Status
        { wch: 15 }, // Asset Type
        { wch: 30 }, // Asset Label
        { wch: 35 }, // Address
        { wch: 20 }, // Access Hours
        { wch: 40 }, // Instructions
        { wch: 15 }, // Access Code
        { wch: 15 }, // Assigned At
        { wch: 15 }, // End At
      ]
    : [
        { wch: 25 }, // Personnel Name
        { wch: 30 }, // Personnel Email
        { wch: 12 }, // Personnel Status
        { wch: 15 }, // Asset Type
        { wch: 30 }, // Asset Label
        { wch: 35 }, // Address
        { wch: 20 }, // Access Hours
        { wch: 40 }, // Instructions
        { wch: 15 }, // Assigned At
        { wch: 15 }, // End At
      ];
  
  assetsSheet["!cols"] = colWidths;
  
  XLSX.utils.book_append_sheet(workbook, assetsSheet, "Personnel Assets");

  // Generate filename with timestamp
  const timestamp = format(new Date(), "yyyy-MM-dd");
  const sanitizedProjectName = options.projectName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
  const filename = `${sanitizedProjectName}_Personnel_Export_${timestamp}.xlsx`;

  // Write and download
  XLSX.writeFile(workbook, filename);
}

// Helper functions
function formatAssetType(type: string): string {
  return type
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
