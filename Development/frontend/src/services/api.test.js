/**
 * Contract test cho services/api.js — chốt URL/payload khớp backend thật.
 * Đây chính là lớp lỗi đã từng làm gãy app (mất prefix /api, token trong body
 * thay vì query, key `scores` thay vì `items`...) — test giữ không tái phát.
 */
jest.mock('axios', () => {
  const instances = [];
  const makeInstance = () => ({
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  });
  const axiosMock = {
    create: jest.fn((config) => {
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
  authAPI, jobsAPI, cvScoringAPI, applicationAPI, interviewAPI, candidateAPI,
  offerAPI, criteriaAPI, dashboardAPI, talentPoolAPI, usersAPI, recruitmentRequestAPI,
} from './api';

// api.js tạo 2 instance: [0] = api (có token), [1] = publicApi (career site ẩn danh)
const apiInst = axios.__instances[0];
const publicInst = axios.__instances[1];

beforeEach(() => jest.clearAllMocks());

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
});

describe('candidateAPI — token LUÔN qua query string (backend đọc [FromQuery])', () => {
  test('confirmSchedule: token ở query (được encode), body chỉ có slotId', () => {
    candidateAPI.confirmSchedule('6.tok+en', 5);
    expect(apiInst.post).toHaveBeenCalledWith(
      `/candidate/schedule/confirm?token=${encodeURIComponent('6.tok+en')}`,
      { slotId: 5 },
    );
  });

  test('respondToOffer: token ở query, body chỉ có accept', () => {
    candidateAPI.respondToOffer('6.abc', true);
    expect(apiInst.post).toHaveBeenCalledWith('/candidate/offer/respond?token=6.abc', { accept: true });
  });

  test('noSlotAvailable: token ở query, không body', () => {
    candidateAPI.noSlotAvailable('6.abc');
    expect(apiInst.post).toHaveBeenCalledWith('/candidate/schedule/no-slot?token=6.abc');
  });
});

describe('applicationAPI', () => {
  test('reject dùng endpoint riêng với reason bắt buộc', () => {
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
});

describe('interviewAPI — model slot POOL (không còn API lịch 1-1 cũ)', () => {
  test('createPool đúng endpoint + shape CreatePoolDto', () => {
    const data = { roundNumber: 1, slots: [{ interviewerId: 13, startTime: '2026-07-25T09:00:00Z' }] };
    interviewAPI.createPool(3, data);
    expect(apiInst.post).toHaveBeenCalledWith('/jobs/3/interview-pools', data);
  });

  test('invite gửi { applicationIds }', () => {
    interviewAPI.invite(4, [100, 101]);
    expect(apiInst.post).toHaveBeenCalledWith('/interview-pools/4/invitations', { applicationIds: [100, 101] });
  });

  test('submitMySheet KHÔNG có body (backend kiểm draft đã lưu server)', () => {
    interviewAPI.submitMySheet(7);
    expect(apiInst.post).toHaveBeenCalledWith('/interview-schedules/7/my-sheet/submit');
  });

  test('API lịch 1-1 cũ đã bị gỡ', () => {
    expect(interviewAPI.createSchedule).toBeUndefined();
    expect(interviewAPI.reschedule).toBeUndefined();
    expect(interviewAPI.cancelSchedule).toBeUndefined();
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

  test('talentPoolAPI chỉ có theo từng job', () => {
    expect(talentPoolAPI.getAll).toBeUndefined();
    talentPoolAPI.getSuggestions(3);
    expect(apiInst.get).toHaveBeenCalledWith('/jobs/3/talent-pool');
  });
});

describe('đường dẫn từng bị sai', () => {
  test('cv file url là /cv-scoring/cv/{id}/file-url', () => {
    cvScoringAPI.getCvFileUrl(12);
    expect(apiInst.get).toHaveBeenCalledWith('/cv-scoring/cv/12/file-url');
  });

  test('jobs?includeInactive=true khi xem cả job đã đóng', () => {
    jobsAPI.getAll(true);
    expect(apiInst.get).toHaveBeenCalledWith('/jobs?includeInactive=true');
  });

  test('users/options cho dropdown (Recruiter/DM gọi được, khác /users chỉ Admin)', () => {
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

  test('criteriaAPI có luồng AI extract/approve', () => {
    criteriaAPI.extractFromJd(3);
    expect(apiInst.post).toHaveBeenCalledWith('/jobs/3/criteria/extract');
    criteriaAPI.approve(3);
    expect(apiInst.post).toHaveBeenCalledWith('/jobs/3/criteria/approve');
  });
});
