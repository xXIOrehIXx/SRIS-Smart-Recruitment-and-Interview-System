import { ROLES } from '../contexts/AuthContext';

/**
 * Ai được LOẠI hồ sơ ở từng chặng — bản sao phía giao diện của `EnsureCanDecideAsync`
 * (backend, siết 17/08/2026).
 *
 * Ranh giới là chữ TUYỂN: "đồng ý tuyển" là của Giám đốc, còn "đóng hồ sơ không tuyển" thuộc về
 * người đã trực tiếp xét ứng viên ở chặng đó.
 *
 *   NEW        → nhân sự (sàng lọc vòng đầu: hồ sơ trùng, nộp nhầm vị trí, thiếu yêu cầu cứng)
 *   SCREENING  → Trưởng bộ phận phụ trách vị trí
 *   INTERVIEW  → Trưởng bộ phận (người đã ngồi phỏng vấn thì đóng được hồ sơ trượt)
 *   OFFER      → Giám đốc (thu hồi thư mời đã phát đi là quyết định của công ty)
 *
 * Giám đốc qua được mọi cửa (cấp trên, phạm vi toàn công ty).
 *
 * ĐÂY CHỈ LÀ LỚP HIỂN THỊ. Backend mới là chỗ chặn thật — hàm này chỉ để người dùng không thấy
 * một cái nút bấm vào là ăn 403. Nó cũng KHÔNG biết user có phải DM của đúng vị trí đó không
 * (giao diện không nắm `job.departmentManagerId` ở mọi màn), nên với vai Trưởng bộ phận nó nới
 * hơn backend một chút: nút hiện, và backend từ chối kèm câu giải thích nếu sai người.
 */
/** Hồ sơ đã chốt — không còn lối ra nào (state machine forward-only). */
const CLOSED_STATES = ['HIRED', 'REJECTED'];

export const canRejectAtState = (role, state) => {
  // KIỂM TRẠNG THÁI TRƯỚC quyền. Admin bypass được người gác, KHÔNG bypass được state machine:
  // hồ sơ đã HIRED/REJECTED thì backend trả INVALID_TRANSITION cho mọi vai, kể cả Admin.
  // Đảo hai vế này là Admin thấy nút "Từ chối" sáng trên ứng viên đã bị từ chối rồi.
  if (!state || CLOSED_STATES.includes(state)) return false;

  if (role === ROLES.ADMIN) return true; // superuser: công ty nhỏ chạy trọn luồng 1 tài khoản

  switch (state) {
    case 'NEW':
      return role === ROLES.HUMAN_RESOURCE;
    case 'SCREENING':
    case 'INTERVIEW':
      return role === ROLES.DEPARTMENT_MANAGER || role === ROLES.DIRECTOR;
    case 'OFFER':
      return role === ROLES.DIRECTOR;
    default:
      return false;
  }
};

/** Câu giải thích khi nút bị ẩn — nói RA AI làm được, đừng để người dùng đoán. */
export const rejectOwnerLabel = (state) => {
  switch (state) {
    case 'SCREENING':
    case 'INTERVIEW':
      return 'Trưởng bộ phận phụ trách vị trí';
    case 'OFFER':
      return 'Giám đốc';
    case 'NEW':
      return 'bộ phận nhân sự';
    default:
      return null;
  }
};
