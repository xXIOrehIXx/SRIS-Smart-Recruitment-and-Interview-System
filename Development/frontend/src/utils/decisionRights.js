import { ROLES } from '../contexts/AuthContext';

/**
 * Ai được LOẠI hồ sơ ở từng chặng — bản sao phía giao diện của `EnsureCanDecideAsync`
 * (backend, siết 17/08/2026).
 *
 * Luật: ở mỗi chặng, cửa VÀO và cửa RA do CÙNG một người gác. Cho đi tiếp và loại hẳn là hai
 * nửa của một quyết định, nên ai không được nói "đồng ý" thì cũng không được nói "thôi".
 *
 *   NEW        → nhân sự (sàng lọc vòng đầu: hồ sơ trùng, nộp nhầm vị trí, thiếu yêu cầu cứng)
 *   SCREENING  → Trưởng bộ phận phụ trách vị trí
 *   INTERVIEW  → Giám đốc (đã phỏng vấn thì loại cũng là quyết định tuyển dụng)
 *   OFFER      → Giám đốc
 *
 * ĐÂY CHỈ LÀ LỚP HIỂN THỊ. Backend mới là chỗ chặn thật — hàm này chỉ để người dùng không thấy
 * một cái nút bấm vào là ăn 403. Nó cũng KHÔNG biết user có phải DM của đúng vị trí đó không
 * (giao diện không nắm `job.departmentManagerId` ở mọi màn), nên với vai Trưởng bộ phận nó nới
 * hơn backend một chút: nút hiện, và backend từ chối kèm câu giải thích nếu sai người.
 */
export const canRejectAtState = (role, state) => {
  if (role === ROLES.ADMIN) return true; // superuser: công ty nhỏ chạy trọn luồng 1 tài khoản

  switch (state) {
    case 'NEW':
      return role === ROLES.HUMAN_RESOURCE;
    case 'SCREENING':
      return role === ROLES.DEPARTMENT_MANAGER;
    case 'INTERVIEW':
    case 'OFFER':
      return role === ROLES.DIRECTOR;
    default:
      // HIRED / REJECTED đã chốt — không ai loại nữa (backend trả INVALID_TRANSITION).
      return false;
  }
};

/** Câu giải thích khi nút bị ẩn — nói RA AI làm được, đừng để người dùng đoán. */
export const rejectOwnerLabel = (state) => {
  switch (state) {
    case 'SCREENING':
      return 'Trưởng bộ phận phụ trách vị trí';
    case 'INTERVIEW':
    case 'OFFER':
      return 'Giám đốc';
    case 'NEW':
      return 'bộ phận nhân sự';
    default:
      return null;
  }
};
