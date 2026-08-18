import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

// Các vai trò trong hệ thống - hỗ trợ nhiều tên gọi từ backend.
//
// HUMAN_RESOURCE vẫn mang GIÁ TRỊ 'Recruiter': đó là chuỗi trong cột User.role của DB và trong
// JWT do backend phát ra (xem RoleConstants.HumanResource). Chỉ tên gọi/URL/nhãn đổi cho khớp
// tài liệu — sửa giá trị ở đây mà không migrate DB sẽ làm mọi kiểm tra quyền trượt hết.
export const ROLES = {
  ADMIN: 'Admin',
  HUMAN_RESOURCE: 'Recruiter',
  INTERVIEWER: 'Interviewer',
  CANDIDATE: 'Candidate',
  DEPARTMENT_MANAGER: 'DepartmentManager',
  // Giám đốc (V043, chốt 15/08/2026) — người DUY NHẤT quyết tuyển. Trưởng bộ phận chỉ đề xuất.
  DIRECTOR: 'Director',
};

// Mapping từ các role name khác nhau sang role chuẩn
const ROLE_MAPPING = {
  'Admin': ROLES.ADMIN,
  'Recruiter': ROLES.HUMAN_RESOURCE,
  'Interviewer': ROLES.INTERVIEWER,
  'Candidate': ROLES.CANDIDATE,
  'DepartmentManager': ROLES.DEPARTMENT_MANAGER,
  'Director': ROLES.DIRECTOR,
  'admin': ROLES.ADMIN,
  'recruiter': ROLES.HUMAN_RESOURCE,
  'interviewer': ROLES.INTERVIEWER,
  'candidate': ROLES.CANDIDATE,
  'departmentmanager': ROLES.DEPARTMENT_MANAGER,
  'director': ROLES.DIRECTOR,
};

// Chuyển đổi role về chuẩn
const normalizeRole = (role) => {
  if (!role) return null;
  return ROLE_MAPPING[role] || role;
};

// Route theo vai trò - chuyển hướng sau khi login
export const ROLE_ROUTES = {
  [ROLES.ADMIN]: '/admin/dashboard',
  [ROLES.HUMAN_RESOURCE]: '/human-resource/dashboard',
  [ROLES.INTERVIEWER]: '/interviewer/incoming',
  [ROLES.DEPARTMENT_MANAGER]: '/dept/dashboard',
  [ROLES.DIRECTOR]: '/director/proposals',
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
    { key: '/admin/employment-types', icon: 'ScheduleOutlined', label: 'Hình Thức Làm Việc' },
    { key: '/admin/company-branding', icon: 'GlobalOutlined', label: 'Thương Hiệu' },
    { key: '/human-resource/jobs', icon: 'FileTextOutlined', label: 'Tin Tuyển Dụng' },
    { key: '/human-resource/requests', icon: 'FileAddOutlined', label: 'Yêu Cầu Tuyển Dụng' },
    { key: '/interviews/schedule', icon: 'CalendarOutlined', label: 'Lịch Phỏng Vấn' },
    { key: '/criteria', icon: 'CheckSquareOutlined', label: 'Tiêu Chí' },
    { key: '/offers', icon: 'CheckSquareOutlined', label: 'Offers' },
    { key: '/human-resource/cv-intake', icon: 'InboxOutlined', label: 'Nhận Hồ Sơ' },
    { key: '/analytics', icon: 'BarChartOutlined', label: 'Báo Cáo' },
    { key: '/mail-templates', icon: 'MailOutlined', label: 'Mẫu Email' },
  ],
  [ROLES.HUMAN_RESOURCE]: [
    { key: '/human-resource/dashboard', icon: 'DashboardOutlined', label: 'Dashboard' },
    { key: '/human-resource/jobs', icon: 'FileTextOutlined', label: 'Tin Tuyển Dụng' },
    { key: '/human-resource/requests', icon: 'FileAddOutlined', label: 'Yêu Cầu Tuyển Dụng' },
    { key: '/interviews/schedule', icon: 'CalendarOutlined', label: 'Lịch Phỏng Vấn' },
    { key: '/criteria', icon: 'CheckSquareOutlined', label: 'Tiêu Chí' },
    { key: '/offers', icon: 'CheckSquareOutlined', label: 'Offers' },
    { key: '/human-resource/cv-intake', icon: 'InboxOutlined', label: 'Nhận Hồ Sơ' },
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
    // DM duyệt ai được vào phỏng vấn (SCREENING->INTERVIEW) và ĐỀ XUẤT tuyển; quyết định
    // cuối là của Giám đốc (V043). Human Resource sàng lọc, xếp lịch và soạn thư mời.
    { key: '/dept/screening', icon: 'SolutionOutlined', label: 'Duyệt Vào Phỏng Vấn' },
    { key: '/dept/hiring-decision', icon: 'AuditOutlined', label: 'Đề Xuất Tuyển' },
    { key: '/dept/create-request', icon: 'FileAddOutlined', label: 'Tạo Yêu Cầu Tuyển Dụng' },
  ],
  // Giám đốc chỉ có đúng việc của mình: duyệt hai cửa (mở vị trí, tuyển người) + nhìn số liệu.
  [ROLES.DIRECTOR]: [
    { key: '/director/requests', icon: 'FileAddOutlined', label: 'Duyệt Yêu Cầu Tuyển Dụng' },
    { key: '/director/proposals', icon: 'AuditOutlined', label: 'Duyệt Đề Xuất Tuyển' },
    { key: '/director/dashboard', icon: 'DashboardOutlined', label: 'Dashboard' },
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
    [ROLES.HUMAN_RESOURCE]: [
      '/human-resource',
      '/interviews',
      '/offers',
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
    [ROLES.DIRECTOR]: [
      '/director',
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
      let email = payload.Email || payload.email || payload.Username || payload.username || payload.unique_name || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
      
      // Tìm fullName - thử nhiều key  
      let fullName = payload.FullName || payload.fullName || payload.Name || payload.name || payload.full_name || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];
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

      // BE trả cùng shape với login: { companyId, accessToken, refreshToken } — role/email
      // nằm trong JWT, phải decode như login (trước đây lưu nguyên response nên user thiếu role).
      const accessToken =
        responseData.accessToken || responseData.token || responseData.access_token;
      const refreshToken = responseData.refreshToken || responseData.refresh_token;

      if (!accessToken) {
        throw new Error('Không nhận được access token từ server');
      }

      localStorage.setItem('token', accessToken);
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }

      const userData = parseJwt(accessToken);
      userData.role = normalizeRole(userData.role);
      localStorage.setItem('user', JSON.stringify(userData));

      setUser(userData);
      setIsAuthenticated(true);

      return userData;
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
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

  const getDashboardRoute = (role = null) => {
    const targetRole = role || user?.role;
    if (!targetRole) return '/login';
    const normalizedRole = normalizeRole(targetRole);
    return ROLE_ROUTES[normalizedRole] || '/';
  };

  // Đồng bộ lại thông tin hiển thị sau khi user tự sửa hồ sơ ở màn Settings.
  // Token không đổi (chỉ cấp lại khi đăng nhập), nên phải vá state + localStorage
  // thì tên trên header mới đổi ngay thay vì phải đăng xuất/đăng nhập lại.
  const updateUserProfile = (patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    updateUserProfile,
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
