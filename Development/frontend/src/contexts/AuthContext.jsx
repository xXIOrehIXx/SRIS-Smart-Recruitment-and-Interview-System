import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

// Các vai trò trong hệ thống - hỗ trợ nhiều tên gọi từ backend
export const ROLES = {
  ADMIN: 'Admin',
  RECRUITER: 'Recruiter',
  INTERVIEWER: 'Interviewer',
  CANDIDATE: 'Candidate',
  DEPARTMENT_MANAGER: 'DepartmentManager',
};

// Mapping từ các role name khác nhau sang role chuẩn
const ROLE_MAPPING = {
  'Admin': ROLES.ADMIN,
  'Recruiter': ROLES.RECRUITER,
  'Interviewer': ROLES.INTERVIEWER,
  'Candidate': ROLES.CANDIDATE,
  'DepartmentManager': ROLES.DEPARTMENT_MANAGER,
  'admin': ROLES.ADMIN,
  'recruiter': ROLES.RECRUITER,
  'interviewer': ROLES.INTERVIEWER,
  'candidate': ROLES.CANDIDATE,
  'departmentmanager': ROLES.DEPARTMENT_MANAGER,
};

// Chuyển đổi role về chuẩn
const normalizeRole = (role) => {
  if (!role) return null;
  return ROLE_MAPPING[role] || role;
};

// Route theo vai trò - chuyển hướng sau khi login
export const ROLE_ROUTES = {
  [ROLES.ADMIN]: '/admin/dashboard',
  [ROLES.RECRUITER]: '/recruiter/dashboard',
  [ROLES.INTERVIEWER]: '/interviewer/incoming',
  [ROLES.DEPARTMENT_MANAGER]: '/dept/dashboard',
};

// Menu items theo vai trò
export const ROLE_MENUS = {
  // Admin bypass mọi quyền (khớp backend) — menu gồm cả mục vận hành để công ty
  // 1 tài khoản Admin chạy trọn luồng tuyển dụng không phải gõ URL tay.
  [ROLES.ADMIN]: [
    { key: '/admin/dashboard', icon: 'DashboardOutlined', label: 'Dashboard' },
    { key: '/admin/sub-accounts', icon: 'TeamOutlined', label: 'Quản lý tài khoản' },
    { key: '/admin/create-account', icon: 'UserAddOutlined', label: 'Tạo tài khoản' },
    { key: '/admin/departments', icon: 'ApartmentOutlined', label: 'Phòng Ban' },
    { key: '/admin/company-branding', icon: 'GlobalOutlined', label: 'Thương Hiệu' },
    { key: '/recruiter/jobs', icon: 'FileTextOutlined', label: 'Tin Tuyển Dụng' },
    { key: '/recruiter/requests', icon: 'FileAddOutlined', label: 'Yêu Cầu Tuyển Dụng' },
    { key: '/interviews/schedule', icon: 'CalendarOutlined', label: 'Lịch Phỏng Vấn' },
    { key: '/criteria', icon: 'CheckSquareOutlined', label: 'Tiêu Chí' },
    { key: '/offers', icon: 'CheckSquareOutlined', label: 'Offers' },
    { key: '/talent-pool', icon: 'TeamOutlined', label: 'Talent Pool' },
    { key: '/analytics', icon: 'BarChartOutlined', label: 'Báo Cáo' },
    { key: '/mail-templates', icon: 'MailOutlined', label: 'Mẫu Email' },
  ],
  [ROLES.RECRUITER]: [
    { key: '/recruiter/dashboard', icon: 'DashboardOutlined', label: 'Dashboard' },
    { key: '/recruiter/jobs', icon: 'FileTextOutlined', label: 'Tin Tuyển Dụng' },
    { key: '/recruiter/requests', icon: 'FileAddOutlined', label: 'Yêu Cầu Tuyển Dụng' },
    { key: '/interviews/schedule', icon: 'CalendarOutlined', label: 'Lịch Phỏng Vấn' },
    { key: '/criteria', icon: 'CheckSquareOutlined', label: 'Tiêu Chí' },
    { key: '/offers', icon: 'CheckSquareOutlined', label: 'Offers' },
    { key: '/talent-pool', icon: 'TeamOutlined', label: 'Talent Pool' },
    { key: '/mail-templates', icon: 'MailOutlined', label: 'Mẫu Email' },
  ],
  [ROLES.INTERVIEWER]: [
    { key: '/interviewer/history', icon: 'HistoryOutlined', label: 'Lịch Sử Phỏng Vấn' },
    { key: '/interviewer/incoming', icon: 'VideoCameraOutlined', label: 'Phỏng Vấn Sắp Tới' },
  ],
  [ROLES.DEPARTMENT_MANAGER]: [
    { key: '/dept/dashboard', icon: 'DashboardOutlined', label: 'Dashboard' },
    { key: '/dept/requests', icon: 'FileTextOutlined', label: 'Yêu Cầu Tuyển Dụng' },
    { key: '/dept/interviews', icon: 'CalendarOutlined', label: 'Lịch Phỏng Vấn' },
    { key: '/dept/hiring-decision', icon: 'AuditOutlined', label: 'Quyết Định Tuyển Dụng' },
    { key: '/dept/create-request', icon: 'FileAddOutlined', label: 'Tạo Yêu Cầu Tuyển Dụng' },
  ],
};

