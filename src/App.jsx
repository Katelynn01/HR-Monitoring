import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';

// Auth pages
import Login from './pages/Login';
import Register from './pages/Register';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import Employees from './pages/admin/Employees';
import Attendance from './pages/admin/Attendance';
import LeaveRequests from './pages/admin/LeaveRequests';
import Reports from './pages/admin/Reports';
import AuditTrail from './pages/admin/AuditTrail';

// Employee pages
import EmployeeDashboard from './pages/employee/Dashboard';
import TimeLog from './pages/employee/TimeLog';
import MyAttendance from './pages/employee/MyAttendance';
import LeaveBalance from './pages/employee/LeaveBalance';
import EmployeeProfile from './pages/employee/Profile';

function AppRoutes() {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Loading HR Monitor..." />;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={(user && userProfile && !userProfile.needsDepartment) ? <Navigate to={userProfile.role === 'admin' ? '/admin' : '/employee'} /> : <Login />} />
      <Route path="/register" element={(user && userProfile && !userProfile.needsDepartment) ? <Navigate to="/employee" /> : <Register />} />

      {/* Admin routes */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin">
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="leave-requests" element={<LeaveRequests />} />
        <Route path="reports" element={<Reports />} />
        <Route path="audit-trail" element={<AuditTrail />} />
      </Route>

      {/* Employee routes */}
      <Route path="/employee" element={
        <ProtectedRoute requiredRole="employee">
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<EmployeeDashboard />} />
        <Route path="time-log" element={<TimeLog />} />
        <Route path="my-attendance" element={<MyAttendance />} />
        <Route path="leave-balance" element={<LeaveBalance />} />
        <Route path="profile" element={<EmployeeProfile />} />
      </Route>

      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
