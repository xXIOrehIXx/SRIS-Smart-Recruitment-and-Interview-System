import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from './layouts/AuthLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth, ROLES } from './contexts/AuthContext';
import Home from './pages/Home';
import Recruitment from './pages/recruitment/Recruitment';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import AdminDashboard from './pages/admin/Dashboard';
import SubAccountManagement from './pages/admin/SubAccountManagement';
import CreateAccount from './pages/admin/CreateAccount';
import AdminLayout from './layouts/AdminLayout';
import RecruiterDashboard from './pages/recruiter/Dashboard';
import JobManagement from './pages/recruiter/JobManagement';
import JobDetail from './pages/recruiter/JobDetail';
import CreateJob from './pages/recruiter/CreateJob';
import CandidatePipeline from './pages/recruiter/CandidatePipeline';
import CandidateDetail from './pages/recruiter/CandidateDetail';
import InterviewerDashboard from './pages/interviewer/Dashboard';
import IncomingInterview from './pages/interviewer/IncomingInterview';
import Grading from './pages/interviewer/Grading';
import InterviewSchedule from './pages/interview/InterviewSchedule';
import OfferManagement from './pages/offer/OfferManagement';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import './App.css';

const App = () => {
  const { isAuthenticated, loading, user, getDashboardRoute } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <Routes>
      {/* ===== AUTH ROUTES ===== */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* ===== ADMIN ROUTES ===== */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
            <AdminLayout>
              <Routes>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="sub-accounts" element={<SubAccountManagement />} />
                <Route path="create-account" element={<CreateAccount />} />
                <Route path="settings" element={<Settings />} />
              </Routes>
            </AdminLayout>
          </ProtectedRoute>
        }
      />

      {/* ===== RECRUITER ROUTES ===== */}
      <Route
        path="/recruiter/*"
        element={
          <ProtectedRoute allowedRoles={[ROLES.RECRUITER]}>
            <AdminLayout>
              <Routes>
                <Route path="dashboard" element={<RecruiterDashboard />} />
                <Route path="jobs" element={<JobManagement />} />
                <Route path="jobs/:id" element={<JobDetail />} />
                <Route path="jobs/create" element={<CreateJob />} />
                <Route path="jobs/:id/candidates" element={<CandidatePipeline />} />
                <Route path="candidates/:id" element={<CandidateDetail />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="settings" element={<Settings />} />
              </Routes>
            </AdminLayout>
          </ProtectedRoute>
        }
      />

      {/* ===== INTERVIEWS ROUTES ===== */}
      <Route
        path="/interviews/*"
        element={
          <ProtectedRoute allowedRoles={[ROLES.RECRUITER]}>
            <AdminLayout>
              <Routes>
                <Route path="schedule" element={<InterviewSchedule />} />
              </Routes>
            </AdminLayout>
          </ProtectedRoute>
        }
      />

      {/* ===== OFFERS ROUTES ===== */}
      <Route
        path="/offers/*"
        element={
          <ProtectedRoute allowedRoles={[ROLES.RECRUITER]}>
            <AdminLayout>
              <Routes>
                <Route path="" element={<OfferManagement />} />
              </Routes>
            </AdminLayout>
          </ProtectedRoute>
        }
      />

      {/* ===== INTERVIEWER ROUTES ===== */}
      <Route
        path="/interviewer/*"
        element={
          <ProtectedRoute allowedRoles={[ROLES.INTERVIEWER]}>
            <AdminLayout>
              <Routes>
                <Route path="dashboard" element={<InterviewerDashboard />} />
                <Route path="incoming" element={<IncomingInterview />} />
                <Route path="grading/:id" element={<Grading />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="settings" element={<Settings />} />
              </Routes>
            </AdminLayout>
          </ProtectedRoute>
        }
      />

      {/* ===== SHARED ROUTES ===== */}
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <Notifications />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <Settings />
            </AdminLayout>
          </ProtectedRoute>
        }
      />

      {/* ===== HOME - PUBLIC ===== */}
      <Route path="/" element={<Home />} />

      {/* ===== RECRUITMENT - PUBLIC ===== */}
      <Route path="/:slug/recruitment" element={<Recruitment />} />

      {/* ===== FALLBACK ===== */}
      <Route
        path="*"
        element={
          isAuthenticated ? (
            <Navigate to={user ? getDashboardRoute() : '/recruiter/dashboard'} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
};

export default App;
