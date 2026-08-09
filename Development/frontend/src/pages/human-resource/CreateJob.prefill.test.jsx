import { vi } from 'vitest';
/**
 * Tạo tin từ Yêu cầu tuyển dụng của DM (5.17): bấm "Tạo tin" ở màn yêu cầu
 * -> /human-resource/jobs/create?requestId=X phải ĐIỀN SẴN thông tin DM đã nhập,
 * HR không phải gõ lại từ đầu.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreateJob from './CreateJob';
import { recruitmentRequestAPI } from '../../services/api';

vi.mock('../../services/api', () => ({
  recruitmentRequestAPI: { getById: vi.fn(), convert: vi.fn() },
  jobsAPI: { getById: vi.fn(), create: vi.fn(), update: vi.fn() },
  usersAPI: { getOptions: vi.fn() },
  departmentAPI: { getAll: vi.fn() },
  employmentTypeAPI: { getAll: vi.fn() },
  companyAPI: { get: vi.fn() },
}));

const { usersAPI, departmentAPI, employmentTypeAPI, companyAPI } =
  await import('../../services/api');

const REQUEST = {
  requestId: 7,
  title: 'Kế toán tổng hợp',
  department: 'Kế toán',
  quantity: 3,
  // V027: hai form dùng chung danh mục hình thức làm việc -> lưu thẳng TÊN.
  employmentType: 'Toàn thời gian',
  experienceLevel: 'Mid',
  description: 'Phụ trách sổ sách, báo cáo thuế hàng tháng.',
  requirements: 'Tốt nghiệp cao đẳng trở lên\nKỹ năng yêu cầu: Excel, MISA',
  benefits: 'Thưởng tháng 13',
  salaryMin: 12000000,
  salaryMax: 18000000,
  status: 'APPROVED',
  createdByName: 'Trần Thị B',
};

beforeEach(() => {
  vi.clearAllMocks();
  usersAPI.getOptions.mockResolvedValue({ data: [] });
  departmentAPI.getAll.mockResolvedValue({ data: [{ id: 1, name: 'Kế toán', status: 'Active' }] });
  employmentTypeAPI.getAll.mockResolvedValue({
    data: [
      { employmentTypeId: 1, name: 'Toàn thời gian', status: 'Active' },
      { employmentTypeId: 2, name: 'Thực tập', status: 'Active' },
    ],
  });
  recruitmentRequestAPI.getById.mockResolvedValue({ data: REQUEST });
  // Mặc định: công ty chưa khai quyền lợi mặc định. Test nào cần thì mock đè.
  companyAPI.get.mockResolvedValue({ data: { defaultBenefits: [] } });
});

const renderFromRequest = async () => {
  render(
    <MemoryRouter initialEntries={['/human-resource/jobs/create?requestId=7']}>
      <CreateJob />
    </MemoryRouter>
  );
  await waitFor(() => expect(recruitmentRequestAPI.getById).toHaveBeenCalledWith('7'));
  await waitFor(() =>
    expect(screen.getByDisplayValue('Kế toán tổng hợp')).toBeInTheDocument()
  );
};

test('?requestId -> điền sẵn tiêu đề, mô tả, số lượng DM đã nhập', async () => {
  await renderFromRequest();

  expect(screen.getByDisplayValue(/sổ sách, báo cáo thuế/)).toBeInTheDocument();
  expect(screen.getByDisplayValue('3')).toBeInTheDocument();
});

test('?requestId -> điền sẵn hình thức làm việc (danh mục chung) + quy đổi cấp bậc', async () => {
  await renderFromRequest();

  // Hình thức lấy thẳng từ danh mục chung; cấp bậc vẫn phải quy đổi (Mid -> "2+ năm").
  expect(screen.getByTitle('Toàn thời gian')).toBeInTheDocument();
  expect(screen.getByTitle('2+ năm')).toBeInTheDocument();
});

test('?requestId -> số năm DM nhập thắng cấp bậc cũ khi quy đổi', async () => {
  // Yêu cầu vừa có cấp bậc cũ (Mid -> "2+") vừa có số năm mới (5 -> "5+"): lấy số năm.
  recruitmentRequestAPI.getById.mockResolvedValue({
    data: { ...REQUEST, experienceYearsMin: 5 },
  });

  await renderFromRequest();

  expect(screen.getByTitle('5+ năm')).toBeInTheDocument();
});

test('?requestId -> tách dòng "Kỹ năng yêu cầu" thành từng chip riêng', async () => {
  await renderFromRequest();

  // Ô Kỹ năng là Select mode="tags": mỗi kỹ năng là một chip riêng, không phải
  // một chuỗi "Excel, MISA" nằm trong ô text.
  expect(screen.getByTitle('Excel')).toBeInTheDocument();
  expect(screen.getByTitle('MISA')).toBeInTheDocument();
  // Dòng kỹ năng KHÔNG được lẫn vào phần yêu cầu dạng gạch đầu dòng.
  expect(screen.queryByDisplayValue(/Kỹ năng yêu cầu:/)).not.toBeInTheDocument();
});

test('?requestId -> người quyết tuyển điền sẵn chính DM đã ra đề', async () => {
  // DM ra đề cũng là người chốt ở bước Offer — HR không phải tự nhớ chọn lại.
  usersAPI.getOptions.mockResolvedValue({
    data: [{ userId: 12, fullName: 'Trần Thị B', role: 'DepartmentManager' }],
  });
  recruitmentRequestAPI.getById.mockResolvedValue({
    data: { ...REQUEST, createdBy: 12 },
  });

  await renderFromRequest();

  await waitFor(() => expect(screen.getByTitle('Trần Thị B')).toBeInTheDocument());
});

/**
 * Sửa tin đã có: /human-resource/jobs/create?edit=X.
 * Hạn nộp từ API là CHUỖI ISO, còn <DatePicker> của antd v5 chỉ nhận object dayjs —
 * gán thẳng chuỗi thì component throw và cả trang trắng xóa. Lỗi này nằm im cho tới
 * khi có tin điền hạn nộp, nên phải có test giữ.
 */
