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
