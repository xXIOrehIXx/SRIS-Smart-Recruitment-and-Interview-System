/**
 * Trang ứng viên xem trạng thái qua magic link STATUS (?token=...).
 * Render test với API mock — kiểm 3 nhánh: thiếu token / thành công / link hết hạn.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CandidateStatus from './CandidateStatus';
import { candidateAPI } from '../../services/api';

jest.mock('../../services/api', () => ({
  candidateAPI: { getStatus: jest.fn() },
}));

const renderAt = (url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <CandidateStatus />
    </MemoryRouter>
  );

beforeEach(() => jest.clearAllMocks());

test('thiếu token -> báo liên kết không hợp lệ, KHÔNG gọi API', async () => {
  renderAt('/status');

  await waitFor(() =>
    expect(screen.getByText(/thiếu mã truy cập/i)).toBeInTheDocument()
  );
  expect(candidateAPI.getStatus).not.toHaveBeenCalled();
});

test('token hợp lệ -> hiện tên ứng viên + vị trí + thông điệp trạng thái', async () => {
  candidateAPI.getStatus.mockResolvedValue({
    data: {
      candidateName: 'Nguyễn Văn A',
      jobTitle: 'Kế toán tổng hợp',
      currentStage: 'INTERVIEW',
      stageLabel: 'Vòng phỏng vấn',
      statusMessage: 'Hồ sơ của bạn đang trong vòng phỏng vấn.',
      isClosed: false,
      isHired: false,
    },
  });

  renderAt('/status?token=6.abc');

  await waitFor(() =>
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
  );
  expect(candidateAPI.getStatus).toHaveBeenCalledWith('6.abc');
  expect(screen.getByText('Kế toán tổng hợp')).toBeInTheDocument();
  expect(screen.getByText(/đang trong vòng phỏng vấn/i)).toBeInTheDocument();
});

test('link hết hạn (API lỗi) -> hiện userMsg từ backend', async () => {
  candidateAPI.getStatus.mockRejectedValue({
    response: { data: { userMsg: 'Liên kết đã hết hạn. Vui lòng yêu cầu nhà tuyển dụng gửi lại.' } },
  });

  renderAt('/status?token=6.expired');

  await waitFor(() =>
    expect(screen.getByText(/Liên kết đã hết hạn/i)).toBeInTheDocument()
  );
});
