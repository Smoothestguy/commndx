import type { PersonnelAsset } from "@/integrations/supabase/hooks/usePersonnelWithAssets";

export interface PersonnelColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  defaultVisible: boolean;
  width?: string;
}

export const PERSONNEL_COLUMNS: PersonnelColumnConfig[] = [
  { key: "name", label: "Name", visible: true, defaultVisible: true },
  { key: "email", label: "Email", visible: true, defaultVisible: true },
  { key: "phone", label: "Phone", visible: false, defaultVisible: false },
  { key: "city", label: "City", visible: true, defaultVisible: true },
  { key: "state", label: "State", visible: true, defaultVisible: true },
  { key: "payRate", label: "Pay Rate", visible: true, defaultVisible: true },
  { key: "billRate", label: "Bill Rate", visible: false, defaultVisible: false },
  { key: "rateBracket", label: "Rate Bracket", visible: true, defaultVisible: true },
  { key: "assignedDate", label: "Assigned Date", visible: true, defaultVisible: true },
  { key: "assets", label: "Assets", visible: true, defaultVisible: true },
];

export interface PersonnelRowData {
  personnelId: string;
  assignmentId: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  payRate: number | null;
  billRate: number | null;
  rateBracket: string | null;
  rateBracketId: string | null;
  assignedAt: string | null;
  assets: PersonnelAsset[];
  status: string;
  unassignedAt: string | null;
  unassignedReason: string | null;
  unassignedNotes: string | null;
}

export type ExportFormat = "csv" | "xlsx";
export type ExportScope = "selected" | "filtered" | "all";

export interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  columns: PersonnelColumnConfig[];
  selectedIds?: string[];
}
