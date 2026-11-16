import { supabase } from './supabaseClient';
import { getPendingLogs, updateLocalLogSyncStatus } from './db';

export const syncPendingRecords = async () => {
  if (!navigator.onLine) return false;

  try {
    const pendingLogs = await getPendingLogs();
    if (pendingLogs.length === 0) return true;

    window.dispatchEvent(new CustomEvent('sync-status', { detail: { isSyncing: true } }));
    let successCount = 0;

    for (const local of pendingLogs) {
      try {
        const isAnomaly = Boolean(local.status && local.status.includes('Anomaly'));

        // 1. Safety net: ensure student ID exists in 'students' table
        const { error: studentErr } = await supabase
          .from('students')
          .upsert(
            [
              {
                student_id: local.studentId,
                full_name: local.studentName || 'Unknown Student',
                year_level: 'N/A',
                course: 'N/A',
                email: 'anomaly@csu.edu.ph',
                qr_hash: 'anomaly'
              }
            ],
            { onConflict: 'student_id', ignoreDuplicates: true }
          );

        if (studentErr) throw studentErr;

        // 2. Log unregistered IDs to 'anomalies' table
        if (isAnomaly) {
          const { error: anomalyErr } = await supabase.from('anomalies').upsert(
            {
              event_id: local.eventId,
              scanned_id: local.studentId,
              check_in_time: new Date(local.checkInTime || local.timestamp).toISOString()
            },
            { onConflict: 'event_id,scanned_id', ignoreDuplicates: true }
          );
          if (anomalyErr) console.error('[Sync Engine] Anomalies DB Rejection:', anomalyErr);
        }

        // 3. Reconcile local log against existing cloud row
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
        let finalStatus = local.status || (finalCheckOut ? 'Completed / Valid' : 'Checked-In');

        if (cloud) {
          // Preserve earliest Check-In
          if (new Date(cloud.check_in_time).getTime() < new Date(finalCheckIn).getTime()) {
            finalCheckIn = cloud.check_in_time;
          }

          // Preserve latest Check-Out and its corresponding validation status
          if (cloud.check_out_time) {
            const cloudOut = new Date(cloud.check_out_time).getTime();
            const localOut = finalCheckOut ? new Date(finalCheckOut).getTime() : 0;
            if (cloudOut >= localOut) {
              finalCheckOut = cloud.check_out_time;
              finalStatus = cloud.status || finalStatus;
            }
          }

          const { data: updatedRows, error: updateErr } = await supabase
            .from('attendance_logs')
            .update({
              check_in_time: finalCheckIn,
              check_out_time: finalCheckOut,
              status: finalStatus,
              sync_status: 'synced'
            })
            .eq('record_id', cloud.record_id)
            .select('record_id');

          if (updateErr) throw updateErr;
          if (!updatedRows || updatedRows.length === 0) {
            throw new Error(`RLS blocked or row missing during attendance_logs UPDATE for ${local.studentId}`);
          }
        } else {
          const { data: insertedRows, error: insertErr } = await supabase
            .from('attendance_logs')
            .insert([
              {
                event_id: local.eventId,
                student_id: local.studentId,
                check_in_time: finalCheckIn,
                check_out_time: finalCheckOut,
                status: finalStatus,
                sync_status: 'synced'
              }
            ])
            .select('record_id');

          if (insertErr) throw insertErr;
          if (!insertedRows || insertedRows.length === 0) {
            throw new Error(`RLS blocked attendance_logs INSERT for ${local.studentId}`);
          }
        }

        // 4. Mark local record synced only after verified cloud persistence
        await updateLocalLogSyncStatus(local.id, 'synced');
        successCount++;
      } catch (rowError) {
        console.error(`[Sync Engine] FAILED for ${local.studentId} ->`, rowError);
      }
    }

    window.dispatchEvent(
      new CustomEvent('sync-status', { detail: { isSyncing: false, success: successCount > 0 } })
    );
    window.dispatchEvent(new Event('db-updated'));

    return successCount > 0;
  } catch (error) {
    console.error('[Network] Fatal Sync Execution Error:', error);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { isSyncing: false, success: false } }));
    return false;
  }
};