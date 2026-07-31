import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spin } from "antd";
import { useAuth, ROLES } from "../contexts/AuthContext";

// Mapping từ các role name khác nhau sang role chuẩn
const ROLE_MAPPING = {
  Admin: ROLES.ADMIN,
  Recruiter: ROLES.RECRUITER,
  Interviewer: ROLES.INTERVIEWER,
  Candidate: ROLES.CANDIDATE,
  DepartmentManager: ROLES.DEPARTMENT_MANAGER,
  admin: ROLES.ADMIN,
  recruiter: ROLES.RECRUITER,
  interviewer: ROLES.INTERVIEWER,
  candidate: ROLES.CANDIDATE,
  departmentmanager: ROLES.DEPARTMENT_MANAGER,
};

// Chuyển đổi role về chuẩn
const normalizeRole = (role) => {
  if (!role) return null;
  return ROLE_MAPPING[role] || role;
};

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <Spin size="large" />
        <span>Đang tải...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Normalize user role
  const userRole = normalizeRole(user?.role);

  // Admin bypass mọi route — khớp backend ([WithRole] cho Admin qua hết):
  // công ty nhỏ chỉ có 1 tài khoản Admin vẫn phải chạy được trọn luồng tuyển dụng.
  if (userRole === ROLES.ADMIN) {
    return children;
  }

  // Nếu có allowedRoles, kiểm tra quyền
  if (allowedRoles.length > 0) {
    const normalizedAllowedRoles = allowedRoles.map(
      (r) => normalizeRole(r) || r,
    );

    if (!normalizedAllowedRoles.includes(userRole)) {
      // Chuyển hướng về dashboard phù hợp với role
      const dashboardRoutes = {
        [ROLES.ADMIN]: "/admin/dashboard",
        [ROLES.RECRUITER]: "/recruiter/dashboard",
        [ROLES.INTERVIEWER]: "/interviewer/incoming",
        [ROLES.DEPARTMENT_MANAGER]: "/dept/dashboard",
      };
      const redirectPath = dashboardRoutes[userRole] || "/login";
      return <Navigate to={redirectPath} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
