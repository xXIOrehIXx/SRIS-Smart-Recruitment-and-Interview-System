import { vi } from 'vitest';
/**
 * Contract test cho services/api.js — chốt URL/payload khớp backend thật.
 * Đây chính là lớp lỗi đã từng làm gãy app (mất prefix /api, token trong body
 * thay vì query, key `scores` thay vì `items`...) — test giữ không tái phát.
 */
vi.mock('axios', () => {
  const instances = [];
  const makeInstance = () => ({
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  });
  const axiosMock = {
    create: vi.fn((config) => {
      const instance = makeInstance();
      instance.__config = config;
      instances.push(instance);
      return instance;
    }),
    __instances: instances,
  };
  return { __esModule: true, default: axiosMock };
});

import axios from 'axios';
import {
  authAPI, jobsAPI, cvAPI, applicationAPI, interviewAPI, candidateAPI,
  offerAPI, criteriaAPI, dashboardAPI, usersAPI, recruitmentRequestAPI,
  hiringProposalAPI,
} from './api';

// api.js tạo 2 instance: [0] = api (có token), [1] = publicApi (career site ẩn danh)
const apiInst = axios.__instances[0];
const publicInst = axios.__instances[1];

beforeEach(() => vi.clearAllMocks());

describe('cấu hình axios', () => {
  test('baseURL mặc định là /api (đi qua dev proxy / reverse proxy)', () => {
    expect(apiInst.__config.baseURL).toBe('/api');
    expect(publicInst.__config.baseURL).toBe('/api');
  });
});

describe('authAPI', () => {
  test('login đúng endpoint + body', () => {
    authAPI.login('a@b.com', 'secret');
    expect(apiInst.post).toHaveBeenCalledWith('/account/login', { email: 'a@b.com', password: 'secret' });
  });

  test('changePassword là self-service /account/change-password (không phải /users/{id})', () => {
    authAPI.changePassword('old', 'new');
    expect(apiInst.post).toHaveBeenCalledWith('/account/change-password', { oldPassword: 'old', newPassword: 'new' });
  });

  test('refreshToken gửi refreshToken trong body', () => {
    authAPI.refreshToken('rt-123');
    expect(apiInst.post).toHaveBeenCalledWith('/account/refresh-token', { refreshToken: 'rt-123' });
  });

  // Trước đây màn Settings gọi PUT /users/{id} (chỉ Admin) -> mọi role khác 403,
  // và thiếu role/status trong body nên Admin cũng 400. Self-service phải là /account/me.
  test('updateProfile là self-service PUT /account/me (không phải /users/{id})', () => {
    authAPI.updateProfile({ fullName: 'Khánh', phone: '0912345678' });
    expect(apiInst.put).toHaveBeenCalledWith('/account/me', { fullName: 'Khánh', phone: '0912345678' });
  });
});

describe('candidateAPI — token LUÔN qua query string (backend đọc [FromQuery])', () => {
  test('getStatus: token ở query (được encode)', () => {
    candidateAPI.getStatus('6.tok+en');
    expect(apiInst.get).toHaveBeenCalledWith(
      `/candidate/status?token=${encodeURIComponent('6.tok+en')}`,
    );
  });

  // 5.15: ứng viên không còn bấm đồng ý/từ chối — chỉ mở/tải PDF thư mời.
  // URL này gắn thẳng vào <object>/thẻ tải nên phải kèm BASE_URL, không đi qua axios.
  test('offerLetterUrl: URL tuyệt đối theo BASE_URL, token được encode', () => {
    expect(candidateAPI.offerLetterUrl('6.tok+en'))
      .toBe(`/api/candidate/offer/letter?token=${encodeURIComponent('6.tok+en')}`);
  });

  // 15/08/2026: ứng viên KHÔNG tự chọn khung nữa — nhân sự gọi điện chốt giờ rồi nhập buổi.
  test('API ứng viên tự chọn khung đã bị gỡ', () => {
    expect(candidateAPI.getSchedule).toBeUndefined();
    expect(candidateAPI.confirmSchedule).toBeUndefined();
    expect(candidateAPI.noSlotAvailable).toBeUndefined();
  });
});

