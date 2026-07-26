import { useEffect, useRef } from "react";

/**
 * Gọi lại `refresh` khi người dùng quay lại tab/cửa sổ này.
 *
 * Lý do: state hồ sơ đổi ở NƠI KHÁC (duyệt tiêu chí, mời phỏng vấn, gửi offer, DM duyệt tuyển
 * đều tự đẩy state) — tab Kanban mở sẵn từ trước sẽ hiện cột cũ cho tới khi F5. Điều hướng
 * trong app thì component remount nên đã tự fetch; cái này chỉ vá trường hợp tab để nền.
 *
 * Có `minIntervalMs` để tránh gọi API dồn khi người dùng bật/tắt tab liên tục.
 */
export function useRefreshOnFocus(refresh, { enabled = true, minIntervalMs = 5000 } = {}) {
  // Giữ ref để không phải đăng ký lại listener mỗi lần component render ra hàm mới.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const lastRunRef = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;

    const run = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRunRef.current < minIntervalMs) return;
      lastRunRef.current = now;
      refreshRef.current?.();
    };

    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
    return () => {
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", run);
    };
  }, [enabled, minIntervalMs]);
}

export default useRefreshOnFocus;
