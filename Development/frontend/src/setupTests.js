// Cấu hình chung cho Jest (CRA tự nạp file này trước mỗi test suite).
import '@testing-library/jest-dom';

// antd (Steps/Table...) cần ResizeObserver — jsdom không có sẵn.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// antd cần matchMedia — jsdom không có sẵn. Dùng HÀM THƯỜNG (không jest.fn):
// CRA bật resetMocks nên jest.fn sẽ bị xóa implementation trước mỗi test.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
