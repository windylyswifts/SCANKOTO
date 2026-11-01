import React, { useState, useRef } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { saveAttendanceLog } from '../utils/db'; // Adjust path based on your folder structure

const AttendanceScanner = () => {
  const [facingMode, setFacingMode] = useState('environment');
  const [isScanning, setIsScanning] = useState(true); 
  const [scanResult, setScanResult] = useState(null); 
  
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualId, setManualId] = useState('');
  
  const scannedIdsMapRef = useRef(new Map());

  // Changed to async to handle the IndexedDB save operation
  const processAttendance = async (studentId) => {
    setIsScanning(false);

    const now = Date.now();
    const COOLDOWN_PERIOD_MS = 15 * 60 * 1000; 
    const lastStudentScanTime = scannedIdsMapRef.current.get(studentId);
    
    let isDuplicate = false;

    if (lastStudentScanTime && (now - lastStudentScanTime < COOLDOWN_PERIOD_MS)) {
      isDuplicate = true;
    } else {
      scannedIdsMapRef.current.set(studentId, now);
      
      // Save valid, non-duplicate scans to offline IndexedDB storage
      try {
        await saveAttendanceLog({
          studentId: studentId,
          timestamp: now,
          eventId: 'general-assembly' // Can be made dynamic later
        });
      } catch (error) {
        console.error("Failed to save to local database:", error);
      }
    }

    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: true, 
      hour: 'numeric', 
      minute: 'numeric', 
      second: 'numeric' 
    });

    setScanResult({
      studentId,
      timestamp,
      isDuplicate
    });
    
    setIsManualModalOpen(false); 
    setManualId(''); 
  };

  const handleManualSubmit = () => {
    if (manualId.trim() !== '') {
      processAttendance(manualId.trim());
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setIsScanning(true);
  };

  const toggleCamera = () => {
    setFacingMode((prevMode) => (prevMode === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center p-4">
      
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          
          <div className="w-full flex justify-between items-center mb-6">
            <div className="text-left">
              <h2 className="card-title text-2xl font-bold text-primary mb-1">
                SCANKOTO
              </h2>
              <p className="text-sm text-base-content/70">
                {isScanning ? "Ready to scan." : "Scanner paused."}
              </p>
            </div>
            
            <button 
              onClick={toggleCamera} 
              className="btn btn-circle btn-ghost"
              title="Switch Camera"
              disabled={!isScanning}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          <div className="w-full aspect-square rounded-2xl overflow-hidden border-4 border-primary/20 bg-black relative shadow-inner flex items-center justify-center">
             {isScanning ? (
               <Scanner
                  onScan={(detectedCodes) => {
                    let scannedText = null;
                    if (Array.isArray(detectedCodes) && detectedCodes.length > 0 && detectedCodes[0].rawValue) {
                      scannedText = detectedCodes[0].rawValue;
                    } else if (typeof detectedCodes === 'string') {
                      scannedText = detectedCodes;
                    }

                    if (scannedText) {
                      processAttendance(scannedText);
                    }
                  }}
                  onError={(error) => console.error(error?.message)}
                  constraints={{ facingMode: facingMode }}
                  components={{
                      audio: true, 
                      onOff: true, 
                      finder: true, 
                  }}
               />
             ) : (
               <div className="text-white/50 flex flex-col items-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2h2a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                 </svg>
                 <span>Processing...</span>
               </div>
             )}
          </div>

          <div className="w-full mt-6">
            <button 
              className="btn btn-outline btn-primary w-full"
              onClick={() => setIsManualModalOpen(true)}
              disabled={!isScanning}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Enter ID Manually
            </button>
          </div>

        </div>
      </div>

      <dialog className={`modal modal-bottom sm:modal-middle ${scanResult ? 'modal-open' : ''}`}>
        <div className="modal-box text-center">
          {scanResult?.isDuplicate ? (
             <div className="w-16 h-16 rounded-full bg-warning/20 text-warning flex items-center justify-center mx-auto mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
               </svg>
             </div>
          ) : (
             <div className="w-16 h-16 rounded-full bg-success/20 text-success flex items-center justify-center mx-auto mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
               </svg>
             </div>
          )}
          
          <h3 className="font-bold text-2xl mb-1">
            {scanResult?.studentId}
          </h3>
          <p className={`font-semibold mb-4 ${scanResult?.isDuplicate ? 'text-warning' : 'text-success'}`}>
            {scanResult?.isDuplicate ? 'Already Scanned (15m Cooldown)' : 'Attendance Recorded'}
          </p>
          <div className="text-sm opacity-70 mb-6">
            Time: {scanResult?.timestamp}
          </div>

          <div className="modal-action mt-0 justify-center">
            <button className="btn btn-primary btn-wide" onClick={resetScanner}>
              Scan Next
            </button>
          </div>
        </div>
      </dialog>

      <dialog className={`modal ${isManualModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg">Manual Entry</h3>
          <p className="py-4 text-sm text-base-content/70">Enter the Student ID below if the QR code is damaged or unreadable.</p>
          <input 
            type="text" 
            placeholder="e.g. 2024-12345" 
            className="input input-bordered w-full mb-4" 
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
            autoFocus={isManualModalOpen}
          />
          <div className="modal-action mt-0">
            <button className="btn" onClick={() => setIsManualModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleManualSubmit}>Submit</button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setIsManualModalOpen(false)}>close</button>
        </form>
      </dialog>

    </div>
  );
};

export default AttendanceScanner;