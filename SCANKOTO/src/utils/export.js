import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';

export const exportToCSV = async (logs, targetDurationMinutes = 0, eventName = "Event") => {
  if (!logs || logs.length === 0) {
    alert("No attendance records to export.");
    return;
  }

  try {
    // 1. Fetch student names from the cloud to match with the IDs
    const { data: studentsData, error } = await supabase
      .from('students')
      .select('student_id, full_name');
      
    if (error) throw error;
    
    // Create a lookup dictionary for fast name retrieval
    const studentMap = {};
    studentsData.forEach(student => {
      studentMap[student.student_id] = student.full_name;
    });

    // 2. Process all logs and calculate durations
    const processedLogs = logs.map(log => {
      const checkIn = log.timestamp ? new Date(log.timestamp) : null;
      // We assume if checkOutTime exists on the log object, we use it. Otherwise, default to check-in.
      const checkOut = log.checkOutTime ? new Date(log.checkOutTime) : checkIn; 
      
      // Calculate minutes rendered (returns 0 if checkOut isn't implemented in the scanner yet)
      const diffMs = checkOut && checkIn ? (checkOut - checkIn) : 0;
      const totalMinutes = Math.floor(diffMs / 60000);

      return {
        idNumber: log.studentId,
        fullName: studentMap[log.studentId] || 'Unknown Student',
        totalMinutes: totalMinutes,
        isCleared: totalMinutes >= targetDurationMinutes
      };
    });

    // 3. Sort students alphabetically by ID
    processedLogs.sort((a, b) => a.idNumber.localeCompare(b.idNumber));

    // 4. Split into the two required categories
    const clearedStudents = processedLogs.filter(s => s.isCleared);
    const notClearedStudents = processedLogs.filter(s => !s.isCleared);

    // 5. Construct the Excel Sheet Rows manually to stack the two tables
    const excelRows = [];

    // --- TABLE 1: CLEARED STUDENTS ---
    excelRows.push([`CLEARED STUDENTS (Rendered >= ${targetDurationMinutes} mins)`]);
    excelRows.push(['NO', 'ID NUMBER', 'FULL NAME', 'TOTAL MINUTES']);
    
    clearedStudents.forEach((student, index) => {
      excelRows.push([
        index + 1,
        student.idNumber,
        student.fullName,
        student.totalMinutes
      ]);
    });
    
    if (clearedStudents.length === 0) {
      excelRows.push(['', 'No students cleared requirements', '', '']);
    }

    // Blank row separator
    excelRows.push([]);
    excelRows.push([]);

    // --- TABLE 2: NOT CLEARED STUDENTS ---
    excelRows.push([`PENDING / NOT CLEARED (Rendered < ${targetDurationMinutes} mins)`]);
    excelRows.push(['NO', 'ID NUMBER', 'FULL NAME', 'TOTAL MINUTES']);
    
    notClearedStudents.forEach((student, index) => {
      excelRows.push([
        index + 1,
        student.idNumber,
        student.fullName,
        student.totalMinutes
      ]);
    });

    if (notClearedStudents.length === 0) {
      excelRows.push(['', 'All attendees cleared requirements', '', '']);
    }

    // 6. Generate and Download the XLSX file
    const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
    
    // Auto-size columns slightly for better readability
    worksheet['!cols'] = [
      { wch: 5 },  // NO
      { wch: 15 }, // ID NUMBER
      { wch: 35 }, // FULL NAME
      { wch: 15 }  // TOTAL MINUTES
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clearance Report");

    // Format filename safely
    const safeEventName = eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0];
    
    XLSX.writeFile(workbook, `Clearance_${safeEventName}_${dateStr}.xlsx`);

  } catch (err) {
    console.error("Export Error:", err);
    alert("Failed to generate export file. Ensure you have an internet connection to fetch student names.");
  }
};