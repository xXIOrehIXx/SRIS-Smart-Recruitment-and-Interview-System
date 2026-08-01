/**
 * Quy ước dùng chung giữa Yêu cầu tuyển dụng (DM ghi) và Tin tuyển dụng (HR đọc) — docs 5.17.
 * Lệch một trong các bảng này là HR phải gõ lại từ đầu hoặc đọc phải mã trần.
 */
import {
  EMPLOYMENT_TYPE_TO_JOB,
  EXPERIENCE_LEVEL_TO_JOB,
  employmentLabel,
  experienceLabel,
  experienceText,
  experienceYearsToJob,
  formatSalaryRange,
  splitRequirements,
} from './recruitmentRequest';

describe('splitRequirements', () => {
  test('tách dòng kỹ năng ra khỏi phần yêu cầu', () => {
    const { text, skills } = splitRequirements('Tốt nghiệp cao đẳng\nKỹ năng yêu cầu: Excel, MISA');
    expect(text).toBe('Tốt nghiệp cao đẳng');
    expect(skills).toEqual(['Excel', 'MISA']);
  });

  test('không có dòng kỹ năng -> skills rỗng, giữ nguyên text', () => {
    const { text, skills } = splitRequirements('Chịu khó, ham học hỏi');
    expect(text).toBe('Chịu khó, ham học hỏi');
    expect(skills).toEqual([]);
  });

  test('requirements rỗng/null -> không nổ', () => {
    expect(splitRequirements(null)).toEqual({ text: '', skills: [] });
  });
});

describe('formatSalaryRange (lương là TÙY CHỌN với DM)', () => {
  test('đủ hai đầu', () => {
    expect(formatSalaryRange(12000000, 18000000)).toBe('12.000.000 ₫ - 18.000.000 ₫');
  });

  test('chỉ có sàn', () => {
    expect(formatSalaryRange(12000000, null)).toBe('Từ 12.000.000 ₫');
  });

  test('chỉ có trần', () => {
    expect(formatSalaryRange(null, 18000000)).toBe('Tới 18.000.000 ₫');
  });

  test('không nhập gì -> null để chỗ hiển thị tự ghi "Thỏa thuận"', () => {
    expect(formatSalaryRange(null, null)).toBeNull();
  });

  test('lương 0 không bị coi là thiếu', () => {
    expect(formatSalaryRange(0, 5000000)).toBe('0 ₫ - 5.000.000 ₫');
  });
});

describe('nhãn hiển thị', () => {
  test('cấp bậc hiện kèm số năm, không phải mã trần', () => {
    expect(experienceLabel('Mid')).toBe('Mid-level (2-4 năm)');
    expect(employmentLabel('FULL_TIME')).toBe('Toàn thời gian');
  });

  test('giá trị lạ -> trả lại chính nó, không hiện undefined', () => {
    expect(experienceLabel('Principal')).toBe('Principal');
    expect(experienceLabel(null)).toBeNull();
  });
});

describe('số năm kinh nghiệm (V024)', () => {
  test('DM nhập số năm -> "Ít nhất N năm"', () => {
    expect(experienceText(2)).toBe('Ít nhất 2 năm');
    expect(experienceText(3)).toBe('Ít nhất 3 năm');
  });

  test('0 năm là LỰA CHỌN THẬT, không phải bỏ trống', () => {
    expect(experienceText(0)).toBe('Không yêu cầu kinh nghiệm');
    // Bẫy falsy: 0 phải khác hẳn null.
    expect(experienceText(null)).toBeNull();
  });

  test('yêu cầu cũ chưa có số năm -> rơi về cấp bậc', () => {
    expect(experienceText(null, 'Senior')).toBe('Senior (4-7 năm)');
  });

  test('có cả hai thì số năm thắng (DM nhập tay chính xác hơn)', () => {
    expect(experienceText(3, 'Senior')).toBe('Ít nhất 3 năm');
  });

  test('quy đổi sang option form tin: lấy mốc sát dưới, không siết chặt hơn ý DM', () => {
    expect(experienceYearsToJob(0)).toBe('Fresher');
    expect(experienceYearsToJob(1)).toBe('1+');
    expect(experienceYearsToJob(2)).toBe('2+');
    expect(experienceYearsToJob(4)).toBe('3+');
    expect(experienceYearsToJob(7)).toBe('5+');
    expect(experienceYearsToJob(null)).toBeUndefined();
  });
});

describe('quy đổi sang từ vựng form tin tuyển dụng', () => {
  test('mọi cấp bậc DM chọn được đều có đích quy đổi', () => {
    ['Fresher', 'Junior', 'Mid', 'Senior', 'Lead', 'Manager'].forEach((lv) =>
      expect(EXPERIENCE_LEVEL_TO_JOB[lv]).toBeTruthy()
    );
  });

  test('mọi loại hình DM chọn được đều có đích quy đổi', () => {
    ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'REMOTE'].forEach((t) =>
      expect(EMPLOYMENT_TYPE_TO_JOB[t]).toBeTruthy()
    );
  });
});
