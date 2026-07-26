import React from "react";
import { render, act } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { useRefreshOnFocus } from "./useRefreshOnFocus";

// Component tối giản chỉ để chạy hook.
const Probe = ({ onRefresh, enabled = true, minIntervalMs = 5000 }) => {
  useRefreshOnFocus(onRefresh, { enabled, minIntervalMs });
  return null;
};

const fireFocus = () => {
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
};

describe("useRefreshOnFocus", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // jsdom mặc định visibilityState = 'visible'
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  });

  test("gọi refresh khi quay lại tab", () => {
    const refresh = vi.fn();
    render(<Probe onRefresh={refresh} />);

    expect(refresh).not.toHaveBeenCalled(); // không tự chạy lúc mount
    fireFocus();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("bỏ qua khi tab đang ẩn", () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const refresh = vi.fn();
    render(<Probe onRefresh={refresh} />);

    fireFocus();
    expect(refresh).not.toHaveBeenCalled();
  });

  test("chặn gọi dồn trong khoảng minIntervalMs", () => {
    const refresh = vi.fn();
    render(<Probe onRefresh={refresh} minIntervalMs={60000} />);

    fireFocus();
    fireFocus();
    fireFocus();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("enabled=false thì không đăng ký listener", () => {
    const refresh = vi.fn();
    render(<Probe onRefresh={refresh} enabled={false} />);

    fireFocus();
    expect(refresh).not.toHaveBeenCalled();
  });

  test("gỡ listener khi unmount", () => {
    const refresh = vi.fn();
    const { unmount } = render(<Probe onRefresh={refresh} />);

    unmount();
    fireFocus();
    expect(refresh).not.toHaveBeenCalled();
  });
});