describe('applicationAPI', () => {
  test('reject dùng endpoint riêng, gửi kèm reason nếu có', () => {
    applicationAPI.reject(9, 'Không đạt yêu cầu');
    expect(apiInst.post).toHaveBeenCalledWith('/applications/9/reject', { reason: 'Không đạt yêu cầu' });
  });

  test('getAll theo job (board — không có GET /applications toàn cục)', () => {
    applicationAPI.getAll(3);
    expect(apiInst.get).toHaveBeenCalledWith('/jobs/3/applications');
  });

  test('transition kèm reason (cần khi toState=REJECTED)', () => {
    applicationAPI.transition(9, 'SCREENING');
    expect(apiInst.post).toHaveBeenCalledWith('/applications/9/transition', { toState: 'SCREENING', reason: undefined });
  });

  // V045: duyệt vào phỏng vấn = một quyết định gồm CẢ "cho vào vòng" lẫn "cho gặp ai".
  // Gửi 2 request riêng thì hồ sơ có thể sang INTERVIEW mà không ai được chỉ định.
  test('transition sang INTERVIEW gửi kèm interviewerIds do Trưởng bộ phận chỉ định', () => {
    applicationAPI.transition(9, 'INTERVIEW', undefined, [4, 7]);
    expect(apiInst.post).toHaveBeenCalledWith(
      '/applications/9/transition',
      { toState: 'INTERVIEW', reason: undefined, interviewerIds: [4, 7] },
    );
  });
});

describe('interviewAPI — người phỏng vấn do Trưởng bộ phận chỉ định (V045)', () => {
  test('getAssignedInterviewers đọc nhóm được chỉ định cho 1 ứng viên', () => {
    interviewAPI.getAssignedInterviewers(9);
    expect(apiInst.get).toHaveBeenCalledWith('/applications/9/interviewers');
  });

  test('assignInterviewers ghi đè cả danh sách (PUT, không POST từng người)', () => {
    interviewAPI.assignInterviewers(9, [4, 7]);
    expect(apiInst.put).toHaveBeenCalledWith('/applications/9/interviewers', { interviewerIds: [4, 7] });
  });
});

describe('offerAPI — thư mời nhận việc (5.15)', () => {
  test('getDefaults lấy giá trị điền sẵn cho form soạn thư', () => {
    offerAPI.getDefaults(9);
    expect(apiInst.get).toHaveBeenCalledWith('/applications/9/offer/defaults');
  });

  // KHÔNG có getLetterBlob: thư mời PDF đi qua URL trực tiếp (offerAPI.offerLetterUrl) cho
  // trang ứng viên, không tải bằng axios. Endpoint `/applications/{id}/offer/letter` cũng không
  // tồn tại phía backend. Bài test cũ gọi một hàm chưa từng có nên đỏ từ lúc viết — bỏ hẳn thay
  // vì dựng ngược một API cho vừa cái test.

  test('recordOutcome: Human Resource chốt kết quả ứng viên trả lời ngoài hệ thống', () => {
    offerAPI.recordOutcome(9, false, 'Nhận offer công ty khác');
    expect(apiInst.post).toHaveBeenCalledWith(
      '/applications/9/offer/outcome',
      { accepted: false, note: 'Nhận offer công ty khác' },
    );
  });
});

describe('interviewAPI — nhân sự đặt lịch trực tiếp (pool khung đã bỏ 15/08/2026)', () => {
  test('bookInterview đúng endpoint + shape BookInterviewDto', () => {
    const data = { interviewerIds: [13, 14], startTime: '2026-07-25T09:00:00', name: 'Chuyên môn' };
    interviewAPI.bookInterview(100, data);
    expect(apiInst.post).toHaveBeenCalledWith('/applications/100/interviews', data);
  });

  test('getJobInterviews lấy buổi theo vị trí', () => {
    interviewAPI.getJobInterviews(3);
    expect(apiInst.get).toHaveBeenCalledWith('/jobs/3/interviews');
  });

  test('cancelInterview gửi { reason } theo scheduleId', () => {
    interviewAPI.cancelInterview(7, 'Sếp đi công tác');
    expect(apiInst.post).toHaveBeenCalledWith('/interview-schedules/7/cancel', { reason: 'Sếp đi công tác' });
  });

  test('submitMySheet KHÔNG có body (backend kiểm draft đã lưu server)', () => {
    interviewAPI.submitMySheet(7);
    expect(apiInst.post).toHaveBeenCalledWith('/interview-schedules/7/my-sheet/submit');
  });

  test('API pool khung đã bị gỡ', () => {
    expect(interviewAPI.createPool).toBeUndefined();
    expect(interviewAPI.invite).toBeUndefined();
    expect(interviewAPI.cancelPool).toBeUndefined();
    expect(interviewAPI.getInterviewPools).toBeUndefined();
    expect(interviewAPI.manualConfirm).toBeUndefined();
  });
});

