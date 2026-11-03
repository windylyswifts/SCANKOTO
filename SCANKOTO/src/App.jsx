import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AttendanceScanner from './components/AttendanceScanner';
import Dashboard from './components/Dashboard';
import CreateEvent from './components/CreateEvent';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create-event" element={<CreateEvent />} />
        <Route path="/scan/:eventId" element={<AttendanceScanner />} />
        
        {/* Default fallback redirects unknown URLs back to the admin hub */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;