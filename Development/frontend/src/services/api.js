import axios from 'axios';

// Cấu hình base URL - đổi thành URL thật khi deploy
const BASE_URL = process.env.REACT_APP_API_URL || '';

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
    return Promise.reject(error);
  }
);

// ==================== AUTH ====================

export const authAPI = {
  login: (email, password) => {
    console.log('authAPI.login:', { email, password }); // DEBUG
    return api.post('/account/login', { email, password });
  },

  register: (data) =>
    api.post('/account/register', data),

  forgotPassword: (email) =>
    api.post('/account/forgot-password', { email }),

  resetPassword: (token, newPassword) =>
    api.post('/account/reset-password', { token, newPassword }),

  refreshToken: () =>
    api.post('/account/refresh-token'),

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

  // Public: lấy tất cả job đang tuyển (dùng endpoint gốc /jobs)
  getPublicJobs: () =>
    publicApi.get('/jobs'),

  getPublicJob: (jobId) =>
    publicApi.get(`/jobs/${jobId}`),

  // Public: ứng tuyển job
  applyForJob: (jobId, data) =>
    publicApi.post(`/jobs/${jobId}/apply`, data),

  // Public career site với slug
  getPublicJobsBySlug: (slug) =>
    publicApi.get(`/public/${slug}/jobs`),

  getPublicJobBySlug: (slug, jobId) =>
    publicApi.get(`/public/${slug}/jobs/${jobId}`),

  applyForJobBySlug: (slug, jobId, data) =>
    publicApi.post(`/public/${slug}/jobs/${jobId}/apply`, data),
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

  getCVScore: (cvId) =>
    api.get(`/cv-scoring/cv/${cvId}?file-url=1`),

  getFileUrl: (cvId) =>
    api.get(`/cv-scoring/cv/${cvId}/file-url`),
};

// ==================== APPLICATIONS ====================

export const applicationAPI = {
  getAll: (jobId) =>
    api.get(jobId ? `/jobs/${jobId}/applications` : '/applications'),

  getById: (id) =>
    api.get(`/applications/${id}`),

  transition: (id, toState) =>
    api.post(`/applications/${id}/transition`, { toState }),

  getHistory: (id) =>
    api.get(`/applications/${id}/history`),

  getNotes: (id) =>
    api.get(`/applications/${id}/notes`),

  addNote: (id, content) =>
    api.post(`/applications/${id}/notes`, { content }),

  createMagicLink: (id, purpose, expiresIn = 48) =>
    api.post(`/applications/${id}/magic-links?purpose=${purpose}&expiresInHours=${expiresIn}`),
};

// ==================== INTERVIEW SCHEDULING ====================

export const interviewAPI = {
  getSchedules: (applicationId) =>
    api.get(`/applications/${applicationId}/interview-schedules`),

  getAllSchedules: (jobId) =>
    api.get(jobId ? `/interview-schedules?jobId=${jobId}` : '/interview-schedules'),

  getInterviewPools: (jobId) =>
    api.get(`/jobs/${jobId}/interview-pools`),

  // Alias rõ ràng hơn — Pool theo job (Section 15 flow)
  getPoolsByJob: (jobId) =>
    api.get(`/jobs/${jobId}/interview-pools`),

  createPool: (jobId, data) =>
    api.post(`/jobs/${jobId}/interview-pools`, data),

  inviteToPool: (poolId, data) =>
    api.post(`/interview-pools/${poolId}/invitations`, data),

  cancelPool: (poolId, data) =>
    api.post(`/interview-pools/${poolId}/cancel`, data),

  // Chốt lịch TAY qua nhánh gọi điện (recruiter không cần pool/magic link)
  manualConfirm: (applicationId, data) =>
    api.post(`/applications/${applicationId}/manual-interview`, data),

  // Lấy danh sách interviewer (user có role chứa "Interviewer") để Recruiter chọn khi tạo pool
  getInterviewers: () =>
    api.get('/interview-pools/interviewers'),

  createSchedule: (applicationId, data) =>
    api.post(`/applications/${applicationId}/interview-schedules`, data),

  reschedule: (applicationId, scheduleId, newSlotId) =>
    api.put(`/applications/${applicationId}/interview-schedules/${scheduleId}/reschedule`, { slotId: newSlotId }),

  cancelSchedule: (applicationId, scheduleId, reason) =>
    api.post(`/applications/${applicationId}/interview-schedules/${scheduleId}/cancel`, { reason }),

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

export const candidateAPI = {
  getStatus: (token) =>
    api.get(`/candidate/status?token=${token}`),

  getSchedule: (token) =>
    api.get(`/candidate/schedule?token=${token}`),

  confirmSchedule: (token, slotId) =>
    api.post('/candidate/schedule/confirm', { token, slotId }),

  noSlotAvailable: (token) =>
    api.post('/candidate/schedule/no-slot', { token }),

  getOffer: (token) =>
    api.get(`/candidate/offer?token=${token}`),

  respondToOffer: (token, accept) =>
    api.post('/candidate/offer/respond', { token, accept }),
};

// ==================== OFFER ====================

export const offerAPI = {
  create: (applicationId, data) =>
    api.post(`/applications/${applicationId}/offer`, data),

  getByApplication: (applicationId) =>
    api.get(`/applications/${applicationId}/offer`),

  withdraw: (offerId) =>
    api.post(`/offers/${offerId}/withdraw`),
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
  getOverview: (jobId) =>
    api.get(`/dashboard/overview${jobId ? `?jobId=${jobId}` : ''}`),

  getKanban: (jobId) =>
    api.get(`/dashboard/kanban${jobId ? `?jobId=${jobId}` : ''}`),

  getFunnelData: (jobId) =>
    api.get(`/dashboard/funnel?jobId=${jobId}`),

  getSourceAnalytics: () =>
    api.get('/dashboard/sources'),
};

// ==================== TALENT POOL ====================

export const talentPoolAPI = {
  getSuggestions: (jobId) =>
    api.get(`/jobs/${jobId}/talent-pool`),

  getAll: () =>
    api.get('/talent-pool'),
};

// ==================== COMPANY ====================

export const companyAPI = {
  get: () =>
    api.get('/company'),

  update: (data) =>
    api.put('/company', data),

  updateBrand: (data) =>
    api.put('/company/brand', data),
};

// ==================== USERS / SUB-ACCOUNTS ====================

export const usersAPI = {
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

  changePassword: (id, oldPassword, newPassword) =>
    api.post(`/users/${id}/change-password`, { oldPassword, newPassword }),

  resetPassword: (userId, newPassword) =>
    api.post(`/users/${userId}/reset-password`, { newPassword }),
};

// ==================== PUBLIC CAREER SITE ====================

export const publicCareerAPI = {
  // Nộp CV cho một job (multipart/form-data)
  // Timeout cao hơn vì backend cần: upload MinIO + bóc text PDF + gọi AI embed
  apply: (slug, jobId, formData) =>
    publicApi.post(`/public/${slug}/jobs/${jobId}/apply`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 120s — đủ cho lần đầu Ollama load model
    }),
};

export default api;
