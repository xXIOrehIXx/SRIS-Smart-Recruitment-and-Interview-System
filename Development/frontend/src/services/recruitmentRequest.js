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

/**
 * Hình thức làm việc giờ là DANH MỤC trong DB (V027, Admin CRUD) — cả hai form đọc từ
 * `employmentTypeAPI.getAll()` và lưu thẳng TÊN, không còn danh sách cứng lẫn bảng quy đổi.
 * Bảng dưới chỉ để hiển thị đẹp cho dữ liệu cũ lỡ chưa được migration V027 chuẩn hóa.
 */
const LEGACY_EMPLOYMENT_LABEL = {
  FULL_TIME: 'Toàn thời gian',
  PART_TIME: 'Bán thời gian',
  CONTRACT: 'Hợp đồng',
  INTERNSHIP: 'Thực tập',
  REMOTE: 'Làm việc từ xa',
  'Full-time': 'Toàn thời gian',
  'Part-time': 'Bán thời gian',
  Contract: 'Hợp đồng',
  Internship: 'Thực tập',
};

const labelOf = (list, value) => list.find((x) => x.value === value)?.label;

/** "Mid" -> "Mid-level (2-4 năm)". Trả lại chính giá trị gốc nếu không có trong danh mục. */
export const experienceLabel = (value) => (value ? labelOf(EXPERIENCE_LEVELS, value) || value : null);

/**
 * Số năm -> chữ hiển thị. 0 là giá trị THẬT ("nhận người chưa kinh nghiệm"), không phải
 * "chưa nhập" — mọi chỗ kiểm phải dùng `!= null`, dùng falsy là hiểu sai ý DM.
 */
export const experienceYearsText = (years) => {
  if (years == null) return null;
  return years === 0 ? 'Không yêu cầu kinh nghiệm' : `Ít nhất ${years} năm`;
};

/**
 * Chữ hiển thị kinh nghiệm của 1 yêu cầu: ưu tiên SỐ NĂM (V024), rơi về cấp bậc cho các
 * yêu cầu tạo trước đó, cuối cùng là null để nơi gọi tự quyết chữ mặc định.
 */
export const experienceText = (yearsMin, level = null) =>
  experienceYearsText(yearsMin) ?? experienceLabel(level);

/**
 * Số năm -> option của form Tin tuyển dụng (Fresher | 1+ | 2+ | 3+ | 5+).
 * Lấy mốc SÁT DƯỚI để không siết chặt hơn ý DM: 4 năm -> "3+", không phải "5+".
 */
export const experienceYearsToJob = (years) => {
  if (years == null) return undefined;
  if (years <= 0) return 'Fresher';
  if (years === 1) return '1+';
  if (years === 2) return '2+';
  if (years < 5) return '3+';
  return '5+';
};

/** Tên hình thức để hiển thị (dữ liệu cũ dạng mã -> nhãn tiếng Việt). */
export const employmentLabel = (value) => (value ? LEGACY_EMPLOYMENT_LABEL[value] || value : null);

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
