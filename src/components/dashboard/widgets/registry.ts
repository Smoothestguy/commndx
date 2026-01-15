import {
  DollarSign,
  FolderOpen,
  Users,
  FileText,
  PieChart,
  Activity,
  Zap,
  ClipboardList,
  Receipt,
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Briefcase,
  Trash2,
} from "lucide-react";
import { WidgetRegistryEntry } from "./types";

export const WIDGET_REGISTRY: Record<string, WidgetRegistryEntry> = {
  // Stats widgets
  'revenue-stat': {
    type: 'stat',
    title: 'Revenue',
    description: 'Total revenue from invoices',
    icon: DollarSign,
    category: 'stats',
    defaultSize: { width: 1, height: 1 },
    defaultConfig: { dataSource: 'invoices', metric: 'revenue' },
  },
  'projects-stat': {
    type: 'stat',
    title: 'Active Projects',
    description: 'Number of active projects',
    icon: FolderOpen,
    category: 'stats',
    defaultSize: { width: 1, height: 1 },
    defaultConfig: { dataSource: 'projects', metric: 'active_count' },
  },
  'staffing-stat': {
    type: 'stat',
    title: 'Staff on Site',
    description: 'Personnel currently on site',
    icon: Users,
    category: 'stats',
    defaultSize: { width: 1, height: 1 },
    defaultConfig: { dataSource: 'personnel', metric: 'on_site' },
  },
  'pending-invoices-stat': {
    type: 'stat',
    title: 'Pending Invoices',
    description: 'Invoices awaiting payment',
    icon: FileText,
    category: 'stats',
    defaultSize: { width: 1, height: 1 },
    defaultConfig: { dataSource: 'invoices', metric: 'pending' },
  },
  'estimates-stat': {
    type: 'stat',
    title: 'Open Estimates',
    description: 'Estimates pending approval',
    icon: Receipt,
    category: 'stats',
    defaultSize: { width: 1, height: 1 },
    defaultConfig: { dataSource: 'estimates', metric: 'open_count' },
  },
  'customers-stat': {
    type: 'stat',
    title: 'Total Customers',
    description: 'Total number of customers',
    icon: Briefcase,
    category: 'stats',
    defaultSize: { width: 1, height: 1 },
    defaultConfig: { dataSource: 'customers', metric: 'total_count' },
  },
  'overdue-invoices-stat': {
    type: 'stat',
    title: 'Overdue Invoices',
    description: 'Past due invoices requiring attention',
    icon: AlertCircle,
    category: 'stats',
    defaultSize: { width: 1, height: 1 },
    defaultConfig: { dataSource: 'invoices', metric: 'overdue' },
  },
  'hours-today-stat': {
    type: 'stat',
    title: 'Hours Today',
    description: 'Total hours logged today',
    icon: Clock,
    category: 'stats',
    defaultSize: { width: 1, height: 1 },
    defaultConfig: { dataSource: 'time_entries', metric: 'today' },
  },

  // Chart widgets
  'projects-pie-chart': {
    type: 'chart',
    title: 'Projects by Status',
    description: 'Pie chart of project statuses',
    icon: PieChart,
    category: 'charts',
    defaultSize: { width: 2, height: 2 },
    defaultConfig: { dataSource: 'projects', displayOptions: { chartType: 'pie' } },
  },
  'revenue-bar-chart': {
    type: 'chart',
    title: 'Monthly Revenue',
    description: 'Bar chart of monthly revenue',
    icon: BarChart3,
    category: 'charts',
    defaultSize: { width: 2, height: 2 },
    defaultConfig: { dataSource: 'invoices', displayOptions: { chartType: 'bar' } },
  },
  'projects-trend-chart': {
    type: 'chart',
    title: 'Project Trends',
    description: 'Line chart of project activity',
    icon: TrendingUp,
    category: 'charts',
    defaultSize: { width: 2, height: 2 },
    defaultConfig: { dataSource: 'projects', displayOptions: { chartType: 'line' } },
  },

  // List widgets
  'recent-activity': {
    type: 'activity',
    title: 'Recent Activity',
    description: 'Latest activity across the system',
    icon: Activity,
    category: 'lists',
    defaultSize: { width: 2, height: 2 },
    defaultConfig: { displayOptions: { limit: 10 } },
  },
  'recent-estimates': {
    type: 'table',
    title: 'Recent Estimates',
    description: 'Latest estimates created',
    icon: Receipt,
    category: 'lists',
    defaultSize: { width: 2, height: 2 },
    defaultConfig: { dataSource: 'estimates', displayOptions: { limit: 5 } },
  },
  'recent-invoices': {
    type: 'table',
    title: 'Recent Invoices',
    description: 'Latest invoices created',
    icon: FileText,
    category: 'lists',
    defaultSize: { width: 2, height: 2 },
    defaultConfig: { dataSource: 'invoices', displayOptions: { limit: 5 } },
  },
  'upcoming-appointments': {
    type: 'table',
    title: 'Upcoming Appointments',
    description: 'Scheduled appointments',
    icon: Calendar,
    category: 'lists',
    defaultSize: { width: 2, height: 2 },
    defaultConfig: { dataSource: 'appointments', displayOptions: { limit: 5 } },
  },

  // Action widgets
  'quick-actions': {
    type: 'quick-actions',
    title: 'Quick Actions',
    description: 'Shortcuts to common tasks',
    icon: Zap,
    category: 'actions',
    defaultSize: { width: 4, height: 1 },
    defaultConfig: {},
  },
  'assignments': {
    type: 'assignments',
    title: 'My Assignments',
    description: 'Your current assignments',
    icon: ClipboardList,
    category: 'actions',
    defaultSize: { width: 2, height: 1 },
    defaultConfig: {},
  },
  'pending-approvals': {
    type: 'table',
    title: 'Pending Approvals',
    description: 'Items awaiting your approval',
    icon: CheckCircle,
    category: 'actions',
    defaultSize: { width: 2, height: 1 },
    defaultConfig: { dataSource: 'approvals', displayOptions: { limit: 5 } },
  },

  // Other widgets
  'welcome': {
    type: 'welcome',
    title: 'Welcome Banner',
    description: 'Personalized welcome message',
    icon: Users,
    category: 'other',
    defaultSize: { width: 4, height: 1 },
    defaultConfig: {},
  },
  'reimbursements': {
    type: 'reimbursements',
    title: 'Reimbursements',
    description: 'Pending expense reimbursements',
    icon: Receipt,
    category: 'actions',
    defaultSize: { width: 2, height: 1 },
    defaultConfig: {},
  },
  'trash': {
    type: 'trash',
    title: 'Recently Deleted',
    titleLink: '/admin/trash',
    description: 'Recently deleted items across the system',
    icon: Trash2,
    category: 'lists',
    defaultSize: { width: 2, height: 2 },
    defaultConfig: { displayOptions: { limit: 10 } },
  },
};

export const WIDGET_CATEGORIES = {
  stats: { label: 'Statistics', description: 'Key metrics and KPIs' },
  charts: { label: 'Charts', description: 'Visual data representations' },
  lists: { label: 'Lists & Tables', description: 'Data lists and tables' },
  actions: { label: 'Actions', description: 'Quick actions and tasks' },
  other: { label: 'Other', description: 'Other widgets' },
} as const;

export function getWidgetById(widgetId: string): WidgetRegistryEntry | undefined {
  return WIDGET_REGISTRY[widgetId];
}

export function getWidgetsByCategory(category: keyof typeof WIDGET_CATEGORIES): Array<{ id: string } & WidgetRegistryEntry> {
  return Object.entries(WIDGET_REGISTRY)
    .filter(([, entry]) => entry.category === category)
    .map(([id, entry]) => ({ id, ...entry }));
}
