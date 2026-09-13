import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AuthLayout from "./layouts/AuthLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth, ROLES } from "./contexts/AuthContext";
import Home from "./pages/Home";
import Recruitment from "./pages/recruitment/Recruitment";
import PublicJobDetail from "./pages/recruitment/PublicJobDetail";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import SubAccountManagement from "./pages/admin/SubAccountManagement";
import CreateAccount from "./pages/admin/CreateAccount";
import DepartmentManagement from "./pages/admin/DepartmentManagement";
import EmploymentTypeManagement from "./pages/admin/EmploymentTypeManagement";
import AdminLayout from "./layouts/AdminLayout";
import HumanResourceDashboard from "./pages/human-resource/Dashboard";
import JobManagement from "./pages/human-resource/JobManagement";
import JobDetail from "./pages/human-resource/JobDetail";
import CreateJob from "./pages/human-resource/CreateJob";
import CandidateDetail from "./pages/human-resource/CandidateDetail";
import IncomingInterview from "./pages/interviewer/IncomingInterview";
import Grading from "./pages/interviewer/Grading";
import InterviewerInterviewHistory from "./pages/interviewer/InterviewHistory";
import InterviewScheduleRecruit from "./pages/human-resource/InterviewScheduleRecruit";
import DeptInterviewSchedule from "./pages/dept-manager/InterviewSchedule";
import DeptInterviewDetail from "./pages/dept-manager/InterviewDetail";
import DeptRecruitmentRequests from "./pages/dept-manager/RecruitmentRequests";
import HiringDecision from "./pages/dept-manager/HiringDecision";
import ScreeningApproval from "./pages/dept-manager/ScreeningApproval";
import HiringProposals from "./pages/director/HiringProposals";
import CreateRecruitmentRequest from "./pages/dept-manager/CreateRecruitmentRequest";
import OfferManagement from "./pages/offer/OfferManagement";
import OfferDetail from "./pages/offer/OfferDetail";
import CandidateResponse from "./pages/candidate/CandidateResponse";
import CandidateStatus from "./pages/candidate/CandidateStatus";
import Analytics from "./pages/analytics/Analytics";
import CvIntake from "./pages/human-resource/CvIntake";
import MailTemplates from "./pages/mail-templates/MailTemplates";
import Criteria from "./pages/criteria/Criteria";
import CompanyBranding from "./pages/company/CompanyBranding";
import Settings from "./pages/Settings";
import "./App.css";

