import { supabase } from './supabaseClient';
import { getPendingLogs, updateLocalLogSyncStatus } from './db'; 

export const syncPendingRecords = async () => {
  if (!navigator.onLine) return false;

  try {
    const pendingLogs = await getPendingLogs();
    if (pendingLogs.length === 0) return true; 

    // Inform UI we are syncing
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { isSyncing: true } }));

    // 1. Identify which students and events we are dealing with
    const studentIds = pendingLogs.map(log => log.studentId);
    const eventIds = [...new Set(pendingLogs.map(log => log.eventId))];

    // 2. SAFETY NET: Guarantee all scanned students exist in Supabase to prevent Foreign Key crashes
    const uniqueStudents = Array.from(new Set(studentIds)).map(id => {
      const match = pendingLogs.find(l => l.studentId === id);
      return { 
        student_id: id, 
        full_name: match.studentName || 'Unknown',
        year_level: 'N/A',
        course: 'N/A',
        email: 'anomaly@csu.edu.ph',
        qr_hash: 'anomaly'
      };
    });
    
    // Push missing anomalies to the cloud silently. Ignore duplicates.
    await supabase.from('students').upsert(uniqueStudents, { onConflict: 'student_id', ignoreDuplicates: true }).catch(() => {});

    // 3. Fetch existing cloud records to intelligently map updates
    const { data: cloudRecords, error: fetchError } = await supabase
      .from('attendance_logs')
      .select('id, event_id, student_id, check_in_time, check_out_time, status')
      .in('event_id', eventIds)
      .in('student_id', studentIds);

    if (fetchError) throw fetchError;

    const cloudMap = {};
    cloudRecords?.forEach(record => {
      cloudMap[`${record.event_id}_${record.student_id}`] = record;
    });

    // 4. Split operations to bypass strict composite constraints (Insert vs Update)
    const toInsert = [];
    const toUpdate = [];

    pendingLogs.forEach(local => {
      const key = `${local.eventId}_${local.studentId}`;
      const cloud = cloudMap[key];

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

        toUpdate.push({
          id: cloud.id, // Explicitly target the row ID to avoid constraint crashes
          event_id: local.eventId,
          student_id: local.studentId,
          check_in_time: finalCheckIn,
          check_out_time: finalCheckOut,
          status: finalStatus
        });
      } else {
        toInsert.push({
          event_id: local.eventId,
          student_id: local.studentId,
          check_in_time: finalCheckIn,
          check_out_time: finalCheckOut,
          status: finalStatus
        });
      }
    });

    // 5. Execute explicit operations safely
    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase.from('attendance_logs').insert(toInsert);
      if (insertErr) throw insertErr;
    }

    if (toUpdate.length > 0) {
      const { error: updateErr } = await supabase.from('attendance_logs').upsert(toUpdate);
      if (updateErr) throw updateErr;
    }

    // 6. Explicitly flip the local database tracking state to 'synced'
    for (const log of pendingLogs) {
      await updateLocalLogSyncStatus(log.id, 'synced');
    }

    // 7. Resolve UI state and blast the global update event to all components
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { isSyncing: false, success: true } }));
    window.dispatchEvent(new Event('db-updated'));
    
    return true;

  } catch (error) {
    console.error("[Network] Supabase background sync failed:", error);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { isSyncing: false, success: false } }));
    return false;
  }
};