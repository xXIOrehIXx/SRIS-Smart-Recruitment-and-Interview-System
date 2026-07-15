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
    return api.post('/api/account/login', { email, password });
  },

  register: (data) =>
    api.post('/api/account/register', data),

  forgotPassword: (email) =>
    api.post('/api/account/forgot-password', { email }),

  resetPassword: (token, newPassword) =>
    api.post('/api/account/reset-password', { token, newPassword }),

  refreshToken: () =>
    api.post('/api/account/refresh-token'),

  logout: () =>
    api.post('/api/account/logout'),
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
    api.get(`/api/jobs${includeInactive ? '?includeInactive=true' : ''}`),

  getById: (id) =>
    api.get(`/api/jobs/${id}`),

  create: (data) =>
    api.post('/api/jobs', data),

  update: (id, data) =>
    api.put(`/api/jobs/${id}`, data),

  delete: (id) =>
    api.delete(`/api/jobs/${id}`),

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
    const response = await api.post('/api/cv-scoring/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: onProgress,
    });
    return response;
  },

  getRanking: (jobId) =>
    api.get(`/api/cv-scoring/jobs/${jobId}/ranking`),

  getCVScore: (cvId) =>
    api.get(`/api/cv-scoring/cv/${cvId}?file-url=1`),
};

// ==================== APPLICATIONS ====================

export const applicationAPI = {
  getAll: (jobId) =>
    api.get(jobId ? `/api/jobs/${jobId}/applications` : '/api/applications'),

  getById: (id) =>
    api.get(`/api/applications/${id}`),

  transition: (id, toState) =>
    api.post(`/api/applications/${id}/transition`, { toState }),

  getHistory: (id) =>
    api.get(`/api/applications/${id}/history`),

  getNotes: (id) =>
    api.get(`/api/applications/${id}/notes`),

  addNote: (id, content) =>
    api.post(`/api/applications/${id}/notes`, { content }),

  createMagicLink: (id, purpose, expiresIn = 48) =>
    api.post(`/api/applications/${id}/magic-links?purpose=${purpose}&expiresInHours=${expiresIn}`),
};

// ==================== INTERVIEW SCHEDULING ====================

export const interviewAPI = {
  getSchedules: (applicationId) =>
    api.get(`/api/applications/${applicationId}/interview-schedules`),

  getAllSchedules: (jobId) =>
    api.get(jobId ? `/api/interview-schedules?jobId=${jobId}` : '/api/interview-schedules'),

  getInterviewPools: (jobId) =>
    api.get(`/api/jobs/${jobId}/interview-pools`),

  createSchedule: (applicationId, data) =>
    api.post(`/api/applications/${applicationId}/interview-schedules`, data),

  reschedule: (applicationId, scheduleId, newSlotId) =>
    api.put(`/api/applications/${applicationId}/interview-schedules/${scheduleId}/reschedule`, { slotId: newSlotId }),

  cancelSchedule: (applicationId, scheduleId, reason) =>
    api.post(`/api/applications/${applicationId}/interview-schedules/${scheduleId}/cancel`, { reason }),

  // Interviewer's schedules
  getMySchedules: () =>
    api.get('/api/me/interview-schedules'),

  // Grading APIs
  getMySheet: (scheduleId) =>
    api.get(`/api/interview-schedules/${scheduleId}/my-sheet`),

  updateMySheet: (scheduleId, data) =>
    api.put(`/api/interview-schedules/${scheduleId}/my-sheet`, data),

  submitMySheet: (scheduleId, data) =>
    api.post(`/api/interview-schedules/${scheduleId}/my-sheet`, data),

  getAggregate: (scheduleId) =>
    api.get(`/api/interview-schedules/${scheduleId}/aggregate`),
};

// ==================== CANDIDATE (Magic Link) ====================

