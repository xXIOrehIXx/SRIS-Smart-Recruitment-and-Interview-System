/**
 * Nhãn tiếng Việt cho `ActivityLog.action` — người dùng là bộ phận nhân sự, không phải dev:
 * "STATE_CHANGE" / "OFFER_MADE" là mã của backend, không phải thứ để bày ra màn hình.
 *
 * Mã cũ vẫn nằm trong dữ liệu đã ghi (vd OFFER_MADE của bản trước, nay backend ghi
 * OFFER_LETTER_SENT) nên phải map cả hai. Mã lạ thì trả về nguyên văn — thà thấy mã còn hơn
 * mất dòng lịch sử.
 */
const ACTION_LABELS = {
  STATE_CHANGE: 'Chuyển giai đoạn',
  INTERVIEW_INVITED: 'Mời chọn lịch phỏng vấn',
  INTERVIEW_SCHEDULED: 'Chốt lịch phỏng vấn',
  INTERVIEW_CANCELLED: 'Hủy lịch phỏng vấn',
  INTERVIEW_NO_SLOT_FITS: 'Ứng viên báo bận hết khung giờ',
  INTERVIEW_RESCHEDULED: 'Dời lịch phỏng vấn',
  INTERVIEWERS_ASSIGNED: 'Chỉ định người phỏng vấn',
  HIRING_PROPOSED: 'Gửi đề xuất tuyển',
  HIRING_APPROVED: 'Giám đốc duyệt đề xuất tuyển',
  // TRẢ LẠI, không phải loại ứng viên: hồ sơ ở lại vòng phỏng vấn và Trưởng bộ phận
  // đề xuất lại được (V043). Ghi "từ chối" ở đây là đọc nhầm thành ứng viên bị loại.
  HIRING_PROPOSAL_REJECTED: 'Giám đốc trả lại đề xuất tuyển',
  OFFER_LETTER_SENT: 'Gửi thư mời nhận việc',
  OFFER_MADE: 'Gửi thư mời nhận việc',
  OFFER_ACCEPTED: 'Ứng viên nhận việc',
  OFFER_DECLINED: 'Ứng viên từ chối nhận việc',
  OFFER_SIGNED_UPLOADED: 'Tải lên bản scan hợp đồng đã ký',
  OFFER_SIGNED_REMOVED: 'Gỡ bản scan hợp đồng đã ký',
};

export const actionLabel = (action) => ACTION_LABELS[action] || action || '—';

/**
 * Số tiền trong `detail` của backend là số trần ("22000000 VND"). Chấm phân cách nghìn để
 * đọc được bằng mắt, khỏi đếm số 0.
 */
export const formatActivityDetail = (detail) => {
  if (!detail) return detail;
  return detail.replace(/\b\d{4,}\b/g, (n) => Number(n).toLocaleString('vi-VN'));
};
