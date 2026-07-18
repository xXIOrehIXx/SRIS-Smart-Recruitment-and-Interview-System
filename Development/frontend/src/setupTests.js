// Cấu hình chung cho Vitest (nạp qua vite.config.ts > test.setupFiles).
import '@testing-library/jest-dom/vitest';

// antd (Steps/Table...) cần ResizeObserver — jsdom không có sẵn.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// antd cần matchMedia — jsdom không có sẵn.
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
