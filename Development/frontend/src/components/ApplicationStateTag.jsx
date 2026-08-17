import React from "react";
import { Tag } from "antd";

/**
 * NGUỒN DUY NHẤT cho nhãn + màu trạng thái hồ sơ.
 *
 * Backend chạy 6 state nội bộ (NEW → SCREENING → INTERVIEW → OFFER → HIRED/REJECTED),
 * nhưng người dùng chỉ được thấy 4 PHA bằng tiếng Việt — mã state là chuyện nội bộ,
 * không phơi ra UI. Trước đây mỗi màn tự khai một bảng nhãn riêng (4 bản sao lệch nhau:
 * "Hồ sơ mới" vs "Hồ Sơ Mới", màu có màn có màn không), và màn chi tiết phỏng vấn còn
 * in thẳng chữ "SCREENING" ra cho người dùng đọc.
 *
 * Thêm/đổi state thì sửa DUY NHẤT ở đây.
 *
 * ⚠️ CHỈ DÙNG CHO NGƯỜI TRONG CÔNG TY. Trang trạng thái của ỨNG VIÊN (CandidateStatus) có bộ
 * nhãn riêng và phải giữ riêng: "Chờ Trưởng bộ phận duyệt" là chuyện cơ cấu nội bộ, ứng viên
 * không cần và không nên biết hồ sơ mình đang nằm trên bàn ai.
 */

/**
 * Nhãn ĐỔI 17/08/2026 để tên pha khớp với người sở hữu pha đó.
 *
 * Cũ: NEW = "Hồ sơ mới", SCREENING = "Sàng lọc". Đọc lên thì tưởng việc sàng lọc nằm ở pha 2,
 * trong khi thực tế bộ phận nhân sự đọc CV và loại hồ sơ ở pha 1; pha 2 là lúc hồ sơ ĐÃ qua tay
 * họ và đang chờ Trưởng bộ phận chọn ai được gặp. Tên cũ khiến chính người trong nhóm đọc bảng
 * phân quyền cũng thấy vô lý ("sao nhân sự không loại được ở pha Sàng lọc?").
 *
 * Tên mới nói thẳng AI đang giữ hồ sơ, nên nhìn Kanban là biết đang chờ ai.
 */
export const APPLICATION_STATE_LABELS = {
  NEW: "Tiếp nhận & sàng lọc",
  SCREENING: "Chờ Trưởng bộ phận duyệt",
  INTERVIEW: "Phỏng vấn",
  OFFER: "Quyết định",
  HIRED: "Đã tuyển",
  REJECTED: "Từ chối",
};

/**
 * Màu đi theo TIẾN TRÌNH tuyển dụng, không phải chọn cho đẹp:
 * xanh dương (mới vào) → tím → cam (đang phỏng vấn) → vàng (chờ quyết) →
 * xanh lá (chốt tuyển) / đỏ (loại). OFFER cố ý là vàng chứ không phải xanh lá
 * để không nhìn nhầm thành "đã tuyển" — đó là hai việc khác nhau.
 */
export const APPLICATION_STATE_COLORS = {
  NEW: "blue",
  SCREENING: "purple",
  INTERVIEW: "orange",
  OFFER: "gold",
  HIRED: "green",
  REJECTED: "red",
};

/** Nhãn tiếng Việt của 1 state; state lạ thì trả về chính nó để không nuốt mất thông tin. */
export const stateLabel = (state) => APPLICATION_STATE_LABELS[state] || state || "—";

/** Chip trạng thái hồ sơ dùng chung cho mọi màn. */
const ApplicationStateTag = ({ state, ...rest }) => {
  if (!state) return null;
  return (
    <Tag color={APPLICATION_STATE_COLORS[state] || "default"} {...rest}>
      {stateLabel(state)}
    </Tag>
  );
};

export default ApplicationStateTag;
