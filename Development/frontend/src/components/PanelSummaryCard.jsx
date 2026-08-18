import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Space, Spin, Tag, Typography, message } from 'antd';
import { RobotOutlined, ReloadOutlined } from '@ant-design/icons';
import { interviewAPI } from '../services/api';

const { Text, Paragraph } = Typography;

/**
 * AI tổng hợp ý kiến hội đồng phỏng vấn (V047).
 *
 * Người quyết phải đọc 3-5 phiếu chấm dài để biết hội đồng thống nhất tới đâu; khối này rút
 * gọn việc đó: một đoạn tổng hợp + điểm đồng ý + điểm MÂU THUẪN (thứ đáng nhìn nhất) + những
 * chỗ nên hỏi thêm.
 *
 * RANH GIỚI: bản tổng hợp KHÔNG kết luận nên tuyển hay không — backend cũng không trả về
 * trường nào như vậy. Các phiếu gốc vẫn nằm ngay bên dưới và vẫn là căn cứ chính thức; đây chỉ
 * là bản đọc nhanh. Đừng thêm nút "AI đề xuất tuyển" vào đây.
 *
 * Chạy NỀN: POST chỉ xếp hàng, sau đó hỏi lại tới khi running=false (Local LLM trên CPU mất
 * hàng chục giây, gọi đồng bộ là axios cắt ngang giữa chừng).
 */
const POLL_MS = 3000;
const MAX_POLLS = 80; // ~4 phút, rộng hơn timeout của backend một chút

const PanelSummaryCard = ({ applicationId, disabled }) => {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const pollRef = useRef(null);
  const pollCount = useRef(0);

  const stopPolling = () => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  };

  const fetchStatus = useCallback(async ({ silent } = {}) => {
    if (!applicationId) return null;
    if (!silent) setLoading(true);
    try {
      const res = await interviewAPI.getPanelSummary(applicationId);
      setState(res.data || null);
      return res.data || null;
    } catch (error) {
      console.error('Error fetching panel summary:', error);
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [applicationId]);

  // Mở modal / đổi ứng viên -> nạp trạng thái, và nếu lượt trước còn đang chạy thì hỏi tiếp.
  useEffect(() => {
    pollCount.current = 0;
    stopPolling();
    setState(null);
    if (!applicationId) return undefined;

    let cancelled = false;
    const poll = async () => {
      const data = await fetchStatus({ silent: pollCount.current > 0 });
      if (cancelled) return;
      if (data?.running && pollCount.current < MAX_POLLS) {
        pollCount.current += 1;
        pollRef.current = setTimeout(poll, POLL_MS);
      }
    };
    poll();

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [applicationId, fetchStatus]);

  const handleRequest = async () => {
    setRequesting(true);
    stopPolling();
    pollCount.current = 0;
    try {
      const res = await interviewAPI.requestPanelSummary(applicationId);
      setState(res.data || null);

      const poll = async () => {
        const data = await fetchStatus({ silent: true });
        if (data?.running && pollCount.current < MAX_POLLS) {
          pollCount.current += 1;
          pollRef.current = setTimeout(poll, POLL_MS);
        }
      };
      pollRef.current = setTimeout(poll, POLL_MS);
    } catch (error) {
      console.error('Error requesting panel summary:', error);
      message.error(
        error?.response?.data?.userMsg || 'Không tổng hợp được ý kiến hội đồng'
      );
    } finally {
      setRequesting(false);
    }
  };

  const result = state?.result || null;
  const running = Boolean(state?.running);
  // Có người nộp phiếu SAU khi tổng hợp -> bản đang đọc thiếu phiếu. Nói thẳng ra, đừng để
  // người quyết đọc một bản cũ mà tưởng là đủ.
  const stale =
    result && state?.currentVerdictCount > (result.sourceVerdictCount || 0);

  const bulletList = (items, color) => (
    <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
      {items.map((x, i) => (
        <li key={i} style={{ marginBottom: 2 }}>
          <Text style={{ fontSize: 13, color }}>{x}</Text>
        </li>
      ))}
    </ul>
  );

  return (
    <Card
      size="small"
      style={{ marginTop: 12, background: '#FAFBF8' }}
      title={
        <Space size={6}>
          <RobotOutlined />
          <Text strong style={{ fontSize: 13 }}>AI tổng hợp ý kiến hội đồng</Text>
        </Space>
      }
      extra={
        <Button
          type="link"
          size="small"
          icon={result ? <ReloadOutlined /> : <RobotOutlined />}
          loading={requesting || running}
          disabled={disabled || requesting || running}
          onClick={handleRequest}
        >
          {running ? 'Đang tổng hợp...' : result ? 'Tổng hợp lại' : 'Tổng hợp'}
        </Button>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 12 }}><Spin size="small" /></div>
      ) : running ? (
        <Text type="secondary" style={{ fontSize: 13 }}>
          AI đang đọc các phiếu chấm — mất khoảng nửa phút, không cần tải lại trang.
        </Text>
      ) : state?.status === 'FAILED' ? (
        <Alert
          type="warning"
          showIcon
          message={state.errorMessage || 'AI chưa tổng hợp được các phiếu chấm.'}
        />
      ) : !result ? (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {disabled
            ? 'Chưa có phiếu chấm nào được nộp — chưa có ý kiến để tổng hợp.'
            : 'Bấm "Tổng hợp" để AI đọc các phiếu chấm và chỉ ra hội đồng đồng ý ở đâu, lệch nhau ở đâu. Đây là bản đọc nhanh — quyết định vẫn dựa trên phiếu gốc bên dưới.'}
        </Text>
      ) : (
        <>
          {stale && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 8 }}
              message={`Có thêm phiếu chấm mới sau lần tổng hợp này (đã đọc ${result.sourceVerdictCount}/${state.currentVerdictCount} phiếu) — bấm "Tổng hợp lại" để cập nhật.`}
            />
          )}

          <Paragraph style={{ fontSize: 13, marginBottom: 8 }}>{result.consensus}</Paragraph>

          {result.agreements.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <Tag color="green">Cả hội đồng cùng thấy</Tag>
              {bulletList(result.agreements)}
            </div>
          )}

          {result.disagreements.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <Tag color="orange">Ý kiến lệch nhau</Tag>
              {bulletList(result.disagreements)}
            </div>
          )}

          {result.openQuestions.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <Tag>Nên hỏi thêm</Tag>
              {bulletList(result.openQuestions)}
            </div>
          )}

          <Text type="secondary" style={{ fontSize: 12 }}>
            Tóm tắt từ {result.sourceVerdictCount} phiếu chấm. AI không đề xuất tuyển hay loại —
            đọc phiếu gốc bên dưới trước khi quyết.
          </Text>
        </>
      )}
    </Card>
  );
};

export default PanelSummaryCard;
