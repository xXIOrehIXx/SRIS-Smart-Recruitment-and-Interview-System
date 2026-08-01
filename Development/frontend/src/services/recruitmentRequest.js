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
