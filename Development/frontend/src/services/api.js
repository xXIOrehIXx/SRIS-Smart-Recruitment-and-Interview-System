import axios from 'axios';

// Cấu hình base URL - mặc định '/api' để đi qua dev proxy (setupProxy.js) hoặc
// reverse proxy khi deploy. Đặt REACT_APP_API_URL khi backend ở origin khác.
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
    if (error.response?.status === 401) {
      // Token hết hạn hoặc không hợp lệ
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
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

// ==================== CV SCORING ====================

export const cvScoringAPI = {
  uploadCV: async (formData, onProgress) => {
    const response = await api.post('/cv-scoring/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: onProgress,
    });
    return response;
  },

  getRanking: (jobId) =>
    api.get(`/cv-scoring/jobs/${jobId}/ranking`),

  // Trả { url } — presigned URL (~1h) để mở/tải file CV gốc
  getCvFileUrl: (cvId) =>
    api.get(`/cv-scoring/cv/${cvId}/file-url`),
};

// ==================== APPLICATIONS ====================

export const applicationAPI = {
  // Trả ApplicationBoardDto: { jobId, applications: [...] }
  getAll: (jobId) =>
    api.get(`/jobs/${jobId}/applications`),

  getById: (id) =>
    api.get(`/applications/${id}`),

  // reason bắt buộc khi toState = 'REJECTED'
  transition: (id, toState, reason) =>
    api.post(`/applications/${id}/transition`, { toState, reason }),

  // Loại hồ sơ — reason BẮT BUỘC (backend từ chối nếu thiếu)
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
// Recruiter mở 1 pool khung giờ cho job + vòng → mời nhiều ứng viên (mỗi người 1
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

  getOffer: (token) =>
    api.get(`/candidate/offer?token=${encodeURIComponent(token)}`),

  respondToOffer: (token, accept) =>
    api.post(`/candidate/offer/respond?token=${encodeURIComponent(token)}`, { accept }),
};

// ==================== OFFER ====================

export const offerAPI = {
  // data: { salaryAmount?, currency?, startDate?, note?, expiresInDays? }
  // Trả { offer, magicToken, ... } — magic link OFFER_RESPONSE gửi ứng viên
  create: (applicationId, data) =>
    api.post(`/applications/${applicationId}/offer`, data),

  getByApplication: (applicationId) =>
    api.get(`/applications/${applicationId}/offer`),

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

  // Kết quả chấm CV theo TỪNG tiêu chí (khớp/thiếu + câu bằng chứng)
  getCriteriaMatches: (applicationId) =>
    api.get(`/applications/${applicationId}/criteria-matches`),

  // Chấm lại điểm tiêu chí cho 1 hồ sơ
  rescoreCriteria: (applicationId) =>
    api.post(`/applications/${applicationId}/criteria-score`),

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
};

// ==================== DASHBOARD ====================

export const dashboardAPI = {
  // Trả DashboardOverviewDto: { jobId, summary, funnel, rejectReasons, sources }
  getOverview: (jobId) =>
    api.get(`/dashboard/overview${jobId ? `?jobId=${jobId}` : ''}`),

  getKanban: (jobId) =>
    api.get(`/dashboard/kanban${jobId ? `?jobId=${jobId}` : ''}`),
};

// ==================== TALENT POOL ====================

// Reverse matching: JD của job → quét kho CvDocument cũ cùng tenant.
// Chỉ có theo TỪNG job — trả { jobId, withinMonths, count, suggestions: [...] }.
export const talentPoolAPI = {
  getSuggestions: (jobId) =>
    api.get(`/jobs/${jobId}/talent-pool`),

  // Gửi email mời ứng tuyển từ backend (SMTP) — trả { sent }
  invite: (jobId, candidateEmail, candidateName) =>
    api.post(`/jobs/${jobId}/talent-pool/invite`, { candidateEmail, candidateName }),
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

  // Dropdown chọn người cho Recruiter/DM (không cần quyền Admin).
  // role: 'Interviewer' | 'DepartmentManager' | ... — bỏ trống = tất cả Active
  getOptions: (role) =>
    api.get('/users/options', { params: role ? { role } : {} }),

  // Tự đổi mật khẩu của chính mình → authAPI.changePassword
};

// ==================== RECRUITMENT REQUESTS (Yêu cầu tuyển dụng — 5.17) ====================
// DM "ra đề" (tùy chọn) → Recruiter duyệt → tạo Job từ yêu cầu (CONVERTED + jobId truy vết).

export const recruitmentRequestAPI = {
  // data: { title, department?, quantity, employmentType?, experienceLevel?, priority?,
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

  // Recruiter duyệt: approve=false bắt buộc note
  review: (id, approve, note) =>
    api.post(`/recruitment-requests/${id}/review`, { approve, note }),

  // Recruiter gắn job đã tạo từ yêu cầu → CONVERTED
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
};

export default api;