// Đề xuất tuyển (V043): DM đề xuất -> Giám đốc quyết. Duyệt đề xuất là đường DUY NHẤT
// đẩy hồ sơ sang bước Quyết định trong luồng bình thường.
describe('hiringProposalAPI', () => {
  test('create gắn theo applicationId', () => {
    const data = { note: 'Tay nghề chắc', proposedSalary: 15000000 };
    hiringProposalAPI.create(100, data);
    expect(apiInst.post).toHaveBeenCalledWith('/applications/100/hiring-proposal', data);
  });

  test('getList lọc theo status khi có tham số', () => {
    hiringProposalAPI.getList('PENDING');
    expect(apiInst.get).toHaveBeenCalledWith('/hiring-proposals?status=PENDING');
  });

  test('getList không tham số thì lấy tất cả', () => {
    hiringProposalAPI.getList();
    expect(apiInst.get).toHaveBeenCalledWith('/hiring-proposals');
  });

  test('decide gửi quyết định + điều khoản chốt', () => {
    const data = { approve: true, note: 'OK', approvedSalary: 14000000, approvedStartDate: null };
    hiringProposalAPI.decide(77, data);
    expect(apiInst.post).toHaveBeenCalledWith('/hiring-proposals/77/decision', data);
  });
});

describe('các endpoint đã xóa vì backend không có', () => {
  test('offerAPI.withdraw không tồn tại (thu hồi = reject application)', () => {
    expect(offerAPI.withdraw).toBeUndefined();
  });

  test('dashboardAPI chỉ còn overview + kanban', () => {
    expect(dashboardAPI.getFunnelData).toBeUndefined();
    expect(dashboardAPI.getSourceAnalytics).toBeUndefined();
  });

  test('không còn API chấm điểm/xếp hạng CV', () => {
    expect(cvAPI.getRanking).toBeUndefined();
    expect(criteriaAPI.getCriteriaMatches).toBeUndefined();
    expect(criteriaAPI.rescoreCriteria).toBeUndefined();
  });
});

describe('đường dẫn từng bị sai', () => {
  test('cv file url là /cvs/{id}/file-url', () => {
    cvAPI.getCvFileUrl(12);
    expect(apiInst.get).toHaveBeenCalledWith('/cvs/12/file-url');
  });

  test('jobs?includeInactive=true khi xem cả job đã đóng', () => {
    jobsAPI.getAll(true);
    expect(apiInst.get).toHaveBeenCalledWith('/jobs?includeInactive=true');
  });

  test('users/options cho dropdown (Human Resource/DM gọi được, khác /users chỉ Admin)', () => {
    usersAPI.getOptions('Interviewer');
    expect(apiInst.get).toHaveBeenCalledWith('/users/options', { params: { role: 'Interviewer' } });
  });

  test('career site công khai đi qua publicApi (không đính token)', () => {
    jobsAPI.getPublicJobsBySlug('acme');
    expect(publicInst.get).toHaveBeenCalledWith('/public/acme/jobs');
    expect(apiInst.get).not.toHaveBeenCalled();
  });
});

describe('recruitmentRequestAPI (5.17)', () => {
  test('review gửi { approve, note }', () => {
    recruitmentRequestAPI.review(1, false, 'Chưa cần vị trí này');
    expect(apiInst.post).toHaveBeenCalledWith('/recruitment-requests/1/review', { approve: false, note: 'Chưa cần vị trí này' });
  });

  test('convert gắn jobId để truy vết', () => {
    recruitmentRequestAPI.convert(1, 17);
    expect(apiInst.post).toHaveBeenCalledWith('/recruitment-requests/1/convert', { jobId: 17 });
  });

  test('update PUT thẳng vào yêu cầu (DM sửa đề bài khi còn PENDING)', () => {
    recruitmentRequestAPI.update(5, { title: 'Kế toán tổng hợp', quantity: 2 });
    expect(apiInst.put).toHaveBeenCalledWith('/recruitment-requests/5', { title: 'Kế toán tổng hợp', quantity: 2 });
  });

  test('criteriaAPI có luồng AI extract/approve', () => {
    criteriaAPI.extractFromJd(3);
    expect(apiInst.post).toHaveBeenCalledWith('/jobs/3/criteria/extract');
    criteriaAPI.approve(3);
    expect(apiInst.post).toHaveBeenCalledWith('/jobs/3/criteria/approve');
  });

  test('criteriaAPI hỏi được trạng thái lượt bóc chạy nền', () => {
    criteriaAPI.extractStatus(3);
    expect(apiInst.get).toHaveBeenCalledWith('/jobs/3/criteria/extract-status');
  });
});
