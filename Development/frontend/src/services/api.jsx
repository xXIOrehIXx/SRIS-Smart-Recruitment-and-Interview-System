import axios from 'axios';

// Cấu hình base URL - mặc định '/api' để đi qua dev proxy (setupProxy.js) hoặc
// reverse proxy khi deploy. Đặt REACT_APP_API_URL khi backend ở origin khác.
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Các trang KHÔNG cần đăng nhập (khớp route công khai trong App.jsx): career site theo slug
// công ty + 3 trang ứng viên vào bằng magic link + đặt lại mật khẩu. Dùng để chặn interceptor
// 401 đá về /login. Riêng /reset-password: token hết hạn/đã dùng -> BE trả 401
// (AuthErrorCode.ExpiredForgotPassword); nếu để interceptor redirect thì user bị ném về
// /login không lời giải thích, thay vì đọc được "liên kết đã hết hạn" ngay trên trang.
const isPublicPath = (pathname) =>
  pathname === '/' ||
  /^\/[^/]+\/career(\/|$)/.test(pathname) ||
  ['/schedule', '/offer', '/status', '/candidate/offer-response',
   '/forgot-password', '/reset-password'].includes(pathname);

// Tạo axios instance
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor để thêm token vào request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Backend trả lỗi dạng PascalCase (ErrorObjectCommon: UserMsg/DevMsg/ErrorCode qua
// Newtonsoft), còn FE đọc camelCase -> chuẩn hóa tại đây để MỌI trang hiện đúng
// lý do thật thay vì thông báo chung chung. Kèm fallback cho ProblemDetails (400 binding).
const normalizeApiError = (error) => {
  const d = error.response?.data;
  if (d && typeof d === 'object') {
    let firstBindingError = null;
    if (d.errors && typeof d.errors === 'object') {
      const firstKey = Object.keys(d.errors)[0];
      if (firstKey) firstBindingError = [].concat(d.errors[firstKey])[0];
    }
    d.userMsg = d.userMsg || d.UserMsg || d.ErrorMessage || firstBindingError || d.title || d.error;
    d.devMsg = d.devMsg || d.DevMsg;
    d.errorCode = d.errorCode || d.ErrorCode;
  }
  return Promise.reject(error);
};

// Interceptor để xử lý response
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/account/login')) {
      // Token hết hạn hoặc không hợp lệ
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Tránh reload vòng lặp vô hạn nếu đang ở /login, VÀ không đá khách vãng lai ra khỏi
      // các trang vốn không cần đăng nhập (career site, magic link ứng viên): ở đó một request
      // 401 lạc là chuyện bình thường, không phải phiên hết hạn.
      if (window.location.pathname !== '/login' && !isPublicPath(window.location.pathname)) {
        window.location.href = '/login';
      }
    }
    return normalizeApiError(error);
  }
);

// ==================== AUTH ====================

export const authAPI = {
  login: (email, password) =>
    api.post('/account/login', { email, password }),

  register: (data) =>
    api.post('/account/register', data),

  forgotPassword: (email) =>
    api.post('/account/forgot-password', { email }),

  resetPassword: (token, newPassword) =>
    api.post('/account/reset-password', { token, newPassword }),

  refreshToken: (refreshToken) =>
    api.post('/account/refresh-token', { refreshToken }),

  changePassword: (oldPassword, newPassword) =>
    api.post('/account/change-password', { oldPassword, newPassword }),

  me: () =>
    api.get('/account/me'),

  // Tự sửa hồ sơ mình (tên + SĐT) — mọi role gọi được.
  // KHÔNG dùng usersAPI.update: endpoint đó chỉ Admin vào được và bắt buộc role/status.
  updateProfile: (data) =>
    api.put('/account/me', data),

  // Đổi ảnh đại diện — multipart, trường 'file'. Trả { avatarUrl } (presigned, có hạn).
  //
  // BẮT BUỘC ghi đè Content-Type ở đây: instance `api` mặc định 'application/json', mà
  // axios 1.x gặp FormData kèm content-type JSON thì nó ĐỔI FormData thành JSON
  // (formDataToJSON) -> file bay mất, server nhận body rỗng và trả 400 "Thiếu file ảnh".
  // Đặt 'multipart/form-data' rồi adapter của axios sẽ tự bỏ header này để trình duyệt
  // gắn boundary thật. Các endpoint upload khác trong file này cũng làm đúng như vậy.
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/account/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  removeAvatar: () =>
    api.delete('/account/me/avatar'),

  logout: () =>
    api.post('/account/logout'),
};