const JOB_WITH_DEADLINE = {
  jobId: 48,
  title: 'Thực tập sinh Marketing',
  department: 'Phòng Marketing',
  employmentType: 'Internship',
  experienceLevel: 'Không yêu cầu',
  location: 'Hà Nội',
  jdText: 'Hỗ trợ đội Marketing triển khai các hoạt động truyền thông.',
  salaryMin: 4000000,
  salaryMax: 6000000,
  currency: 'VND',
  deadline: '2026-08-31T00:00:00',
  requirements: ['Sinh viên năm 3, năm 4'],
  benefits: ['Trợ cấp thực tập theo tháng'],
  skills: ['Canva', 'Viết content'],
};

const renderEdit = async (job) => {
  const { jobsAPI } = await import('../../services/api');
  jobsAPI.getById.mockResolvedValue({ data: job });

  render(
    <MemoryRouter initialEntries={['/human-resource/jobs/create?edit=48']}>
      <CreateJob />
    </MemoryRouter>
  );
  await waitFor(() => expect(jobsAPI.getById).toHaveBeenCalledWith('48'));
};

test('?edit -> tin CÓ hạn nộp vẫn render được (không trắng màn hình)', async () => {
  await renderEdit(JOB_WITH_DEADLINE);

  await waitFor(() =>
    expect(screen.getByDisplayValue('Thực tập sinh Marketing')).toBeInTheDocument()
  );
  // Hạn nộp đổ đúng vào ô ngày thay vì làm sập trang.
  expect(screen.getByDisplayValue('31/08/2026')).toBeInTheDocument();
});

test('?edit -> hạn nộp rỗng hoặc hỏng thì để trống, không sập', async () => {
  await renderEdit({ ...JOB_WITH_DEADLINE, deadline: 'khong-phai-ngay' });

  await waitFor(() =>
    expect(screen.getByDisplayValue('Thực tập sinh Marketing')).toBeInTheDocument()
  );
});