export const candidateAPI = {
  getStatus: (token) =>
    api.get(`/api/candidate/status?token=${token}`),

  getSchedule: (token) =>
    api.get(`/api/candidate/schedule?token=${token}`),

  confirmSchedule: (token, slotId) =>
    api.post('/api/candidate/schedule/confirm', { token, slotId }),

  noSlotAvailable: (token) =>
    api.post('/api/candidate/schedule/no-slot', { token }),

  getOffer: (token) =>
    api.get(`/api/candidate/offer?token=${token}`),

  respondToOffer: (token, accept) =>
    api.post('/api/candidate/offer/respond', { token, accept }),
};

// ==================== OFFER ====================

export const offerAPI = {
  create: (applicationId, data) =>
    api.post(`/api/applications/${applicationId}/offer`, data),

  getByApplication: (applicationId) =>
    api.get(`/api/applications/${applicationId}/offer`),

  withdraw: (offerId) =>
    api.post(`/api/offers/${offerId}/withdraw`),
};

// ==================== CRITERIA ====================

export const criteriaAPI = {
  getTemplates: () =>
    api.get('/api/criteria-templates'),

  getById: (templateId) =>
    api.get(`/api/criteria-templates/${templateId}`),

  createTemplate: (data) =>
    api.post('/api/criteria-templates', data),

  updateTemplate: (templateId, data) =>
    api.put(`/api/criteria-templates/${templateId}`, data),

  deleteTemplate: (templateId) =>
    api.delete(`/api/criteria-templates/${templateId}`),

  getByJob: (jobId) =>
    api.get(`/api/jobs/${jobId}/criteria`),

  addToJob: (jobId, data) =>
    api.post(`/api/jobs/${jobId}/criteria`, data),

  updateJobCriteria: (criteriaId, data) =>
    api.put(`/api/evaluation-criteria/${criteriaId}`, data),

  removeFromJob: (criteriaId) =>
    api.delete(`/api/evaluation-criteria/${criteriaId}`),
};

// ==================== MAIL TEMPLATES ====================

export const mailTemplateAPI = {
  getAll: () =>
    api.get('/api/email-templates'),

  getById: (templateId) =>
    api.get(`/api/email-templates/${templateId}`),

  create: (data) =>
    api.post('/api/email-templates', data),

  update: (templateId, data) =>
    api.put(`/api/email-templates/${templateId}`, data),

  delete: (templateId) =>
    api.delete(`/api/email-templates/${templateId}`),
};

// ==================== DASHBOARD ====================

export const dashboardAPI = {
  getOverview: (jobId) =>
    api.get(`/api/dashboard/overview${jobId ? `?jobId=${jobId}` : ''}`),

  getKanban: (jobId) =>
    api.get(`/api/dashboard/kanban${jobId ? `?jobId=${jobId}` : ''}`),

  getFunnelData: (jobId) =>
    api.get(`/api/dashboard/funnel?jobId=${jobId}`),

  getSourceAnalytics: () =>
    api.get('/api/dashboard/sources'),
};

// ==================== TALENT POOL ====================

export const talentPoolAPI = {
  getSuggestions: (jobId) =>
    api.get(`/api/jobs/${jobId}/talent-pool`),

  getAll: () =>
    api.get('/api/talent-pool'),
};

// ==================== COMPANY ====================

export const companyAPI = {
  get: () =>
    api.get('/api/company'),

  update: (data) =>
    api.put('/api/company', data),

  updateBrand: (data) =>
    api.put('/api/company/brand', data),
};

// ==================== USERS / SUB-ACCOUNTS ====================

export const usersAPI = {
  getAll: () =>
    api.get('/api/users'),

  getById: (id) =>
    api.get(`/api/users/${id}`),

  create: (data) =>
    api.post('/api/users', data),

  update: (id, data) =>
    api.put(`/api/users/${id}`, data),

  delete: (id) =>
    api.delete(`/api/users/${id}`),

  changePassword: (id, oldPassword, newPassword) =>
    api.post(`/api/users/${id}/change-password`, { oldPassword, newPassword }),

  resetPassword: (userId, newPassword) =>
    api.post(`/api/users/${userId}/reset-password`, { newPassword }),
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