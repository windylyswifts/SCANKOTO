export const exportToCSV = (logs) => {
  if (!logs || logs.length === 0) {
    alert("No attendance records to export.");
    return;
  }

  const headers = ['Student ID', 'Timestamp', 'Event ID', 'Sync Status'];
  
  const rows = logs.map(log => [
    log.studentId,
    new Date(log.timestamp).toLocaleString('en-US'),
    log.eventId || 'unknown-event',
    log.syncStatus
  ]);

  const csvContent = [
    headers.join(','), 
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `SCANKOTO_Attendance_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};