/**
 * Yêu cầu ứng viên + kỹ năng là hai mục AI đọc để bóc tiêu chí phỏng vấn. Trước đây form
 * KHÔNG vẽ ô yêu cầu, và ô kỹ năng thì không được điền lại khi sửa tin -> lưu phát nữa là
 * mất sạch kỹ năng cũ. Hai test dưới giữ đúng hai chỗ đó.
 */
test('?edit -> yêu cầu ứng viên có sẵn được đổ vào ô nhập', async () => {
  await renderEdit(JOB_WITH_DEADLINE);

  await waitFor(() =>
    expect(screen.getByDisplayValue('Sinh viên năm 3, năm 4')).toBeInTheDocument()
  );
});

test('?edit -> kỹ năng cũ điền lại thành chip (lưu lại không mất)', async () => {
  await renderEdit(JOB_WITH_DEADLINE);

  await waitFor(() => expect(screen.getByTitle('Canva')).toBeInTheDocument());
  expect(screen.getByTitle('Viết content')).toBeInTheDocument();
});

test('?edit -> quyền lợi có sẵn được đổ vào ô nhập', async () => {
  await renderEdit(JOB_WITH_DEADLINE);

  await waitFor(() =>
    expect(screen.getByDisplayValue('Trợ cấp thực tập theo tháng')).toBeInTheDocument()
  );
});

/**
 * Quyền lợi mặc định của công ty (V035): Admin nhập 1 lần ở hồ sơ công ty, tin MỚI tự
 * điền sẵn. Ba ca dưới giữ đúng ranh giới — nhất là ca SỬA tin, điền sẵn ở đó là đè mất
 * quyền lợi người dùng đã chỉnh riêng cho tin đó.
 */
test('tạo tin mới -> điền sẵn quyền lợi mặc định của công ty', async () => {
  companyAPI.get.mockResolvedValue({
    data: { defaultBenefits: ['Thưởng lương tháng 13', 'Đóng BHXH đầy đủ'] },
  });

  render(
    <MemoryRouter initialEntries={['/human-resource/jobs/create']}>
      <CreateJob />
    </MemoryRouter>
  );

  await waitFor(() =>
    expect(screen.getByDisplayValue('Thưởng lương tháng 13')).toBeInTheDocument()
  );
  expect(screen.getByDisplayValue('Đóng BHXH đầy đủ')).toBeInTheDocument();
});

test('?requestId -> giữ quyền lợi DM ghi VÀ nối thêm mặc định của công ty', async () => {
  companyAPI.get.mockResolvedValue({
    data: { defaultBenefits: ['Đóng BHXH đầy đủ'] },
  });

  await renderFromRequest();

  // DM ghi "Thưởng tháng 13" cho vị trí này; mặc định công ty nối vào sau, không đạp lên.
  await waitFor(() =>
    expect(screen.getByDisplayValue('Đóng BHXH đầy đủ')).toBeInTheDocument()
  );
  expect(screen.getByDisplayValue('Thưởng tháng 13')).toBeInTheDocument();
});

test('?edit -> KHÔNG chèn quyền lợi mặc định vào tin đã đăng', async () => {
  companyAPI.get.mockResolvedValue({
    data: { defaultBenefits: ['Đóng BHXH đầy đủ'] },
  });

  await renderEdit(JOB_WITH_DEADLINE);

  await waitFor(() =>
    expect(screen.getByDisplayValue('Trợ cấp thực tập theo tháng')).toBeInTheDocument()
  );
  expect(screen.queryByDisplayValue('Đóng BHXH đầy đủ')).not.toBeInTheDocument();
});

test('tạo tin mới -> có ô nhập yêu cầu ứng viên kèm gợi ý nghề phổ thông', async () => {
  render(
    <MemoryRouter initialEntries={['/human-resource/jobs/create']}>
      <CreateJob />
    </MemoryRouter>
  );

  await waitFor(() =>
    expect(
      screen.getByPlaceholderText('VD: Tốt nghiệp Cao đẳng trở lên')
    ).toBeInTheDocument()
  );
});
