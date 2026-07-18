import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Typography, Steps, Spin, Result, Tag } from 'antd';
import {
  FileTextOutlined, SearchOutlined, TeamOutlined, TrophyOutlined,
  CheckCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import { candidateAPI } from '../../services/api';

const { Title, Text } = Typography;

const MATCHA_GREEN = '#5D8C3E';

// 4 pha hiển thị cho ứng viên (docs 5.8): NEW → SCREENING → INTERVIEW → Quyết định
const STAGE_INDEX = { NEW: 0, SCREENING: 1, INTERVIEW: 2, OFFER: 3, HIRED: 3, REJECTED: 3 };

/**
 * Trang ứng viên xem trạng thái hồ sơ qua magic link STATUS (?token=...).
 * Link chỉ để XEM — token không bị đốt, xem lại được nhiều lần trong TTL.
 */
const CandidateStatus = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!token) {
        setError('Liên kết không hợp lệ — thiếu mã truy cập.');
        setLoading(false);
        return;
      }
      try {
        const response = await candidateAPI.getStatus(token);
        setStatus(response.data);
      } catch (err) {
        console.error('Error fetching status:', err);
        setError(
          err?.response?.data?.userMsg ||
          'Liên kết đã hết hạn hoặc không hợp lệ. Vui lòng liên hệ nhà tuyển dụng.'
        );
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, [token]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 560, margin: '48px auto', padding: '0 16px' }}>
        <Result status="warning" title="Không thể mở liên kết" subTitle={error} />
      </div>
    );
  }

  const current = STAGE_INDEX[status.currentStage] ?? 0;

  return (
    <div style={{ maxWidth: 640, margin: '48px auto', padding: '0 16px' }}>
      <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Title level={3} style={{ marginBottom: 4 }}>Trạng thái ứng tuyển</Title>
          <Text type="secondary">
            Xin chào <Text strong>{status.candidateName}</Text> — vị trí <Text strong>{status.jobTitle}</Text>
          </Text>
        </div>

        <Steps
          current={current}
          size="small"
          style={{ marginBottom: 28 }}
          items={[
            { title: 'Hồ sơ mới', icon: <FileTextOutlined /> },
            { title: 'Sàng lọc', icon: <SearchOutlined /> },
            { title: 'Phỏng vấn', icon: <TeamOutlined /> },
            { title: 'Quyết định', icon: <TrophyOutlined /> },
          ]}
        />

        <div style={{
          background: '#f6f8f4', borderRadius: 8, padding: '16px 20px', textAlign: 'center',
        }}>
          <div style={{ marginBottom: 8 }}>
            {status.isClosed ? (
              status.isHired ? (
                <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 14, padding: '4px 12px' }}>
                  {status.stageLabel}
                </Tag>
              ) : (
                <Tag icon={<CloseCircleOutlined />} color="default" style={{ fontSize: 14, padding: '4px 12px' }}>
                  {status.stageLabel}
                </Tag>
              )
            ) : (
              <Tag color={MATCHA_GREEN} style={{ fontSize: 14, padding: '4px 12px' }}>
                {status.stageLabel}
              </Tag>
            )}
          </div>
          <Text>{status.statusMessage}</Text>
          {status.updatedAt && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Cập nhật lần cuối: {new Date(status.updatedAt).toLocaleString('vi-VN')}
              </Text>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default CandidateStatus;
