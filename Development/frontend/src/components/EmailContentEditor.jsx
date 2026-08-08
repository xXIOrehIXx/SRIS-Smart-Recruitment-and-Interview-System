import React, { useEffect, useRef, useState } from "react";
import { Button, Dropdown, Space, Tooltip, Typography } from "antd";
import {
  BoldOutlined,
  ItalicOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  LinkOutlined,
  TagOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

/**
 * Ô soạn nội dung email cho người tuyển dụng — KHÔNG bắt họ nhìn HTML.
 *
 * Người dùng gõ như trong Word (đậm/nghiêng/danh sách/liên kết) và chèn thông tin tự động
 * bằng nút "Chèn thông tin"; bên dưới vẫn lưu HTML để gửi đi. Chỉ soạn RUỘT thư — logo,
 * màu thương hiệu và chân trang do hệ thống bọc lúc gửi, nên không thể lỡ tay làm vỡ khung email.
 *
 * Dùng contentEditable + document.execCommand thay vì thêm thư viện soạn thảo: chỉ cần
 * đậm/nghiêng/danh sách/link, mà mọi trình duyệt đều hỗ trợ sẵn — thêm một thư viện nữa
 * chỉ để làm bấy nhiêu là không đáng.
 */

/** Thông tin hệ thống tự điền — ĐẶT TÊN THEO NGƯỜI DÙNG, không phải theo tên biến. */
export const EMAIL_VARIABLES = [
  { key: "candidateName", label: "Tên ứng viên", sample: "Nguyễn Văn An" },
  { key: "jobTitle", label: "Vị trí ứng tuyển", sample: "Lập trình viên Backend" },
  { key: "companyName", label: "Tên công ty", sample: "Công ty Demo" },
  { key: "link", label: "Nút/liên kết cho ứng viên", sample: "https://…" },
  { key: "expiresAt", label: "Hạn dùng của liên kết", sample: "20/08/2026 17:00" },
  { key: "startTime", label: "Giờ phỏng vấn", sample: "09:00 20/08/2026" },
  { key: "reason", label: "Lý do hủy lịch", sample: "Người phỏng vấn bận đột xuất" },
  { key: "startDate", label: "Ngày vào làm", sample: "01/09/2026" },
  { key: "companyAddress", label: "Địa chỉ công ty", sample: "68 Nguyễn Huệ, Quận 1" },
  { key: "hrEmail", label: "Email bộ phận nhân sự", sample: "tuyendung@congty.vn" },
  { key: "emailDomain", label: "Tên miền email nội bộ", sample: "congty.vn" },
];

/** Giá trị mẫu để xem trước — thay chỗ {{...}} bằng dữ liệu giả cho dễ hình dung. */
export const fillSampleValues = (html) =>
  (html || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) => {
    const found = EMAIL_VARIABLES.find((v) => v.key.toLowerCase() === key.toLowerCase());
    return found ? found.sample : m;
  });

const EmailContentEditor = ({ value, onChange, height = 320 }) => {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);

  // Chỉ nạp lại HTML từ ngoài khi ô KHÔNG được focus: nạp trong lúc gõ sẽ nhảy con trỏ về đầu.
  useEffect(() => {
    if (!focused && ref.current && ref.current.innerHTML !== (value || "")) {
      ref.current.innerHTML = value || "";
    }
  }, [value, focused]);

  const emit = () => onChange?.(ref.current?.innerHTML ?? "");

  const exec = (command, arg) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const insertVariable = (key) => {
    ref.current?.focus();
    document.execCommand("insertText", false, `{{${key}}}`);
    emit();
  };

  const insertLink = () => {
    const url = window.prompt("Dán địa chỉ liên kết (bắt đầu bằng https://):");
    if (url) exec("createLink", url);
  };

  return (
    <div style={{ border: "1px solid #d9d9d9", borderRadius: 8, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "6px 8px",
          borderBottom: "1px solid #f0f0f0",
          background: "#fafafa",
          flexWrap: "wrap",
        }}
      >
        <Tooltip title="In đậm">
          <Button size="small" type="text" icon={<BoldOutlined />} onClick={() => exec("bold")} />
        </Tooltip>
        <Tooltip title="In nghiêng">
          <Button size="small" type="text" icon={<ItalicOutlined />} onClick={() => exec("italic")} />
        </Tooltip>
        <Tooltip title="Danh sách gạch đầu dòng">
          <Button size="small" type="text" icon={<UnorderedListOutlined />}
                  onClick={() => exec("insertUnorderedList")} />
        </Tooltip>
        <Tooltip title="Danh sách đánh số">
          <Button size="small" type="text" icon={<OrderedListOutlined />}
                  onClick={() => exec("insertOrderedList")} />
        </Tooltip>
        <Tooltip title="Chèn liên kết">
          <Button size="small" type="text" icon={<LinkOutlined />} onClick={insertLink} />
        </Tooltip>

        <div style={{ flex: 1 }} />

        <Dropdown
          menu={{
            items: EMAIL_VARIABLES.map((v) => ({
              key: v.key,
              label: (
                <Space direction="vertical" size={0}>
                  <span>{v.label}</span>
                  <Text type="secondary" style={{ fontSize: 11 }}>ví dụ: {v.sample}</Text>
                </Space>
              ),
            })),
            onClick: ({ key }) => insertVariable(key),
          }}
          trigger={["click"]}
        >
          <Button size="small" icon={<TagOutlined />}>Chèn thông tin</Button>
        </Dropdown>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={() => { setFocused(false); emit(); }}
        onFocus={() => setFocused(true)}
        style={{
          minHeight: height,
          maxHeight: 520,
          overflowY: "auto",
          padding: "14px 16px",
          outline: "none",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 14,
          lineHeight: 1.6,
          background: "#fff",
        }}
      />
    </div>
  );
};

export default EmailContentEditor;
