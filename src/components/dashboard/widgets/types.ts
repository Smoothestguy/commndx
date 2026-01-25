import { LucideIcon } from "lucide-react";

// Widget position and size in the grid
export interface WidgetPosition {
  row: number;
  col: number;
}

export interface WidgetSize {
  width: number; // Grid columns (1-4)
  height: number; // Grid rows
}

// Layout configuration
export interface LayoutWidget {
  widgetId: string;
  position: WidgetPosition;
  size: WidgetSize;
}

export interface DashboardLayout {
  columns: number; // 1-4 columns
  widgets: LayoutWidget[];
}

// Widget configuration
export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  config: WidgetConfig;
  visible: boolean;
}

export type WidgetType =
  | "stat"
  | "chart"
  | "activity"
  | "quick-actions"
  | "table"
  | "welcome"
  | "assignments"
  | "reimbursements"
  | "trash";

export interface WidgetConfig {
  dataSource?: string;
  metric?: string;
  filters?: Record<string, unknown>;
  displayOptions?: {
    compact?: boolean;
    showChange?: boolean;
    showIcon?: boolean;
    chartType?: "pie" | "bar" | "line";
    limit?: number;
  };
}

// Theme configuration
export interface DashboardTheme {
  backgroundColor?: string;
  cardBackground?: string;
  cardTextColor?: string;
  cardOpacity?: number;
  fontFamily?: string;
  fontSize?: "small" | "medium" | "large";
  spacing?: "compact" | "normal" | "relaxed";
  accentColor?: string;
  borderRadius?: "none" | "small" | "medium" | "large";
  // Background media
  backgroundImage?: string;
  backgroundVideo?: string;
  backgroundSize?: "cover" | "contain" | "auto";
  backgroundPosition?: "center" | "top" | "bottom";
  backgroundOverlay?: number; // 0-100 opacity for dark overlay
  backgroundPages?: string[]; // Array of page identifiers where background should appear
  // Density mode for different UI compactness levels
  density?: "normal" | "spreadsheet" | "2k1";
  // Sidebar customization
  leftSidebarBackground?: string;
  leftSidebarTextColor?: string;
  rightSidebarBackground?: string;
  rightSidebarTextColor?: string;
  // Navigation menu customization
  menuBackground?: string;
  menuTextColor?: string;
}

// Widget registry entry
export interface WidgetRegistryEntry {
  type: WidgetType;
  title: string;
  titleLink?: string;
  description: string;
  icon: LucideIcon;
  category: "stats" | "charts" | "lists" | "actions" | "other";
  defaultSize: WidgetSize;
  defaultConfig: WidgetConfig;
  minSize?: WidgetSize;
  maxSize?: WidgetSize;
}

// Default configurations
export const DEFAULT_LAYOUT: DashboardLayout = {
  columns: 4,
  widgets: [
    // Row 0: Welcome Banner (full width)
    { widgetId: "welcome", position: { row: 0, col: 0 }, size: { width: 4, height: 1 } },
    
    // Row 1: KPI Stats (4 equal-width cards)
    { widgetId: "revenue-stat", position: { row: 1, col: 0 }, size: { width: 1, height: 1 } },
    { widgetId: "projects-stat", position: { row: 1, col: 1 }, size: { width: 1, height: 1 } },
    { widgetId: "staffing-stat", position: { row: 1, col: 2 }, size: { width: 1, height: 1 } },
    { widgetId: "pending-invoices-stat", position: { row: 1, col: 3 }, size: { width: 1, height: 1 } },
    
    // Row 2: Quick Actions (full width)
    { widgetId: "quick-actions", position: { row: 2, col: 0 }, size: { width: 4, height: 1 } },
    
    // Row 3-4: Charts & Activity (2 cols each, 2 rows tall)
    { widgetId: "revenue-bar-chart", position: { row: 3, col: 0 }, size: { width: 2, height: 2 } },
    { widgetId: "recent-activity", position: { row: 3, col: 2 }, size: { width: 2, height: 2 } },
    
    // Row 5-6: Tables (2 cols each, 2 rows tall)
    { widgetId: "recent-invoices", position: { row: 5, col: 0 }, size: { width: 2, height: 2 } },
    { widgetId: "trash", position: { row: 5, col: 2 }, size: { width: 2, height: 2 } },
  ],
};

export const DEFAULT_WIDGETS: DashboardWidget[] = [
  {
    id: "welcome",
    type: "welcome",
    title: "Welcome",
    config: {},
    visible: true,
  },
  {
    id: "revenue-stat",
    type: "stat",
    title: "Revenue",
    config: { dataSource: "invoices", metric: "revenue" },
    visible: true,
  },
  {
    id: "projects-stat",
    type: "stat",
    title: "Active Projects",
    config: { dataSource: "projects", metric: "active_count" },
    visible: true,
  },
  {
    id: "staffing-stat",
    type: "stat",
    title: "Staff on Site",
    config: { dataSource: "personnel", metric: "on_site" },
    visible: true,
  },
  {
    id: "pending-invoices-stat",
    type: "stat",
    title: "Pending Invoices",
    config: { dataSource: "invoices", metric: "pending" },
    visible: true,
  },
  {
    id: "quick-actions",
    type: "quick-actions",
    title: "Quick Actions",
    config: {},
    visible: true,
  },
  {
    id: "revenue-bar-chart",
    type: "chart",
    title: "Monthly Revenue",
    config: { dataSource: "invoices", displayOptions: { chartType: "bar" } },
    visible: true,
  },
  {
    id: "recent-activity",
    type: "activity",
    title: "Recent Activity",
    config: { displayOptions: { limit: 10 } },
    visible: true,
  },
  {
    id: "recent-invoices",
    type: "table",
    title: "Recent Invoices",
    config: { dataSource: "invoices", displayOptions: { limit: 5 } },
    visible: true,
  },
  {
    id: "trash",
    type: "trash",
    title: "Recently Deleted",
    config: { displayOptions: { limit: 5 } },
    visible: true,
  },
];

export const DEFAULT_THEME: DashboardTheme = {
  backgroundColor: undefined,
  cardBackground: undefined,
  cardOpacity: 100,
  fontFamily: undefined,
  fontSize: "medium",
  spacing: "normal",
  accentColor: undefined,
  borderRadius: "medium",
};
