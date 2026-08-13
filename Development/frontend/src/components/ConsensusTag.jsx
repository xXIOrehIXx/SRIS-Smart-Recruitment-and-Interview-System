import React from 'react';
import { Tag, Tooltip, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * Mức đồng thuận của hội đồng ở MỘT tiêu chí.
 *
 * BE trả `stdDev` (độ lệch chuẩn) + cờ `needsDiscussion`. Con số độ lệch chuẩn từng được bày
 * thẳng ra bảng, nhưng người làm tuyển dụng không đọc được nó: "0.5" không nói lên điều gì nếu
 * chưa học thống kê. Ở đây chỉ hiện KẾT LUẬN bằng tiếng Việt, còn con số để trong tooltip cho
 * ai muốn soi. Một người chấm thì không có gì để so -> gạch ngang.
 */
const ConsensusTag = ({ stdDev, needsDiscussion, scoreCount }) => {
  if (!scoreCount || scoreCount < 2) {
    return (
      <Tooltip title="Chỉ có 1 người chấm — không có phiếu nào để so sánh">
        <Text type="secondary">—</Text>
      </Tooltip>
    );
  }

  const gap = `Mức chênh giữa các phiếu: ${stdDev} điểm`;

  if (needsDiscussion) {
    return (
      <Tooltip title={`${gap}. Hội đồng chấm lệch nhau nhiều ở tiêu chí này — nên trao đổi trước khi quyết.`}>
        <Tag icon={<WarningOutlined />} color="orange">Lệch nhiều</Tag>
      </Tooltip>
    );
  }

  if (Number(stdDev) === 0) {
    return (
      <Tooltip title="Mọi người chấm bằng điểm nhau">
        <Tag color="green">Khớp nhau</Tag>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={`${gap}. Chênh lệch nhỏ, coi như thống nhất.`}>
      <Tag>Lệch ít</Tag>
    </Tooltip>
  );
};

export default ConsensusTag;
