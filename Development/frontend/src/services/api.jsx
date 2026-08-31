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
  ['/offer', '/status', '/candidate/offer-response',
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

// Nhận CV vào hệ thống + phân tích CV theo JD bằng AI.
// Bản phân tích là THAM KHẢO: backend không đổi trạng thái hồ sơ theo nó, không xếp hạng
// ứng viên với nhau. Quyết định vẫn là của người tuyển dụng.
export const cvAPI = {
  // Đọc thử CV để ĐIỀN SẴN form nộp hộ (V047): trả { candidateName, candidateEmail,
  // candidatePhone, hasText }. Không lưu gì ở backend — người dùng vẫn sửa rồi mới bấm nộp.
  parseCvPreview: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/cvs/parse-preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

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

  // XẾP HÀNG lượt AI đối chiếu CV với JD → trả 202 ngay, worker nền mới gọi AI.
  // Local LLM chạy CPU mất hàng chục giây nên không đợi trong request (timeout axios 30s).
  // Bấm lại = chạy lượt mới đè lên kết quả cũ.
  requestScreening: (applicationId) =>
    api.post(`/applications/${applicationId}/cv-screening`),

  // Hỏi trạng thái + kết quả — gọi lặp cho tới khi running=false.
  // status: NONE (chưa phân tích bao giờ) | PENDING | RUNNING | DONE | FAILED
  getScreening: (applicationId) =>
    api.get(`/applications/${applicationId}/cv-screening`),

  // XẾP HÀNG sàng lọc cho MỌI hồ sơ đang ở vòng sàng lọc của 1 vị trí (V046) — cần cho việc
  // xếp ứng viên theo mức phù hợp: không chấm cả danh sách thì không xếp hạng được.
  // rescreen=true: chấm lại cả hồ sơ đã có kết quả (dùng sau khi sửa tin tuyển dụng).
  // Trả { jobId, queued, skippedDone, skippedRunning, totalCandidates }.
  requestJobScreening: (jobId, rescreen = false) =>
    api.post(`/jobs/${jobId}/cv-screening${rescreen ? '?rescreen=true' : ''}`),
};

// ==================== APPLICATIONS ====================

export const applicationAPI = {
  // Trả ApplicationBoardDto: { jobId, sort, applications: [...] }.
  // Mỗi card kèm screeningStatus / fitScore / screeningDecision (V046).
  // sort='fit' -> hồ sơ AI thấy phù hợp nhất lên đầu, hồ sơ chưa phân tích xuống cuối.
  // Bỏ trống -> 'recent' (mới nộp trước), giữ nguyên hành vi cũ cho các màn khác.
  getAll: (jobId, sort) =>
    api.get(`/jobs/${jobId}/applications${sort ? `?sort=${sort}` : ''}`),

  getById: (id) =>
    api.get(`/applications/${id}`),

  // Tải danh sách ứng viên của 1 vị trí dạng Excel (V047). responseType 'blob' là bắt buộc:
  // để mặc định thì axios cố parse file nhị phân thành chuỗi và file tải về sẽ hỏng.
  exportByJob: (jobId) =>
    api.get(`/jobs/${jobId}/applications/export`, { responseType: 'blob' }),

  // reason tùy chọn (kể cả khi toState = 'REJECTED').
  // interviewerIds: CHỈ dùng khi toState = 'INTERVIEW' — người Trưởng bộ phận cho gặp ứng viên
  // (V045). Duyệt vào phỏng vấn và chỉ định người phỏng vấn là MỘT quyết định, gửi trong 1 lần.
  transition: (id, toState, reason, interviewerIds) =>
    api.post(`/applications/${id}/transition`, { toState, reason, interviewerIds }),

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

// Đặt lịch phỏng vấn (docs Section 15 — viết lại 15/08/2026): bộ phận nhân sự gọi cho người
// phỏng vấn hỏi lịch rảnh, gọi ứng viên chốt giờ, rồi NHẬP buổi vào hệ thống. Pool khung dùng
// chung + magic link SCHEDULE (ứng viên tự chọn khung) đã bỏ hẳn — chờ ứng viên bấm link chậm
// hơn một cuộc gọi.
export const interviewAPI = {
  // Mọi buổi phỏng vấn của 1 vị trí (kèm ứng viên + panel + giờ)
  getJobInterviews: (jobId) =>
    api.get(`/jobs/${jobId}/interviews`),

  // Đặt 1 buổi: { interviewerIds: [1..5 nguoi], startTime, roundNumber?, name? } → { scheduleId }
  bookInterview: (applicationId, data) =>
    api.post(`/applications/${applicationId}/interviews`, data),

  // Sửa buổi ĐÃ chốt: { interviewerIds, startTime, name? }. Giữ nguyên scheduleId nên phiếu
  // chấm đã có không mất; BE gửi lại email xác nhận kèm .ics giờ mới.
  updateInterview: (scheduleId, data) =>
    api.put(`/interview-schedules/${scheduleId}`, data),

  cancelInterview: (scheduleId, reason) =>
    api.post(`/interview-schedules/${scheduleId}/cancel`, { reason }),

  // Dropdown người phỏng vấn (user role Interviewer, đang Active)
  getInterviewers: () =>
    api.get('/interviews/interviewers'),

  // Lịch bận của những người phỏng vấn đang chọn (V047) — nhân sự nhìn giờ đã kín TRƯỚC khi
  // gọi điện hẹn. `from`/`to` gửi dạng giờ ĐỊA PHƯƠNG không có 'Z', giống lúc đặt buổi.
  getInterviewerBusy: (interviewerIds, from, to) =>
    api.get('/interviews/interviewer-busy', {
      params: { interviewerIds: (interviewerIds || []).join(','), from, to },
    }),

  // Người phỏng vấn Trưởng bộ phận CHỈ ĐỊNH cho 1 ứng viên (V045) — [] nghĩa là chưa chỉ định,
  // nhân sự chưa đặt lịch được. Nhân sự đọc để đổ dropdown; họ chốt giờ, DM chốt người.
  getAssignedInterviewers: (applicationId) =>
    api.get(`/applications/${applicationId}/interviewers`),

  // DM ghi đè danh sách chỉ định (đổi người cho vòng sau, người cũ nghỉ việc...).
  // Mảng rỗng = gỡ chỉ định.
  assignInterviewers: (applicationId, interviewerIds) =>
    api.put(`/applications/${applicationId}/interviewers`, { interviewerIds }),

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

  // AI tổng hợp ý kiến hội đồng phỏng vấn (V047). POST chỉ XẾP HÀNG (202) — FE hỏi lại
  // getPanelSummary tới khi running=false, giống hệt khuôn của sàng lọc CV.
  requestPanelSummary: (applicationId) =>
    api.post(`/applications/${applicationId}/panel-summary`),

  getPanelSummary: (applicationId) =>
    api.get(`/applications/${applicationId}/panel-summary`),
};

// ==================== ĐỀ XUẤT TUYỂN (DM đề xuất → Giám đốc quyết) ====================

// docs 5.14 (V043): Trưởng bộ phận KHÔNG đủ thẩm quyền tuyển — họ đề xuất "nên tuyển người
// này" KÈM MỨC LƯƠNG; Giám đốc duyệt đúng mức đó hoặc trả phiếu về để DM sửa (V053).
// Duyệt đề xuất chính là hành động đẩy hồ sơ sang bước Quyết định (OFFER).
// Ngày vào làm KHÔNG nằm ở đây (24/08/2026): nhân sự gọi ứng viên chốt ngày onboard rồi điền
// vào thư mời (offerAPI.create -> startDate).
export const hiringProposalAPI = {
  // DM đề xuất: { note?, proposedSalary } — mức lương BẮT BUỘC (V053)
  create: (applicationId, data) =>
    api.post(`/applications/${applicationId}/hiring-proposal`, data),

  // Lịch sử đề xuất của 1 hồ sơ (gồm cả lần bị từ chối)
  getByApplication: (applicationId) =>
    api.get(`/applications/${applicationId}/hiring-proposals`),

  // Hàng đợi: ?status=PENDING | APPROVED | REJECTED (bỏ trống = tất cả)
  getList: (status) =>
    api.get(`/hiring-proposals${status ? `?status=${status}` : ''}`),

  // Giám đốc quyết: { approve, note? } — note BẮT BUỘC khi approve=false (V053).
  // Không còn approvedSalary: duyệt = gật đầu đúng mức trên phiếu; muốn mức khác thì trả phiếu
  // về kèm ghi chú, DM sửa proposedSalary rồi gửi lại.
  decide: (proposalId, data) =>
    api.post(`/hiring-proposals/${proposalId}/decision`, data),
};

// ==================== CANDIDATE (Magic Link) ====================

// Token luôn đi qua QUERY STRING (?token=) — backend đọc [FromQuery] ở mọi endpoint,
// body chỉ chứa dữ liệu nghiệp vụ (slotId / accept).
export const candidateAPI = {
  getStatus: (token) =>
    api.get(`/candidate/status?token=${encodeURIComponent(token)}`),

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
  // điền mặc định. BE gửi luôn email mà thân thư CHÍNH LÀ lá thư mời.
  create: (applicationId, data) =>
    api.post(`/applications/${applicationId}/offer`, data),

  getByApplication: (applicationId) =>
    api.get(`/applications/${applicationId}/offer`),

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

  // XẾP HÀNG lượt AI bóc tiêu chí từ JD → trả 202 ngay, worker nền mới gọi AI.
  // Local LLM chạy CPU mất hàng chục giây nên không đợi trong request (timeout axios 30s).
  extractFromJd: (jobId) =>
    api.post(`/jobs/${jobId}/criteria/extract`),

  // Hỏi trạng thái lượt bóc — gọi lặp cho tới khi running=false.
  extractStatus: (jobId) =>
    api.get(`/jobs/${jobId}/criteria/extract-status`),

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

export const chatAiAPI = {
  getModels: () => api.get('/chat-ai/models'),
  chat: (model, message) => api.post('/chat-ai/chat', { model, message }),
};

export default api;
