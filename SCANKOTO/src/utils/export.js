export const exportToCSV = (logs) => {
  if (!logs || logs.length === 0) {
    alert("No attendance records to export.");
    return;
  }
j
  // Define spreadsheet headers
  const headers = ['Student ID', 'Timestamp', 'Event ID', 'Sync Status'];
  
  // Map JSON data to CSV rows
  const rows = logs.map(log => [
    log.studentId,
    new Date(log.timestamp).toLocaleString('en-US'),
    log.eventId || 'general-assembly',
    log.syncStatus
  ]);

  // Construct CSV text payload
  const csvContent = [
    headers.join(','), 
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Trigger browser download via Blob
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `SCANKOTO_Attendance_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};