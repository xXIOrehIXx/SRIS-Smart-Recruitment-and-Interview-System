import { vi } from 'vitest';
/**
 * Tạo tin từ Yêu cầu tuyển dụng của DM (5.17): bấm "Tạo tin" ở màn yêu cầu
 * -> /recruiter/jobs/create?requestId=X phải ĐIỀN SẴN thông tin DM đã nhập,
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
}));

const { usersAPI, departmentAPI, employmentTypeAPI } = await import('../../services/api');

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
});

const renderFromRequest = async () => {
  render(
    <MemoryRouter initialEntries={['/recruiter/jobs/create?requestId=7']}>
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

test('?requestId -> tách dòng "Kỹ năng yêu cầu" ra ô Kỹ Năng riêng', async () => {
  await renderFromRequest();

  expect(screen.getByDisplayValue('Excel, MISA')).toBeInTheDocument();
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
 * Sửa tin đã có: /recruiter/jobs/create?edit=X.
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
};

const renderEdit = async (job) => {
  const { jobsAPI } = await import('../../services/api');
  jobsAPI.getById.mockResolvedValue({ data: job });

  render(
    <MemoryRouter initialEntries={['/recruiter/jobs/create?edit=48']}>
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
