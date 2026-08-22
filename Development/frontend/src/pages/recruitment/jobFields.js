/**
 * Helper đọc field của job trên Career Site công khai.
 * API trả PublicJobDto (camelCase), nhưng vẫn giữ fallback cho vài tên field cũ
 * để trang danh sách và trang chi tiết dùng chung một cách đọc dữ liệu.
 */

export const getJobId = (job) => job.jobId || job.id;

export const getJobDescription = (job) =>
  job.jdText || job.jobDescription || job.description || job.JobDescription || "";

const toList = (value, separator) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string")
    return value
      .split(separator)
      .map((item) => item.trim())
      .filter(Boolean);
  return [];
};

export const getRequirements = (job) => {
  const list = toList(job.requirements, "\n");
  if (list.length > 0) return list;
  return job.JobRequirements || [];
};

export const getBenefits = (job) => {
  const list = toList(job.benefits, "\n");
  if (list.length > 0) return list;
  return job.JobBenefits || [];
};

export const getSkills = (job) => {
  const list = toList(job.skills, ",");
  if (list.length > 0) return list;
  return job.requiredSkills || job.Skills || [];
};

export const getDeadline = (job) =>
  job.deadline || job.expiresAt || job.expiredAt || job.expirationDate || null;

/**
 * Tin đã quá hạn nộp hồ sơ. Ưu tiên cờ `isExpired` do backend tính (mốc UTC, cùng chuẩn với
 * chỗ chặn nộp); chỉ tự so ngày khi API cũ chưa trả cờ này.
 * Chỉ để ẩn/đổi UI — backend mới là chỗ chặn nộp thật.
 */
export const isJobExpired = (job) => {
  if (!job) return false;
  if (typeof job.isExpired === "boolean") return job.isExpired;
  const deadline = getDeadline(job);
  if (!deadline) return false;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
};

export const getCreatedDate = (job) =>
  job.createdAt || job.postedDate || job.createdDate || job.postedAt || null;

export const getJobType = (job) => job.employmentType || job.jobType || job.type || null;

export const getLocation = (job) => job.location || job.workLocation || null;

/** Text của phần tử trong danh sách yêu cầu/quyền lợi/kỹ năng (chuỗi hoặc object). */
export const itemText = (item) =>
  typeof item === "string" ? item : item?.text || item?.name || item?.skill || "";

export const formatSalary = (job) => {
  if (job.salary) return job.salary;
  if (job.salaryRange) return job.salaryRange;
  const currency = job.currency ? ` ${job.currency}` : "";
  const format = (n) => new Intl.NumberFormat("vi-VN").format(n);
  if (job.salaryMin && job.salaryMax)
    return `${format(job.salaryMin)} - ${format(job.salaryMax)}${currency}`;
  if (job.salaryMin) return `Từ ${format(job.salaryMin)}${currency}`;
  return "Thỏa thuận";
};

export const formatDate = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("vi-VN");
};

export const getJobTypeColor = (type) => {
  switch (type) {
    case "Full-time":
      return "green";
    case "Part-time":
      return "blue";
    case "Contract":
      return "orange";
    case "Remote":
      return "purple";
    case "Internship":
      return "cyan";
    default:
      return "default";
  }
};

export const getExperienceColor = (exp) => {
  if (!exp) return "default";
  if (exp.includes("5+")) return "red";
  if (exp.includes("3+")) return "orange";
  if (exp.includes("2+")) return "blue";
  return "green";
};
