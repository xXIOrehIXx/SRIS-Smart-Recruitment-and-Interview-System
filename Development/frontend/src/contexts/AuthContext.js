import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

// Các vai trò trong hệ thống
export const ROLES = {
  ADMIN: 'Admin',
  RECRUITER: 'Recruiter',
  INTERVIEWER: 'Interviewer',
  CANDIDATE: 'Candidate',
};

// Route theo vai trò - chuyển hướng sau khi login
export const ROLE_ROUTES = {
  [ROLES.ADMIN]: '/admin/dashboard',
  [ROLES.RECRUITER]: '/recruiter/dashboard',
  [ROLES.INTERVIEWER]: '/interviewer/dashboard',
};

// Menu items theo vai trò
export const ROLE_MENUS = {
  [ROLES.ADMIN]: [
    { key: '/admin/dashboard', icon: 'DashboardOutlined', label: 'Dashboard' },
    { key: '/admin/sub-accounts', icon: 'TeamOutlined', label: 'Quản lý tài khoản' },
    { key: '/admin/create-account', icon: 'UserAddOutlined', label: 'Tạo tài khoản' },
    { key: '/settings', icon: 'SettingOutlined', label: 'Cài đặt' },
  ],
  [ROLES.RECRUITER]: [
    { key: '/recruiter/dashboard', icon: 'DashboardOutlined', label: 'Dashboard' },
<<<<<<< Updated upstream
    { key: '/recruiter/jobs', icon: 'FileTextOutlined', label: 'Job Posts' },
    { key: '/quiz', icon: 'QuestionCircleOutlined', label: 'Quiz Management' },
    { key: '/interviews/schedule', icon: 'CalendarOutlined', label: 'Interviews' },
=======
    { key: '/recruiter/jobs', icon: 'FileTextOutlined', label: 'Tin Tuyển Dụng' },
    { key: '/interviews/schedule', icon: 'CalendarOutlined', label: 'Lịch Phỏng Vấn' },
>>>>>>> Stashed changes
    { key: '/offers', icon: 'CheckSquareOutlined', label: 'Offers' },
    { key: '/notifications', icon: 'BellOutlined', label: 'Notifications' },
    { key: '/settings', icon: 'SettingOutlined', label: 'Settings' },
  ],
  [ROLES.INTERVIEWER]: [
    { key: '/interviewer/dashboard', icon: 'DashboardOutlined', label: 'Dashboard' },
    { key: '/interviewer/incoming', icon: 'CalendarOutlined', label: 'Incoming Interviews' },
    { key: '/notifications', icon: 'BellOutlined', label: 'Notifications' },
    { key: '/settings', icon: 'SettingOutlined', label: 'Settings' },
  ],
};

// Kiểm tra quyền truy cập route
export const hasPermission = (userRole, route) => {
  if (!userRole) return false;

  const rolePermissions = {
    [ROLES.ADMIN]: [
      '/admin',
      '/recruiter',
      '/interviewer',
      '/interviews',
      '/offers',
      '/notifications',
      '/settings',
    ],
    [ROLES.RECRUITER]: [
      '/recruiter',
      '/interviews',
      '/offers',
      '/notifications',
      '/settings',
    ],
    [ROLES.INTERVIEWER]: [
      '/interviewer',
      '/notifications',
      '/settings',
    ],
  };

  const permissions = rolePermissions[userRole] || [];
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
        setUser(parsedUser);
        setIsAuthenticated(true);
      } catch (e) {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const response = await authAPI.login(email, password);
    const { accessToken, refreshToken } = response.data;

    // Lưu vào localStorage
    localStorage.setItem('token', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    // Parse JWT token để lấy user info
    const userData = parseJwt(accessToken);
    localStorage.setItem('user', JSON.stringify(userData));

    setUser(userData);
    setIsAuthenticated(true);

    return userData;
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
      
      // Tìm role - thử tất cả các key có thể (không phân biệt hoa thường)
      let role = payload.Role || payload.role;
      if (!role) {
        const roleKey = Object.keys(payload).find(k => 
          k.toLowerCase().includes('role') || 
          k.includes('identity/claims/role')
        );
        if (roleKey) role = payload[roleKey];
      }
      
      // Tìm email - thử nhiều key
      let email = payload.Email || payload.email || payload.UniqueName || payload.unique_name;
      
      // Tìm fullName - thử nhiều key  
      let fullName = payload.FullName || payload.fullName || payload.Name || payload.name;
      if (!fullName) fullName = payload.UniqueName || payload.unique_name;
      
      // Tìm userId - thử nhiều key
      let userId = payload.UserId || payload.userId || payload.NameId || payload.nameid;
      
      // Tìm companyId - thử nhiều key
      let companyId = payload.CompanyId || payload.companyId;
      
      return {
        userId: userId,
        email: email,
        fullName: fullName,
        role: role,
        companyId: companyId,
      };
    } catch (e) {
      console.error('Error parsing JWT:', e);
      return null;
    }
  };

  const register = async (data) => {
    const response = await authAPI.register(data);
    const { token, user: userData } = response.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));

    setUser(userData);
    setIsAuthenticated(true);

    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  const getMenuItems = () => {
    if (!user?.role) return [];
    return ROLE_MENUS[user.role] || [];
  };

  const getDashboardRoute = () => {
    if (!user?.role) return '/login';
    return ROLE_ROUTES[user.role] || '/';
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
