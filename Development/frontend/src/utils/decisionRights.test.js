import { describe, test, expect } from 'vitest';
import { canRejectAtState, rejectOwnerLabel } from './decisionRights';
import { ROLES } from '../contexts/AuthContext';

/**
 * Luật: ở mỗi chặng, cửa VÀO và cửa RA do cùng một người gác (siết 17/08/2026).
 * Đây là bản sao hiển thị của EnsureCanDecideAsync — lệch nhau là người dùng thấy nút rồi ăn 403.
 */
describe('canRejectAtState — ai được loại hồ sơ ở từng chặng', () => {
  test('nhân sự loại được ở bước Hồ sơ mới (sàng lọc vòng đầu là việc của họ)', () => {
    expect(canRejectAtState(ROLES.HUMAN_RESOURCE, 'NEW')).toBe(true);
  });

  test('nhân sự KHÔNG loại được từ bước Sàng lọc trở đi — lỗ hổng hội đồng nêu', () => {
    expect(canRejectAtState(ROLES.HUMAN_RESOURCE, 'SCREENING')).toBe(false);
    expect(canRejectAtState(ROLES.HUMAN_RESOURCE, 'INTERVIEW')).toBe(false);
    expect(canRejectAtState(ROLES.HUMAN_RESOURCE, 'OFFER')).toBe(false);
  });

  test('Trưởng bộ phận đóng được hồ sơ ở Sàng lọc VÀ sau Phỏng vấn (họ ngồi phỏng vấn)', () => {
    expect(canRejectAtState(ROLES.DEPARTMENT_MANAGER, 'SCREENING')).toBe(true);
    expect(canRejectAtState(ROLES.DEPARTMENT_MANAGER, 'INTERVIEW')).toBe(true);
  });

  test('nhưng thu hồi thư mời đã phát đi thì không — đó là quyết định của công ty', () => {
    expect(canRejectAtState(ROLES.DEPARTMENT_MANAGER, 'OFFER')).toBe(false);
    expect(canRejectAtState(ROLES.DIRECTOR, 'OFFER')).toBe(true);
  });

  test('Giám đốc qua được mọi cửa — cấp trên, phạm vi toàn công ty', () => {
    expect(canRejectAtState(ROLES.DIRECTOR, 'SCREENING')).toBe(true);
    expect(canRejectAtState(ROLES.DIRECTOR, 'INTERVIEW')).toBe(true);
  });

  test('Admin bypass tất cả các chặng còn mở — công ty nhỏ chạy trọn luồng bằng 1 tài khoản', () => {
    ['NEW', 'SCREENING', 'INTERVIEW', 'OFFER'].forEach((s) => {
      expect(canRejectAtState(ROLES.ADMIN, s)).toBe(true);
    });
  });

  test('hồ sơ đã chốt thì KHÔNG ai loại nữa, Admin cũng không', () => {
    // Admin bypass NGƯỜI GÁC, không bypass state machine — backend trả INVALID_TRANSITION
    // cho mọi vai. Bản đầu kiểm quyền trước trạng thái nên Admin thấy nút "Từ chối" sáng
    // trên ứng viên đã bị từ chối rồi (bắt được khi chạy thật trên màn Tin tuyển dụng).
    ['HIRED', 'REJECTED'].forEach((s) => {
      [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.DEPARTMENT_MANAGER, ROLES.HUMAN_RESOURCE].forEach((r) => {
        expect(canRejectAtState(r, s)).toBe(false);
      });
    });
  });

  test('state rỗng/chưa tải xong -> không hiện nút', () => {
    expect(canRejectAtState(ROLES.ADMIN, undefined)).toBe(false);
    expect(canRejectAtState(ROLES.ADMIN, null)).toBe(false);
  });

  test('người phỏng vấn không loại được ở bất kỳ đâu — họ chỉ chấm', () => {
    ['NEW', 'SCREENING', 'INTERVIEW', 'OFFER'].forEach((s) => {
      expect(canRejectAtState(ROLES.INTERVIEWER, s)).toBe(false);
    });
  });
});

describe('rejectOwnerLabel — nói ra ai làm được thay vì để người dùng đoán', () => {
  test('mỗi chặng mở có một chủ rõ ràng', () => {
    expect(rejectOwnerLabel('SCREENING')).toContain('Trưởng bộ phận');
    expect(rejectOwnerLabel('INTERVIEW')).toContain('Trưởng bộ phận');
    expect(rejectOwnerLabel('OFFER')).toBe('Giám đốc');
    expect(rejectOwnerLabel('NEW')).toContain('nhân sự');
  });

  test('hồ sơ đã chốt không có chủ -> null, giao diện ẩn hẳn nút thay vì khoá', () => {
    expect(rejectOwnerLabel('HIRED')).toBeNull();
    expect(rejectOwnerLabel('REJECTED')).toBeNull();
  });
});