// Kiểm tra quyền truy cập route
export const hasPermission = (userRole, route) => {
  if (!userRole) return false;

  const normalizedRole = normalizeRole(userRole);

  // Admin bypass (khớp backend WithRole)
  if (normalizedRole === ROLES.ADMIN) return true;
  
  const rolePermissions = {
    [ROLES.ADMIN]: [
      '/admin',
      '/settings',
    ],
    [ROLES.RECRUITER]: [
      '/recruiter',
      '/interviews',
      '/offers',
      '/talent-pool',
      '/criteria',
      '/mail-templates',
      '/settings',
    ],
    [ROLES.INTERVIEWER]: [
      '/interviewer',
      '/settings',
    ],
    [ROLES.DEPARTMENT_MANAGER]: [
      '/dept',
      '/settings',
    ],
  };

  const permissions = rolePermissions[normalizedRole] || [];
  return permissions.some(path => route.startsWith(path));
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Kiểm tra localStorage khi load app
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (storedUser && token) {
      try {
        const parsedUser = JSON.parse(storedUser);
        // Đảm bảo role được normalize
        parsedUser.role = normalizeRole(parsedUser.role);
        setUser(parsedUser);
        setIsAuthenticated(true);
      } catch (e) {
        console.error('Error parsing stored user:', e);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password);
      const data = response.data;
      
      // Lấy tokens - hỗ trợ nhiều cấu trúc response
      const accessToken = data.accessToken || data.token || data.access_token;
      const refreshToken = data.refreshToken || data.refresh_token;

      if (!accessToken) {
        throw new Error('Không nhận được access token từ server');
      }

      // Lưu vào localStorage
      localStorage.setItem('token', accessToken);
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }

      // Parse JWT token để lấy user info
      const userData = parseJwt(accessToken);
      
      // Đảm bảo role được normalize
      userData.role = normalizeRole(userData.role);
      
      localStorage.setItem('user', JSON.stringify(userData));

      setUser(userData);
      setIsAuthenticated(true);

      return userData;
    } catch (error) {
      // Xóa localStorage nếu login thất bại
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      throw error;
    }
  };

  // Parse JWT token
  const parseJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const payload = JSON.parse(jsonPayload);
      
      console.log('JWT Payload:', payload); // DEBUG
      
      // Tìm role - thử tất cả các key có thể
      let role = payload.Role || payload.role;
      if (!role) {
        // Tìm trong các key mở rộng
        const roleKey = Object.keys(payload).find(k => 
          k.toLowerCase().includes('role') || 
          k.includes('identity/claims/role') ||
          k === 'user_role' ||
          k === 'userType'
        );
        if (roleKey) role = payload[roleKey];
      }
      
      // Nếu vẫn không có, thử lấy từ http://schemas.microsoft.com/ws/2008/06/identity/claims/role
      if (!role && payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']) {
        role = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
      }
      
      // Tìm email - thử nhiều key
      let email = payload.Email || payload.email || payload.Username || payload.username;
      
      // Tìm fullName - thử nhiều key  
      let fullName = payload.FullName || payload.fullName || payload.Name || payload.name;
      if (!fullName) fullName = payload.Username || payload.username;
      
      // Tìm userId - thử nhiều key
      let userId = payload.UserId || payload.userId || payload.NameId || payload.nameid || payload.sub;
      
      // Tìm companyId - thử nhiều key
      let companyId = payload.CompanyId || payload.companyId || payload.company_id;
      
      // Tìm thêm các trường bổ sung
      let phone = payload.Phone || payload.phone || payload.PhoneNumber;
      let avatar = payload.Avatar || payload.avatar || payload.picture;
      
      return {
        userId: userId,
        email: email,
        fullName: fullName,
        role: role,
        companyId: companyId,
        phone: phone,
        avatar: avatar,
        // Giữ lại payload gốc để debug
        _rawPayload: payload,
      };
    } catch (e) {
      console.error('Error parsing JWT:', e);
      return {
        userId: null,
        email: null,
        fullName: null,
        role: null,
        companyId: null,
      };
    }
  };

  const register = async (data) => {
    try {
      const response = await authAPI.register(data);
      const responseData = response.data;

      const token = responseData.token || responseData.accessToken;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(responseData.user || responseData));

      setUser(responseData.user || responseData);
      setIsAuthenticated(true);

      return responseData;
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      throw error;
    }
  };

  const logout = () => {
    try {
      authAPI.logout();
    } catch (e) {
      // Ignore logout API errors
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  const getMenuItems = () => {
    if (!user?.role) return [];
    const normalizedRole = normalizeRole(user.role);
    return ROLE_MENUS[normalizedRole] || [];
  };

  const getDashboardRoute = () => {
    if (!user?.role) return '/login';
    const normalizedRole = normalizeRole(user.role);
    return ROLE_ROUTES[normalizedRole] || '/';
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    getMenuItems,
    getDashboardRoute,
    hasPermission: (route) => hasPermission(user?.role, route),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
