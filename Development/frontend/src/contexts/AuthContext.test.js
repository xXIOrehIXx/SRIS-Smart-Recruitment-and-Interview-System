/**
 * Test phân quyền route theo role (hasPermission) + hằng số role/route.
 * 4 role đăng nhập, gán chồng được; Candidate không có account (magic link only).
 */
import { ROLES, ROLE_ROUTES, hasPermission } from './AuthContext';

describe('ROLES / ROLE_ROUTES', () => {
  test('đủ 4 role đăng nhập portal', () => {
    expect(ROLES.ADMIN).toBe('Admin');
    expect(ROLES.RECRUITER).toBe('Recruiter');
    expect(ROLES.INTERVIEWER).toBe('Interviewer');
    expect(ROLES.DEPARTMENT_MANAGER).toBe('DepartmentManager');
  });

  test('mỗi role có dashboard riêng sau login', () => {
    expect(ROLE_ROUTES[ROLES.ADMIN]).toBe('/admin/dashboard');
    expect(ROLE_ROUTES[ROLES.RECRUITER]).toBe('/recruiter/dashboard');
    expect(ROLE_ROUTES[ROLES.INTERVIEWER]).toBe('/interviewer/dashboard');
    expect(ROLE_ROUTES[ROLES.DEPARTMENT_MANAGER]).toBe('/dept/dashboard');
  });
});

describe('hasPermission', () => {
  test('Recruiter vào được các trang vận hành pipeline', () => {
    expect(hasPermission('Recruiter', '/recruiter/jobs')).toBe(true);
    expect(hasPermission('Recruiter', '/interviews/schedule')).toBe(true);
    expect(hasPermission('Recruiter', '/criteria')).toBe(true);
    expect(hasPermission('Recruiter', '/offers')).toBe(true);
    expect(hasPermission('Recruiter', '/talent-pool')).toBe(true);
  });

  test('Interviewer KHÔNG vào được trang recruiter (chỉ chấm, không lái)', () => {
    expect(hasPermission('Interviewer', '/recruiter/jobs')).toBe(false);
    expect(hasPermission('Interviewer', '/offers')).toBe(false);
    expect(hasPermission('Interviewer', '/interviewer/grading/1')).toBe(true);
  });

  test('DM vào /dept, không vào trang recruiter', () => {
    expect(hasPermission('DepartmentManager', '/dept/hiring-decision')).toBe(true);
    expect(hasPermission('DepartmentManager', '/recruiter/jobs')).toBe(false);
  });

  test('role viết thường vẫn được normalize', () => {
    expect(hasPermission('recruiter', '/recruiter/jobs')).toBe(true);
    expect(hasPermission('departmentmanager', '/dept/requests')).toBe(true);
  });

  test('ai cũng vào được /settings; không role thì chặn hết', () => {
    expect(hasPermission('Interviewer', '/settings')).toBe(true);
    expect(hasPermission(null, '/settings')).toBe(false);
    expect(hasPermission(undefined, '/recruiter/jobs')).toBe(false);
  });
});
