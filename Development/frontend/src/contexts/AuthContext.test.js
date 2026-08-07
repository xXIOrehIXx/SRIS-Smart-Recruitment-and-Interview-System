/**
 * Test phân quyền route theo role (hasPermission) + hằng số role/route.
 * 4 role đăng nhập, gán chồng được; Candidate không có account (magic link only).
 */
import { ROLES, ROLE_ROUTES, hasPermission } from './AuthContext';

describe('ROLES / ROLE_ROUTES', () => {
  test('đủ 4 role đăng nhập portal', () => {
    expect(ROLES.ADMIN).toBe('Admin');
    expect(ROLES.HUMAN_RESOURCE).toBe('Recruiter');
    expect(ROLES.INTERVIEWER).toBe('Interviewer');
    expect(ROLES.DEPARTMENT_MANAGER).toBe('DepartmentManager');
  });

  test('mỗi role có landing route riêng sau login (interviewer -> /interviewer/incoming)', () => {
    expect(ROLE_ROUTES[ROLES.ADMIN]).toBe('/admin/dashboard');
    expect(ROLE_ROUTES[ROLES.HUMAN_RESOURCE]).toBe('/human-resource/dashboard');
    expect(ROLE_ROUTES[ROLES.INTERVIEWER]).toBe('/interviewer/incoming');
    expect(ROLE_ROUTES[ROLES.DEPARTMENT_MANAGER]).toBe('/dept/dashboard');
  });
});

describe('hasPermission', () => {
  test('Recruiter vào được các trang vận hành pipeline', () => {
    expect(hasPermission('Recruiter', '/human-resource/jobs')).toBe(true);
    expect(hasPermission('Recruiter', '/interviews/schedule')).toBe(true);
    expect(hasPermission('Recruiter', '/criteria')).toBe(true);
    expect(hasPermission('Recruiter', '/offers')).toBe(true);
    expect(hasPermission('Recruiter', '/talent-pool')).toBe(true);
  });

  test('Interviewer KHÔNG vào được trang recruiter (chỉ chấm, không lái)', () => {
    expect(hasPermission('Interviewer', '/human-resource/jobs')).toBe(false);
    expect(hasPermission('Interviewer', '/offers')).toBe(false);
    expect(hasPermission('Interviewer', '/interviewer/grading/1')).toBe(true);
  });

  test('DM vào /dept, không vào trang recruiter', () => {
    expect(hasPermission('DepartmentManager', '/dept/hiring-decision')).toBe(true);
    expect(hasPermission('DepartmentManager', '/human-resource/jobs')).toBe(false);
  });

  test('role viết thường vẫn được normalize', () => {
    expect(hasPermission('recruiter', '/human-resource/jobs')).toBe(true);
    expect(hasPermission('departmentmanager', '/dept/requests')).toBe(true);
  });

  test('ai cũng vào được /settings; không role thì chặn hết', () => {
    expect(hasPermission('Interviewer', '/settings')).toBe(true);
    expect(hasPermission(null, '/settings')).toBe(false);
    expect(hasPermission(undefined, '/human-resource/jobs')).toBe(false);
  });
});
