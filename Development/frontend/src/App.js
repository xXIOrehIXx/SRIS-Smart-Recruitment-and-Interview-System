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
import InterviewerInterviewSchedule from './pages/interviewer/InterviewSchedule';
import InterviewerInterviewHistory from './pages/interviewer/InterviewHistory';
import InterviewerInterviewDetail from './pages/interviewer/InterviewDetail';
import InterviewSchedule from './pages/interview/InterviewSchedule';
import DeptManagerDashboard from './pages/dept-manager/Dashboard';
import DeptInterviewSchedule from './pages/dept-manager/InterviewSchedule';
import DeptInterviewDetail from './pages/dept-manager/InterviewDetail';
import DeptRecruitmentRequests from './pages/dept-manager/RecruitmentRequests';
import HiringDecision from './pages/dept-manager/HiringDecision';
import CreateRecruitmentRequest from './pages/dept-manager/CreateRecruitmentRequest';
import OfferManagement from './pages/offer/OfferManagement';
import CandidateResponse from './pages/candidate/CandidateResponse';
import Analytics from './pages/analytics/Analytics';
import CVScoring from './pages/analytics/CVScoring';
import TalentPool from './pages/talent-pool/TalentPool';
import MailTemplates from './pages/mail-templates/MailTemplates';
import Criteria from './pages/criteria/Criteria';
import CompanyBranding from './pages/company/CompanyBranding';
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

      {/* ===== CANDIDATE MAGIC LINK (Public) ===== */}
      <Route path="/candidate/offer-response" element={<CandidateResponse />} />

      {/* ===== ADMIN ONLY ===== */}
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
        <Route path="/admin/company-branding" element={<CompanyBranding />} />
      </Route>

      {/* ===== RECRUITER ONLY ===== */}
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
        <Route path="/interviews/schedule" element={<InterviewSchedule />} />
        <Route path="/offers" element={<OfferManagement />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/analytics/cv-scoring" element={<CVScoring />} />
        <Route path="/talent-pool" element={<TalentPool />} />
      </Route>

      {/* ===== SHARED: Admin + Recruiter ===== */}
      <Route
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.RECRUITER]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/criteria" element={<Criteria />} />
        <Route path="/mail-templates" element={<MailTemplates />} />
      </Route>

      {/* ===== INTERVIEWER ONLY ===== */}
      <Route
        element={
          <ProtectedRoute allowedRoles={[ROLES.INTERVIEWER]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/interviewer/dashboard" element={<InterviewerDashboard />} />
        <Route path="/interviewer/incoming" element={<IncomingInterview />} />
        <Route path="/interviewer/schedule" element={<InterviewerInterviewSchedule />} />
        <Route path="/interviewer/history" element={<InterviewerInterviewHistory />} />
        <Route path="/interviewer/interview/:id" element={<InterviewerInterviewDetail />} />
        <Route path="/interviewer/grading/:id" element={<Grading />} />
      </Route>

      {/* ===== DEPARTMENT MANAGER ONLY ===== */}
      <Route
        element={
          <ProtectedRoute allowedRoles={[ROLES.DEPARTMENT_MANAGER]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dept/dashboard" element={<DeptManagerDashboard />} />
        <Route path="/dept/requests" element={<DeptRecruitmentRequests />} />
        <Route path="/dept/interviews" element={<DeptInterviewSchedule />} />
        <Route path="/dept/interview/:id" element={<DeptInterviewDetail />} />
        <Route path="/dept/hiring-decision" element={<HiringDecision />} />
        <Route path="/dept/hiring-decision/:id" element={<HiringDecision />} />
        <Route path="/dept/create-request" element={<CreateRecruitmentRequest />} />
      </Route>

      {/* ===== SHARED: All authenticated users ===== */}
      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
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
