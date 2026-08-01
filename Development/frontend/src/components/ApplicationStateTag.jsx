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
 */

export const APPLICATION_STATE_LABELS = {
  NEW: "Hồ sơ mới",
  SCREENING: "Sàng lọc",
  INTERVIEW: "Phỏng vấn",
  OFFER: "Offer",
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
