import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './components/Login';
import AttendanceScanner from './components/AttendanceScanner';
import Dashboard from './components/Dashboard';
import CreateEvent from './components/CreateEvent';
import StudentPortal from './components/StudentPortal';
import ManageEvents from './components/ManageEvents';
import ArchivedEvents from './components/ArchivedEvents'; // NEW IMPORT

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/scan/:eventId" element={<AttendanceScanner />} />
          <Route path="/portal/:eventId" element={<StudentPortal />} />
          
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/create-event" element={<CreateEvent />} />
            <Route path="/manage-events" element={<ManageEvents />} />
            <Route path="/archived-events" element={<ArchivedEvents />} /> {/* NEW ROUTE */}
          </Route>
          
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;