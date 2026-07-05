import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth, ROLES } from '../contexts/AuthContext';

// Mapping từ các role name khác nhau sang role chuẩn
const ROLE_MAPPING = {
  'Admin': ROLES.ADMIN,
  'Recruiter': ROLES.RECRUITER,
  'Interviewer': ROLES.INTERVIEWER,
  'Candidate': ROLES.CANDIDATE,
  'admin': ROLES.ADMIN,
  'recruiter': ROLES.RECRUITER,
  'interviewer': ROLES.INTERVIEWER,
  'candidate': ROLES.CANDIDATE,
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
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
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

  // Nếu có allowedRoles, kiểm tra quyền
  if (allowedRoles.length > 0) {
    const normalizedAllowedRoles = allowedRoles.map(r => normalizeRole(r) || r);
    
    if (!normalizedAllowedRoles.includes(userRole)) {
      // Chuyển hướng về dashboard phù hợp với role
      const dashboardRoutes = {
        [ROLES.ADMIN]: '/admin/dashboard',
        [ROLES.RECRUITER]: '/recruiter/dashboard',
        [ROLES.INTERVIEWER]: '/interviewer/dashboard',
      };
      const redirectPath = dashboardRoutes[userRole] || '/login';
      return <Navigate to={redirectPath} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
