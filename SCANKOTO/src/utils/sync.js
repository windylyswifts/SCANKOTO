import { supabase } from './supabaseClient';
import { getPendingLogs, updateLocalLogSyncStatus } from './db'; 

export const syncPendingRecords = async () => {
  if (!navigator.onLine) return false;

  try {
    const pendingLogs = await getPendingLogs();
    if (pendingLogs.length === 0) return true; 

    // Trigger UI loading spinner
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { isSyncing: true } }));
    let successCount = 0;

    // Process row-by-row so one corrupted scan doesn't break the entire batch
    for (const local of pendingLogs) {
      try {
        const isAnomaly = local.status && local.status.includes('Anomaly');
        
        // 1. SAFETY NET: Inject student/anomaly into the 'students' table first.
        // We MUST provide a fallback string for every NOT NULL column in your SQL schema.
        const studentPayload = {
          student_id: local.studentId,
          full_name: local.studentName || 'Unknown Student',
          year_level: 'N/A',     // Required by your schema
          course: 'N/A',         // Providing fallback to be safe
          email: 'anomaly@csu.edu.ph', // Providing fallback to be safe
          qr_hash: 'anomaly'     // Providing fallback to be safe
        };

        const { error: studentErr } = await supabase
          .from('students')
          .upsert([studentPayload], { onConflict: 'student_id', ignoreDuplicates: true });

        if (studentErr) {
            console.error(`Failed to inject student ${local.studentId} into students table:`, studentErr);
            // If we can't inject the student, the attendance_logs insert will definitely fail.
            throw new Error(`Student table injection failed: ${studentErr.message}`);
        }

        // 2. LOG ANOMALY TO DEDICATED TABLE
        if (isAnomaly) {
          await supabase.from('anomalies').upsert(
            { 
              event_id: local.eventId, 
              scanned_id: local.studentId,
              check_in_time: new Date(local.checkInTime || local.timestamp).toISOString()
            },
            { onConflict: 'event_id,scanned_id', ignoreDuplicates: true }
          ).catch((err) => console.error("Failed to log anomaly to anomalies table:", err)); 
        }

        // 3. FETCH EXISTING CLOUD RECORD
        const { data: cloudRecords, error: fetchError } = await supabase
          .from('attendance_logs')
          .select('record_id, check_in_time, check_out_time, status')
          .eq('event_id', local.eventId)
          .eq('student_id', local.studentId)
          .limit(1);

        if (fetchError) throw fetchError;
        
        const cloud = cloudRecords?.[0];

        let finalCheckIn = new Date(local.checkInTime || local.timestamp).toISOString();
        let finalCheckOut = local.checkOutTime ? new Date(local.checkOutTime).toISOString() : null;
        let finalStatus = local.status || 'Checked-In';

        if (cloud) {
          // Merge times logically
          const localIn = new Date(finalCheckIn).getTime();
          const cloudIn = new Date(cloud.check_in_time).getTime();
          if (cloudIn < localIn) finalCheckIn = cloud.check_in_time;

          if (cloud.check_out_time) {
            const cloudOut = new Date(cloud.check_out_time).getTime();
            const localOut = finalCheckOut ? new Date(finalCheckOut).getTime() : 0;
            if (cloudOut > localOut) {
              finalCheckOut = cloud.check_out_time;
              finalStatus = cloud.status; 
            }
          }

          // EXPLICIT UPDATE: Using record_id to safely target the exact row
          const { error: updateErr } = await supabase
            .from('attendance_logs')
            .update({
              check_in_time: finalCheckIn,
              check_out_time: finalCheckOut,
              status: finalStatus,
              sync_status: 'synced'
            })
            .eq('record_id', cloud.record_id);

          if (updateErr) throw updateErr;

        } else {
          // EXPLICIT INSERT
          const { error: insertErr } = await supabase
            .from('attendance_logs')
            .insert([{
              event_id: local.eventId,
              student_id: local.studentId,
              check_in_time: finalCheckIn,
              check_out_time: finalCheckOut,
              status: finalStatus,
              sync_status: 'synced'
            }]);

          if (insertErr) throw insertErr;
        }

        // 4. MARK LOCAL LOG AS SYNCED ONLY IF ALL SUPABASE CALLS SUCCEEDED
        await updateLocalLogSyncStatus(local.id, 'synced');
        successCount++;

      } catch (rowError) {
        console.error(`[Sync Error] Student: ${local.studentId} | Event: ${local.eventId} ->`, rowError);
      }
    }

    // 5. UI REFRESH
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { isSyncing: false, success: successCount > 0 } }));
    window.dispatchEvent(new Event('db-updated'));
    
    return successCount > 0;

  } catch (error) {
    console.error("[Network] Fatal Sync Execution Error:", error);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { isSyncing: false, success: false } }));
    return false;
  }
};