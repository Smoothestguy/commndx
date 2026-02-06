import { ACTIVITY_TYPES } from "@/components/session/devActivityUtils";

/**
 * Get activity type label from value
 */
const getActivityTypeLabel = (typeValue: string): string => {
  const type = ACTIVITY_TYPES.find(t => t.value === typeValue);
  return type?.label || typeValue;
};

/**
 * Export activity logs to CSV format
 */
export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  // Define CSV headers
  const headers = ['Date', 'Time', 'Action', 'Target Email', 'Target Role', 'Performed By'];
  
  // Convert data to CSV rows
  const rows = data.map(log => {
    const date = new Date(log.created_at);
    return [
      date.toLocaleDateString(),
      date.toLocaleTimeString(),
      log.action,
      log.target_email,
      log.target_role,
      log.performed_by_email || 'System',
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, `${filename}.csv`);
};

/**
 * Export activity logs to JSON format
 */
export const exportToJSON = (data: any[], filename: string) => {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  // Format data for export
  const exportData = data.map(log => ({
    date: new Date(log.created_at).toLocaleDateString(),
    time: new Date(log.created_at).toLocaleTimeString(),
    action: log.action,
    targetEmail: log.target_email,
    targetRole: log.target_role,
    performedBy: log.performed_by_email || 'System',
    metadata: log.metadata,
    invitationId: log.invitation_id,
  }));

  // Create JSON string
  const jsonContent = JSON.stringify(exportData, null, 2);

  // Create blob and download
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  downloadFile(blob, `${filename}.json`);
};

/**
 * Dev Activity interface for export functions
 */
interface DevActivityExport {
  activity_date: string;
  activity_time: string | null;
  activity_type: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  project_name: string | null;
  technologies: string[];
  tags: string[];
}

/**
 * Escape CSV cell content
 */
const escapeCSVCell = (cell: string): string => {
  // Replace double quotes with two double quotes and wrap in quotes
  return `"${(cell || '').replace(/"/g, '""')}"`;
};

/**
 * Export dev activities to CSV format
 */
export const exportDevActivitiesToCSV = (activities: DevActivityExport[], filename: string) => {
  if (activities.length === 0) {
    throw new Error('No activities to export');
  }

  const headers = ['Date', 'Time', 'Type', 'Title', 'Description', 'Duration (min)', 'Project', 'Technologies', 'Tags'];
  
  const rows = activities.map(activity => [
    activity.activity_date,
    activity.activity_time || '',
    getActivityTypeLabel(activity.activity_type),
    activity.title,
    activity.description || '',
    activity.duration_minutes?.toString() || '',
    activity.project_name || '',
    activity.technologies.join('; '),
    activity.tags.join('; ')
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => escapeCSVCell(cell)).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, `${filename}.csv`);
};

/**
 * Export dev activities to JSON format
 */
export const exportDevActivitiesToJSON = (activities: DevActivityExport[], filename: string) => {
  if (activities.length === 0) {
    throw new Error('No activities to export');
  }

  const exportData = activities.map(activity => ({
    date: activity.activity_date,
    time: activity.activity_time || null,
    type: getActivityTypeLabel(activity.activity_type),
    typeValue: activity.activity_type,
    title: activity.title,
    description: activity.description || null,
    durationMinutes: activity.duration_minutes,
    project: activity.project_name || null,
    technologies: activity.technologies,
    tags: activity.tags,
  }));

  const jsonContent = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  downloadFile(blob, `${filename}.json`);
};

/**
 * Helper function to trigger file download
 */
const downloadFile = (blob: Blob, filename: string) => {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
};