const App = () => {
  const { isAuthenticated, loading, user, getDashboardRoute } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          {/* Đích của link trong email quên mật khẩu — path khớp chuỗi BE sinh:
              {CandidatePortal.BaseUrl}/reset-password?token=... */}
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>

      {/* Route ứng viên qua magic link — path khớp link backend sinh trong email:
          /offer (OFFER_RESPONSE) · /status (STATUS). Trang /schedule (ứng viên tự chọn khung)
          đã bỏ 15/08/2026: nhân sự gọi điện chốt giờ rồi nhập buổi vào hệ thống. */}
      <Route path="/candidate/offer-response" element={<CandidateResponse />} />
      <Route path="/offer" element={<CandidateResponse />} />
      <Route path="/status" element={<CandidateStatus />} />

      <Route
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="/admin/sub-accounts" element={<SubAccountManagement />} />
        <Route path="/admin/create-account" element={<CreateAccount />} />
        <Route path="/admin/departments" element={<DepartmentManagement />} />
        <Route path="/admin/employment-types" element={<EmploymentTypeManagement />} />
        <Route path="/admin/company-branding" element={<CompanyBranding />} />
      </Route>

      <Route
        element={
          <ProtectedRoute allowedRoles={[ROLES.HUMAN_RESOURCE]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/human-resource/dashboard" element={<HumanResourceDashboard />} />
        <Route path="/human-resource/jobs" element={<JobManagement />} />
        <Route path="/human-resource/jobs/:id" element={<JobDetail />} />
        <Route path="/human-resource/jobs/create" element={<CreateJob />} />
        <Route path="/human-resource/requests" element={<DeptRecruitmentRequests />} />
        <Route path="/human-resource/candidates/:id" element={<CandidateDetail />} />
        <Route
          path="/interviews/schedule"
          element={<InterviewScheduleRecruit />}
        />
        <Route path="/mail-templates" element={<MailTemplates />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/human-resource/cv-intake" element={<CvIntake />} />
      </Route>

      {/* Tiêu chí đánh giá: nhân sự + Trưởng bộ phận (DM ra đề cho vị trí mình phụ trách —
          24/08/2026). Backend mới là chỗ chặn thật (JobCriteriaAccessGuard). */}
      <Route
        element={
          <ProtectedRoute allowedRoles={[ROLES.HUMAN_RESOURCE, ROLES.DEPARTMENT_MANAGER]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/criteria" element={<Criteria />} />
      </Route>

      <Route
        element={
          <ProtectedRoute allowedRoles={[ROLES.INTERVIEWER]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/interviewer/incoming" element={<IncomingInterview />} />
        <Route
          path="/interviewer/history"
          element={<InterviewerInterviewHistory />}
        />
        <Route path="/interviewer/grading/:id" element={<Grading />} />
      </Route>

      {/* Offers — Human Resource quản lý OfferDetail (sau khi DM đã duyệt ở bước INTERVIEW->OFFER). */}
      <Route
        element={
          <ProtectedRoute allowedRoles={[ROLES.HUMAN_RESOURCE]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/offers" element={<OfferManagement />} />
        <Route path="/offers/:applicationId" element={<OfferDetail />} />
      </Route>

      <Route
        element={
          <ProtectedRoute allowedRoles={[ROLES.DEPARTMENT_MANAGER]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dept/dashboard" element={<Dashboard />} />
        <Route path="/dept/requests" element={<DeptRecruitmentRequests />} />
        <Route path="/dept/interviews" element={<DeptInterviewSchedule />} />
        <Route path="/dept/interview/:id" element={<DeptInterviewDetail />} />
        {/* Cửa 1 của DM: chọn ai được vào vòng phỏng vấn (SCREENING→INTERVIEW) */}
        <Route path="/dept/screening" element={<ScreeningApproval />} />
        <Route path="/dept/hiring-decision" element={<HiringDecision />} />
        <Route path="/dept/hiring-decision/:id" element={<HiringDecision />} />
        <Route
          path="/dept/create-request"
          element={<CreateRecruitmentRequest />}
        />
        {/* Sửa yêu cầu — dùng chung form với tạo mới, chỉ khác chế độ (chỉ sửa được khi PENDING) */}
        <Route
          path="/dept/edit-request/:requestId"
          element={<CreateRecruitmentRequest />}
        />
      </Route>

      {/* Khu Giám đốc (V043): người DUY NHẤT quyết tuyển — duyệt đề xuất của trưởng bộ phận */}
      <Route
        element={
          <ProtectedRoute allowedRoles={[ROLES.DIRECTOR]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/director/proposals" element={<HiringProposals />} />
        {/* V047: Giám đốc duyệt Yêu cầu tuyển dụng của trưởng bộ phận (mở vị trí = cam kết
            chi tiền, nên cùng người chịu trách nhiệm quyết tuyển). Dùng chung màn với DM/nhân
            sự — nút hiện theo role. */}
        <Route path="/director/requests" element={<DeptRecruitmentRequests />} />
        <Route path="/director/dashboard" element={<Dashboard />} />
        {/* Bảng điểm chi tiết của một buổi — dùng chung màn với trưởng bộ phận */}
        <Route path="/director/interview/:id" element={<DeptInterviewDetail />} />
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="/" element={<Home />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="/:slug/career" element={<Recruitment />} />
      {/* Chi tiết tin tuyển dụng — trang riêng (trước đây là modal trong danh sách) */}
      <Route path="/:slug/career/jobs/:jobId" element={<PublicJobDetail />} />

      <Route
        path="*"
        element={
          isAuthenticated ? (
            <Navigate
              to={user ? getDashboardRoute() : "/human-resource/dashboard"}
              replace
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
};

export default App;
