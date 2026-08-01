/**
 * Hợp đồng dữ liệu giữa Yêu cầu tuyển dụng (DM ghi) và Tin tuyển dụng (HR đọc) — docs 5.17.
 *
 * Hai form dùng bộ từ vựng KHÁC NHAU cho cùng một ý (loại hình, cấp bậc), và bảng
 * RecruitmentRequest không có cột skills riêng. Gom hết quy ước vào một file để
 * bên ghi và bên đọc không lệch nhau — lệch là HR phải gõ lại từ đầu.
 */

/** Skills không có cột riêng -> gộp vào requirements thành 1 dòng có tiền tố này. */
export const SKILLS_PREFIX = 'Kỹ năng yêu cầu:';

/** requirements (1 chuỗi nhiều dòng) -> { text, skills }. */
export const splitRequirements = (raw) => {
  const lines = (raw || '').split('\n');
  const skillLine = lines.find((l) => l.trim().startsWith(SKILLS_PREFIX));
  return {
    text: lines.filter((l) => l !== skillLine).join('\n').trim(),
    skills: skillLine
      ? skillLine.trim().slice(SKILLS_PREFIX.length).split(',').map((s) => s.trim()).filter(Boolean)
      : [],
  };
};

/**
 * Loại hình: form Yêu cầu dùng SCREAMING_CASE, form Tin tuyển dụng dùng nhãn Title-case.
 * REMOTE không có ô tương ứng bên Tin -> coi là toàn thời gian, HR tự ghi rõ ở Địa điểm.
 */
export const EMPLOYMENT_TYPE_TO_JOB = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
  REMOTE: 'Full-time',
};

/**
 * Cấp bậc: form Yêu cầu mô tả theo vai (Junior/Mid/...), form Tin mô tả theo số năm.
 * Quy đổi lấy MỐC DƯỚI của khoảng để không thổi phồng yêu cầu (Senior 4-7 năm -> "3+",
 * không phải "5+" — người 4 năm vẫn hợp lệ).
 */
export const EXPERIENCE_LEVEL_TO_JOB = {
  Fresher: 'Fresher',
  Junior: '1+',
  Mid: '2+',
  Senior: '3+',
  Lead: '5+',
  Manager: '5+',
};

/**
 * Cấp bậc kèm SỐ NĂM kinh nghiệm — form DM chọn, màn duyệt hiển thị.
 * Lưu trong DB là mã trần ("Mid"); hiện mã trần cho người duyệt thì họ không biết
 * DM đang cần bao nhiêu năm, nên mọi chỗ hiển thị phải đi qua bảng này.
 */
export const EXPERIENCE_LEVELS = [
  { value: 'Fresher', label: 'Fresher (0-1 năm)' },
  { value: 'Junior', label: 'Junior (1-2 năm)' },
  { value: 'Mid', label: 'Mid-level (2-4 năm)' },
  { value: 'Senior', label: 'Senior (4-7 năm)' },
  { value: 'Lead', label: 'Lead/Principal (7+ năm)' },
  { value: 'Manager', label: 'Manager/Director' },
];

export const EMPLOYMENT_TYPES = [
  { value: 'FULL_TIME', label: 'Toàn thời gian' },
  { value: 'PART_TIME', label: 'Bán thời gian' },
  { value: 'CONTRACT', label: 'Hợp đồng' },
  { value: 'INTERNSHIP', label: 'Thực tập' },
  { value: 'REMOTE', label: 'Làm việc từ xa' },
];

const labelOf = (list, value) => list.find((x) => x.value === value)?.label;

/** "Mid" -> "Mid-level (2-4 năm)". Trả lại chính giá trị gốc nếu không có trong danh mục. */
export const experienceLabel = (value) => (value ? labelOf(EXPERIENCE_LEVELS, value) || value : null);

/** "FULL_TIME" -> "Toàn thời gian". */
export const employmentLabel = (value) => (value ? labelOf(EMPLOYMENT_TYPES, value) || value : null);

/**
 * Khoảng lương -> chuỗi đọc được. Lương là TÙY CHỌN với DM nên phải xử lý cả 3 trường hợp
 * thiếu: chỉ có sàn, chỉ có trần, không có gì.
 */
export const formatSalaryRange = (min, max) => {
  const money = (n) => `${Number(n).toLocaleString('vi-VN')} ₫`;
  if (min != null && max != null) return `${money(min)} - ${money(max)}`;
  if (min != null) return `Từ ${money(min)}`;
  if (max != null) return `Tới ${money(max)}`;
  return null;
};
