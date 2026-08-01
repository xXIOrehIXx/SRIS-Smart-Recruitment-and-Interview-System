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
}));

const { usersAPI, departmentAPI } = await import('../../services/api');

const REQUEST = {
  requestId: 7,
  title: 'Kế toán tổng hợp',
  department: 'Kế toán',
  quantity: 3,
  employmentType: 'FULL_TIME',
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

test('?requestId -> quy đổi loại hình + cấp bậc sang từ vựng của form tin tuyển dụng', async () => {
  await renderFromRequest();

  // FULL_TIME -> "Toàn thời gian", Mid -> "2+ năm"; gán thẳng mã gốc thì Select hiện TRỐNG.
  expect(screen.getByTitle('Toàn thời gian')).toBeInTheDocument();
  expect(screen.getByTitle('2+ năm')).toBeInTheDocument();
});

test('?requestId -> tách dòng "Kỹ năng yêu cầu" ra ô Kỹ Năng riêng', async () => {
  await renderFromRequest();

  expect(screen.getByDisplayValue('Excel, MISA')).toBeInTheDocument();
  // Dòng kỹ năng KHÔNG được lẫn vào phần yêu cầu dạng gạch đầu dòng.
  expect(screen.queryByDisplayValue(/Kỹ năng yêu cầu:/)).not.toBeInTheDocument();
});
