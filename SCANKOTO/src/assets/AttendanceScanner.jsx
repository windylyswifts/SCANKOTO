import React, { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';

const AttendanceScanner = () => {
  const [feedback, setFeedback] = useState(null);

  const handleScan = (text) => {
    if (text) {
      // US-05: Capture immediate timestamp upon successful decode
      const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour12: true, 
        hour: 'numeric', 
        minute: 'numeric', 
        second: 'numeric' 
      });

      setFeedback({
        message: `Student ID: ${text}`,
        timestamp: timestamp,
        status: 'alert-success'
      });

      // Clear feedback UI after 3 seconds to ready the next scan
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center p-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          
          <h2 className="card-title text-2xl font-bold text-primary mb-1">
            SCANKOTO
          </h2>
          <p className="text-sm text-base-content/70 mb-6">
            Position the student QR code within the frame to check in.
          </p>

          {/* Scanner Viewport (US-01) */}
          <div className="w-full aspect-square rounded-2xl overflow-hidden border-4 border-primary/20 bg-black relative shadow-inner">
             <Scanner
                onResult={handleScan}
                onError={(error) => console.error(error?.message)}
                options={{
                    delayBetweenScanSuccess: 3000, // Prevents duplicate rapid scans
                }}
                components={{
                    audio: true, // Plays a beep on success
                    onOff: true, // Flashlight toggle
                    finder: true, // Renders the scanning box
                }}
             />
          </div>

          {/* Visual Feedback Area (US-05) */}
          <div className="h-20 w-full mt-6">
            {feedback && (
              <div className={`alert ${feedback.status} shadow-lg transition-all duration-300 ease-in-out`}>
                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-left ml-2">
                    <h3 className="font-bold text-sm">{feedback.message}</h3>
                    <div className="text-xs opacity-80">Recorded at: {feedback.timestamp}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default AttendanceScanner;