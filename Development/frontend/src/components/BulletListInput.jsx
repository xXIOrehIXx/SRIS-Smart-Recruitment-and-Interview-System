import React from "react";
import { Input, Button, Space } from "antd";
import { PlusOutlined, MinusCircleOutlined } from "@ant-design/icons";

/**
 * Danh sách gạch đầu dòng sửa tại chỗ — dùng cho Yêu cầu ứng viên, Quyền lợi của tin
 * tuyển dụng, và Quyền lợi mặc định ở hồ sơ công ty. Ba chỗ nhập y hệt nhau nên gom về
 * một component, khỏi chép JSX rồi sau này sửa lệch một bên.
 *
 * Giá trị là MẢNG chuỗi; component không tự lọc dòng trống — nơi gọi lọc lúc submit,
 * vì đang gõ dở mà bị xoá dòng là mất chữ.
 *
 * @param {string[]} items      các dòng hiện có (luôn còn ít nhất 1 dòng, có thể rỗng)
 * @param {string[]} hints      gợi ý placeholder cho các dòng đầu, hết thì dùng fallbackHint
 * @param {Function} onChange   (index, value)
 */
const BulletListInput = ({
  items,
  hints = [],
  fallbackHint = "",
  addLabel = "Thêm dòng",
  onAdd,
  onRemove,
  onChange,
  onInteract,
}) => (
  <Space direction="vertical" size={8} style={{ width: "100%" }}>
    {items.map((value, index) => (
      <Space.Compact key={index} style={{ width: "100%" }}>
        <Input
          value={value}
          placeholder={hints[index] || fallbackHint}
          onChange={(e) => {
            onChange(index, e.target.value);
            onInteract?.();
          }}
        />
        <Button
          icon={<MinusCircleOutlined />}
          aria-label="Xoá dòng"
          // Còn đúng 1 dòng thì khoá nút xoá: xoá nốt là không còn ô nào để gõ.
          disabled={items.length === 1}
          onClick={() => onRemove(index)}
        />
      </Space.Compact>
    ))}
    <Button type="dashed" icon={<PlusOutlined />} onClick={onAdd} block>
      {addLabel}
    </Button>
  </Space>
);

export default BulletListInput;