// ==================== JOBS ====================

// Public API instance - không có interceptor redirect login
const publicApi = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

publicApi.interceptors.response.use((r) => r, normalizeApiError);

export const jobsAPI = {
  getAll: (includeInactive = false) =>
    api.get(`/jobs${includeInactive ? '?includeInactive=true' : ''}`),

  getById: (id) =>
    api.get(`/jobs/${id}`),

  create: (data) =>
    api.post('/jobs', data),

  update: (id, data) =>
    api.put(`/jobs/${id}`, data),

  delete: (id) =>
    api.delete(`/jobs/${id}`),

  // Public career site với slug (không cần login)
  getPublicBrand: (slug) =>
    publicApi.get(`/public/${slug}/brand`),

  getPublicJobsBySlug: (slug) =>
    publicApi.get(`/public/${slug}/jobs`),

  getPublicJobBySlug: (slug, jobId) =>
    publicApi.get(`/public/${slug}/jobs/${jobId}`),

  applyForJobBySlug: (slug, jobId, formData) =>
    publicApi.post(`/public/${slug}/jobs/${jobId}/apply`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// ==================== CV (nhận hồ sơ) ====================

// Nhận CV vào hệ thống. KHÔNG chấm điểm, không xếp hạng — sàng lọc là việc của người.
export const cvAPI = {
  uploadCV: async (formData, onProgress) => {
    const response = await api.post('/cvs/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: onProgress,
    });
    return response;
  },

  // Trả { url } — presigned URL (~1h) để mở/tải file CV gốc
  getCvFileUrl: (cvId) =>
    api.get(`/cvs/${cvId}/file-url`),
};

// ==================== APPLICATIONS ====================

export const applicationAPI = {
  // Trả ApplicationBoardDto: { jobId, applications: [...] }
  getAll: (jobId) =>
    api.get(`/jobs/${jobId}/applications`),

  getById: (id) =>
    api.get(`/applications/${id}`),

  // reason tùy chọn (kể cả khi toState = 'REJECTED')
  transition: (id, toState, reason) =>
    api.post(`/applications/${id}/transition`, { toState, reason }),

  // Loại hồ sơ — reason tùy chọn (bỏ trống thì backend lưu null)
  reject: (id, reason) =>
    api.post(`/applications/${id}/reject`, { reason }),

  getHistory: (id) =>
    api.get(`/applications/${id}/history`),

  getNotes: (id) =>
    api.get(`/applications/${id}/notes`),

  addNote: (id, content) =>
    api.post(`/applications/${id}/notes`, { content }),

  // purpose: SCHEDULE | STATUS | OFFER_RESPONSE (TTL do backend quyết theo purpose)
  createMagicLink: (id, purpose = 'STATUS') =>
    api.post(`/applications/${id}/magic-links?purpose=${purpose}`),
};

// ==================== INTERVIEW SCHEDULING ====================

// Lịch phỏng vấn theo POOL dùng chung (docs Section 15):
// Human Resource mở 1 pool khung giờ cho job + vòng → mời nhiều ứng viên (mỗi người 1
// magic link SCHEDULE) → ai chốt slot trước lấy trước. Chốt tay cho nhánh gọi điện.
export const interviewAPI = {
  // Danh sách pool của 1 job (kèm slots + ứng viên đã mời + cờ nhắc vàng/đỏ)
  getInterviewPools: (jobId) =>
    api.get(`/jobs/${jobId}/interview-pools`),

  // data: { roundNumber?, slots: [{ interviewerIds: [1..5 nguoi], startTime }] } — panel/slot
  createPool: (jobId, data) =>
    api.post(`/jobs/${jobId}/interview-pools`, data),

  // Mời ứng viên vào pool — trả { invited: [...], skipped: [...] }
  invite: (poolId, applicationIds) =>
    api.post(`/interview-pools/${poolId}/invitations`, { applicationIds }),

  cancelPool: (poolId, reason) =>
    api.post(`/interview-pools/${poolId}/cancel`, { reason }),

  // Chốt lịch TAY cho 1 ứng viên: { interviewerIds: [...], startTime, roundNumber? }
  manualConfirm: (applicationId, data) =>
    api.post(`/applications/${applicationId}/manual-interview`, data),

  // Interviewer's schedules
  getMySchedules: () =>
    api.get('/me/interview-schedules'),

  // Grading APIs
  getMySheet: (scheduleId) =>
    api.get(`/interview-schedules/${scheduleId}/my-sheet`),

  updateMySheet: (scheduleId, data) =>
    api.put(`/interview-schedules/${scheduleId}/my-sheet`, data),

  submitMySheet: (scheduleId) =>
    api.post(`/interview-schedules/${scheduleId}/my-sheet/submit`),

  getAggregate: (scheduleId) =>
    api.get(`/interview-schedules/${scheduleId}/aggregate`),

  // Điểm phỏng vấn của CẢ hồ sơ, tách theo từng vòng — màn quyết định tuyển dụng của DM.
  // Trả [{ scheduleId, roundNumber, scheduledAt, scheduleStatus, submittedInterviewers,
  //        criteria: [{ name, weight, maxScore, average, stdDev, needsDiscussion, scores: [...] }],
  //        interviewerTotals: [{ interviewerId, interviewerName, weightedPercent }],
  //        panelWeightedPercent }]   — weightedPercent/panelWeightedPercent là % 0–100.
  getApplicationAggregate: (applicationId) =>
    api.get(`/applications/${applicationId}/interview-aggregate`),

  // Bản tóm tắt để CHỐT tuyển — KHÔNG có điểm, chỉ đề xuất + lý do (V031).
  // Trả { candidateName, jobTitle, cvId, hireCount, considerCount, noHireCount, totalSubmitted,
  //       rounds: [{ roundNumber, scheduledAt, submittedInterviewers,
  //                  verdicts: [{ interviewerName, recommendation, summary, notes: [{criteriaName, note}] }] }],
  //       internalNotes: [{ authorName, content, createdAt }] }
  getDecisionBrief: (applicationId) =>
    api.get(`/applications/${applicationId}/decision-brief`),
};

// ==================== CANDIDATE (Magic Link) ====================

// Token luôn đi qua QUERY STRING (?token=) — backend đọc [FromQuery] ở mọi endpoint,
// body chỉ chứa dữ liệu nghiệp vụ (slotId / accept).
export const candidateAPI = {
  getStatus: (token) =>
    api.get(`/candidate/status?token=${encodeURIComponent(token)}`),

  getSchedule: (token) =>
    api.get(`/candidate/schedule?token=${encodeURIComponent(token)}`),

  confirmSchedule: (token, slotId) =>
    api.post(`/candidate/schedule/confirm?token=${encodeURIComponent(token)}`, { slotId }),

  noSlotAvailable: (token) =>
    api.post(`/candidate/schedule/no-slot?token=${encodeURIComponent(token)}`),

  // Tóm tắt thư mời nhận việc (ứng viên KHÔNG bấm đồng ý/từ chối — 5.15)
  getOffer: (token) =>
    api.get(`/candidate/offer?token=${encodeURIComponent(token)}`),

  // URL file PDF thư mời — dùng thẳng cho <iframe>/thẻ tải, không qua axios
  // (BASE_URL vì trang ứng viên có thể chạy khác origin với BE).
  offerLetterUrl: (token) =>
    `${BASE_URL}/candidate/offer/letter?token=${encodeURIComponent(token)}`,
};

// ==================== OFFER ====================

export const offerAPI = {
  // Giá trị điền sẵn cho form soạn thư (lấy từ Job + Company + hồ sơ)
  getDefaults: (applicationId) =>
    api.get(`/applications/${applicationId}/offer/defaults`),

  // data: toàn bộ các mục của thư mời (xem MakeOfferDto ở BE) — ô để trống thì BE tự
  // điền mặc định. Trả { offer, magicToken, ... }: link để ứng viên mở PDF thư mời.
  create: (applicationId, data) =>
    api.post(`/applications/${applicationId}/offer`, data),

  getByApplication: (applicationId) =>
    api.get(`/applications/${applicationId}/offer`),

  // Bản PDF thư đã gửi — mở trong tab mới (cần token nên tải qua axios rồi tạo blob URL).
  getLetterBlob: (applicationId) =>
    api.get(`/applications/${applicationId}/offer/letter`, { responseType: 'blob' }),

  // Ứng viên trả lời NGOÀI hệ thống -> Human Resource ghi nhận: accepted=true -> HIRED, false -> REJECTED
  recordOutcome: (applicationId, accepted, note) =>
    api.post(`/applications/${applicationId}/offer/outcome`, { accepted, note }),

  // Không có endpoint withdraw riêng — thu hồi offer = reject application
  // (dùng applicationAPI.reject với lý do).
};

// ==================== CRITERIA ====================

export const criteriaAPI = {
  getTemplates: () =>
    api.get('/criteria-templates'),

  getById: (templateId) =>
    api.get(`/criteria-templates/${templateId}`),

  createTemplate: (data) =>
    api.post('/criteria-templates', data),

  updateTemplate: (templateId, data) =>
    api.put(`/criteria-templates/${templateId}`, data),

  deleteTemplate: (templateId) =>
    api.delete(`/criteria-templates/${templateId}`),

  getByJob: (jobId) =>
    api.get(`/jobs/${jobId}/criteria`),

  addToJob: (jobId, data) =>
    api.post(`/jobs/${jobId}/criteria`, data),

  updateJobCriteria: (criteriaId, data) =>
    api.put(`/evaluation-criteria/${criteriaId}`, data),

  removeFromJob: (criteriaId) =>
    api.delete(`/evaluation-criteria/${criteriaId}`),

  // AI bóc tiêu chí từ JD → DRAFT (người duyệt chốt sau)
  extractFromJd: (jobId) =>
    api.post(`/jobs/${jobId}/criteria/extract`),

  // Chốt bộ tiêu chí DRAFT → ACTIVE
  approve: (jobId) =>
    api.post(`/jobs/${jobId}/criteria/approve`),


  applyTemplateToJob: (templateId, jobId) =>
    api.post(`/criteria-templates/${templateId}/apply/${jobId}`),
};

// ==================== MAIL TEMPLATES ====================

export const mailTemplateAPI = {
  getAll: () =>
    api.get('/email-templates'),

  getById: (templateId) =>
    api.get(`/email-templates/${templateId}`),

  create: (data) =>
    api.post('/email-templates', data),

  update: (templateId, data) =>
    api.put(`/email-templates/${templateId}`, data),

  delete: (templateId) =>
    api.delete(`/email-templates/${templateId}`),

  // Khung mẫu sẵn cho 1 loại — trả { subject, body }, body null nếu loại đó chưa có khung.
  getDefault: (type) =>
    api.get(`/email-templates/defaults/${type}`),

  // Tạo đủ bộ mẫu dựng sẵn cho công ty (bỏ qua loại đã có) — trả { added }.
  seedDefaults: () =>
    api.post('/email-templates/defaults'),

  // Tải ảnh dùng trong email từ máy lên -> trả { url } cố định để nhúng vào thư.
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/email-assets', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ==================== DASHBOARD ====================

export const dashboardAPI = {
  // Trả DashboardOverviewDto: { jobId, summary, funnel, rejectReasons, sources }
  getOverview: (jobId) =>
    api.get(`/dashboard/overview${jobId ? `?jobId=${jobId}` : ''}`),

  getKanban: (jobId) =>
    api.get(`/dashboard/kanban${jobId ? `?jobId=${jobId}` : ''}`),
};

// ==================== COMPANY ====================

export const companyAPI = {
  get: () =>
    api.get('/company'),

  update: (data) =>
    api.put('/company', data),

  updateBrand: (data) =>
    api.put('/company/brand', data),

  getSmtp: () =>
    api.get('/company/smtp'),

  updateSmtp: (data) =>
    api.put('/company/smtp', data),

  testSmtp: (data) =>
    api.post('/company/smtp/test', data),
};

// ==================== USERS / SUB-ACCOUNTS ====================

export const usersAPI = {
  // CRUD tài khoản — CHỈ Admin gọi được
  getAll: () =>
    api.get('/users'),

  getById: (id) =>
    api.get(`/users/${id}`),

  create: (data) =>
    api.post('/users', data),

  update: (id, data) =>
    api.put(`/users/${id}`, data),

  delete: (id) =>
    api.delete(`/users/${id}`),

  resetPassword: (userId, newPassword) =>
    api.post(`/users/${userId}/reset-password`, { newPassword }),

  // Dropdown chọn người cho Human Resource/DM (không cần quyền Admin).
  // role: 'Interviewer' | 'DepartmentManager' | ... — bỏ trống = tất cả Active
  getOptions: (role) =>
    api.get('/users/options', { params: role ? { role } : {} }),

  // Tự đổi mật khẩu của chính mình → authAPI.changePassword
};

// ==================== DEPARTMENTS (Danh mục phòng ban — V022) ====================
// Admin CRUD; mọi role đăng nhập gọi getAll để đổ dropdown (tạo Job / Yêu cầu tuyển dụng).

export const departmentAPI = {
  getAll: () =>
    api.get('/departments'),

  getById: (id) =>
    api.get(`/departments/${id}`),

  // data: { name, description?, status? ('Active' | 'Inactive') } — CHỈ Admin
  create: (data) =>
    api.post('/departments', data),

  update: (id, data) =>
    api.put(`/departments/${id}`, data),

  // Chặn 409 khi còn job dùng phòng ban → đổi status 'Inactive' thay thế
  delete: (id) =>
    api.delete(`/departments/${id}`),
};

// ============ EMPLOYMENT TYPES (Danh mục hình thức làm việc — V027) ============
// Admin CRUD; mọi role đăng nhập gọi getAll để đổ dropdown. Tin tuyển dụng và Yêu cầu
// tuyển dụng dùng CHUNG danh mục này (trước đây mỗi form một danh sách cứng).

export const employmentTypeAPI = {
  getAll: () =>
    api.get('/employment-types'),

  getById: (id) =>
    api.get(`/employment-types/${id}`),

  // data: { name, description?, status? ('Active' | 'Inactive') } — CHỈ Admin
  create: (data) =>
    api.post('/employment-types', data),

  update: (id, data) =>
    api.put(`/employment-types/${id}`, data),

  // Chặn 409 khi còn job dùng → đổi status 'Inactive' thay thế
  delete: (id) =>
    api.delete(`/employment-types/${id}`),
};

// ==================== RECRUITMENT REQUESTS (Yêu cầu tuyển dụng — 5.17) ====================
// DM "ra đề" (tùy chọn) → Human Resource duyệt → tạo Job từ yêu cầu (CONVERTED + jobId truy vết).

export const recruitmentRequestAPI = {
  // data: { title, department?, quantity, employmentType?, experienceLevel?,
  //         description?, requirements?, benefits?, salaryMin?, salaryMax?, expectedStartDate? }
  create: (data) =>
    api.post('/recruitment-requests', data),

  getAll: (status) =>
    api.get('/recruitment-requests', { params: status ? { status } : {} }),

  getById: (id) =>
    api.get(`/recruitment-requests/${id}`),

  update: (id, data) =>
    api.put(`/recruitment-requests/${id}`, data),

  // DM hủy — chỉ khi còn PENDING
  cancel: (id) =>
    api.delete(`/recruitment-requests/${id}`),

  // Human Resource duyệt: approve=false bắt buộc note
  review: (id, approve, note) =>
    api.post(`/recruitment-requests/${id}/review`, { approve, note }),

  // Human Resource gắn job đã tạo từ yêu cầu → CONVERTED
  convert: (id, jobId) =>
    api.post(`/recruitment-requests/${id}/convert`, { jobId }),
};

// ==================== PUBLIC CAREER SITE ====================

export const publicCareerAPI = {
  // Nộp CV cho một job (multipart/form-data)
  apply: (slug, jobId, formData) =>
    api.post(`/public/${slug}/jobs/${jobId}/apply`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Brand công khai (tên/logo/màu) để career site hiện đúng nhận diện của từng công ty.
  // Dùng publicApi: khách vãng lai không có token, không được để interceptor đá về /login.
  getBrand: (slug) => publicApi.get(`/public/${slug}/brand`),
};

export default api;
