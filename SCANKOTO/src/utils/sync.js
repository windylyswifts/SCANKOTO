import { supabase } from './supabaseClient';
import { getPendingLogs, updateLocalLogSyncStatus, getLocalEvent } from './db'; 

export const syncPendingRecords = async () => {
  if (!navigator.onLine) return false;

  try {
    const pendingLogs = await getPendingLogs();
    if (pendingLogs.length === 0) return true; 

    // Trigger UI loading spinner
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { isSyncing: true } }));
    let successCount = 0;

    for (const local of pendingLogs) {
      try {
        console.log(`[Sync Engine] Attempting to sync ID: ${local.studentId}`);
        const isAnomaly = local.status && local.status.includes('Anomaly');

        // 1. SAFETY NET: Ensure Event exists in cloud to prevent Foreign Key crashes
        const localEvent = await getLocalEvent(local.eventId);
        if (localEvent) {
           const { error: evtErr } = await supabase.from('events').upsert([{
              event_id: localEvent.event_id,
              event_name: localEvent.event_name || 'Unknown Event',
              start_time: localEvent.start_time || new Date().toISOString(),
              end_time: localEvent.end_time || new Date().toISOString()
           }], { onConflict: 'event_id', ignoreDuplicates: true });
           if (evtErr) console.error("[Sync Engine] Event Injection Failed:", evtErr);
        }
        
        // 2. SAFETY NET: Inject student/anomaly into the 'students' table first
        const { error: studentErr } = await supabase
          .from('students')
          .upsert([{
            student_id: local.studentId,
            full_name: local.studentName || 'Unknown Student',
            year_level: 'N/A',     
            course: 'N/A',         
            email: 'anomaly@csu.edu.ph', 
            qr_hash: 'anomaly'
          }], { onConflict: 'student_id', ignoreDuplicates: true });

        if (studentErr) {
            console.error("[Sync Engine] Student DB Rejection:", studentErr);
            throw studentErr; 
        }

        // 3. LOG ANOMALY TO DEDICATED TABLE
        if (isAnomaly) {
          const { error: anomalyErr } = await supabase.from('anomalies').upsert(
            { 
              event_id: local.eventId, 
              scanned_id: local.studentId,
              check_in_time: new Date(local.checkInTime || local.timestamp).toISOString()
            },
            { onConflict: 'event_id,scanned_id', ignoreDuplicates: true }
          );
          if (anomalyErr) console.error("[Sync Engine] Anomalies DB Rejection:", anomalyErr);
        }

        // 4. FETCH AND UPSERT ATTENDANCE LOG
        const { data: cloudRecords, error: fetchErr } = await supabase
          .from('attendance_logs')
          .select('record_id, check_in_time, check_out_time, status')
          .eq('event_id', local.eventId)
          .eq('student_id', local.studentId)
          .limit(1);
        
        if (fetchErr) throw fetchErr;
        
        const cloud = cloudRecords?.[0];
        let finalCheckIn = new Date(local.checkInTime || local.timestamp).toISOString();
        let finalCheckOut = local.checkOutTime ? new Date(local.checkOutTime).toISOString() : null;
        let finalStatus = local.status || 'Checked-In';

        if (cloud) {
          if (new Date(cloud.check_in_time).getTime() < new Date(finalCheckIn).getTime()) {
            finalCheckIn = cloud.check_in_time;
          }
          if (cloud.check_out_time) {
             const cloudOut = new Date(cloud.check_out_time).getTime();
             const localOut = finalCheckOut ? new Date(finalCheckOut).getTime() : 0;
             if (cloudOut > localOut) {
               finalCheckOut = cloud.check_out_time;
               finalStatus = cloud.status;
             }
          }
          const { error: updateErr } = await supabase
            .from('attendance_logs')
            .update({ check_in_time: finalCheckIn, check_out_time: finalCheckOut, status: finalStatus, sync_status: 'synced' })
            .eq('record_id', cloud.record_id);
          if (updateErr) throw updateErr;
        } else {
          const { error: insertErr } = await supabase
            .from('attendance_logs')
            .insert([{ event_id: local.eventId, student_id: local.studentId, check_in_time: finalCheckIn, check_out_time: finalCheckOut, status: finalStatus, sync_status: 'synced' }]);
          if (insertErr) throw insertErr;
        }

        // 5. MARK LOCAL LOG AS SYNCED (Only executes if everything above passed)
        await updateLocalLogSyncStatus(local.id, 'synced');
        successCount++;
        console.log(`[Sync Engine] Successfully synced ID: ${local.studentId}`);

      } catch (rowError) {
        console.error(`[Sync Engine] FAILED for ${local.studentId} ->`, rowError);
      }
    }

    // 6. UI REFRESH
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { isSyncing: false, success: successCount > 0 } }));
    window.dispatchEvent(new Event('db-updated'));
    
    return successCount > 0;

  } catch (error) {
    console.error("[Network] Fatal Sync Execution Error:", error);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { isSyncing: false, success: false } }));
    return false;
  }
};