import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
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
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/sub-accounts" element={<SubAccountManagement />} />
        <Route path="/admin/create-account" element={<CreateAccount />} />
      </Route>

      {/* ===== RECRUITER ROUTES ===== */}
      <Route
        element={
          <ProtectedRoute allowedRoles={[ROLES.RECRUITER]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/recruiter/dashboard" element={<RecruiterDashboard />} />
        <Route path="/recruiter/jobs" element={<JobManagement />} />
        <Route path="/recruiter/jobs/:id" element={<JobDetail />} />
        <Route path="/recruiter/jobs/create" element={<CreateJob />} />
        <Route path="/recruiter/jobs/:id/candidates" element={<CandidatePipeline />} />
        <Route path="/recruiter/candidates/:id" element={<CandidateDetail />} />
      </Route>

      {/* ===== INTERVIEWS ROUTES ===== */}
      <Route
        element={
          <ProtectedRoute allowedRoles={[ROLES.RECRUITER]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/interviews/schedule" element={<InterviewSchedule />} />
      </Route>

      {/* ===== OFFERS ROUTES ===== */}
      <Route
        element={
          <ProtectedRoute allowedRoles={[ROLES.RECRUITER]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/offers" element={<OfferManagement />} />
      </Route>

      {/* ===== INTERVIEWER ROUTES ===== */}
      <Route
        element={
          <ProtectedRoute allowedRoles={[ROLES.INTERVIEWER]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/interviewer/dashboard" element={<InterviewerDashboard />} />
        <Route path="/interviewer/incoming" element={<IncomingInterview />} />
        <Route path="/interviewer/grading/:id" element={<Grading />} />
      </Route>

      {/* ===== SHARED ROUTES ===== */}
      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

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
