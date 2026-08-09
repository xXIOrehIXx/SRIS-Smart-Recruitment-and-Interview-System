import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Card, Typography, Button, Space, Descriptions, Divider, Avatar,
  Popconfirm, Spin, Result, message, Row, Col,
} from 'antd';
import {
  ArrowLeftOutlined, UserOutlined, MailOutlined, FileTextOutlined,
  CheckCircleOutlined, CloseCircleOutlined, StopOutlined, SendOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { offerAPI, applicationAPI } from '../../services/api';
import { getStatusTag, getAppStatusTag, formatSalary, MATCHA_GREEN } from './offerDisplay';
import '../Dashboard.css';

const { Title, Text } = Typography;

/**
 * TRANG chi tiết thư mời nhận việc (Human Resource) — /offers/:applicationId.
 *
 * Là một trang riêng chứ không phải ngăn kéo trượt ra trên danh sách: đây là văn bản chính thức
 * đã gửi đi, người dùng cần đọc kỹ, cuộn, gửi link cho đồng nghiệp xem, và bấm những nút chốt
 * hồ sơ (nhận việc / từ chối / thu hồi). Việc đó xứng đáng có địa chỉ URL riêng và nút Back của
 * trình duyệt hoạt động đúng.
 */
const OfferDetail = () => {
  const navigate = useNavigate();
  const { applicationId } = useParams();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState(null);
  const [application, setApplication] = useState(null);
  const [acting, setActing] = useState(false);

  // Quay lại ĐÚNG tin tuyển dụng vừa xem. Danh sách thư mời lọc theo từng tin, nên trả về
  // "/offers" trơn là nó tự chọn tin đầu bảng — người dùng bấm Back xong không thấy ứng viên
  // mình vừa mở đâu nữa. Ưu tiên jobId trên URL, thiếu thì lấy từ chính hồ sơ.
  const jobId = searchParams.get('jobId') || application?.jobId;
  const backToList = () => navigate(jobId ? `/offers?jobId=${jobId}` : '/offers');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Hồ sơ và thư mời là 2 nguồn: thư mời giữ nội dung lá thư, hồ sơ giữ tên/email ứng viên.
      // Gọi song song và cho phép thư mời 404 (hồ sơ chưa gửi thư) mà không làm hỏng cả trang.
      const [appRes, offerRes] = await Promise.all([
        applicationAPI.getById(applicationId),
        offerAPI.getByApplication(applicationId).catch(() => null),
      ]);
      setApplication(appRes.data || null);
      setOffer(offerRes?.data || null);
    } catch (error) {
      console.error('Error loading offer detail:', error);
      message.error(error?.response?.data?.userMsg || 'Không tải được thư mời');
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleRecordOutcome = async (accepted) => {
    try {
      setActing(true);
      await offerAPI.recordOutcome(applicationId, accepted, null);
      message.success(accepted
        ? 'Đã ghi nhận ứng viên nhận việc (hồ sơ chuyển sang Trúng tuyển).'
        : 'Đã ghi nhận ứng viên từ chối (hồ sơ chuyển sang Từ chối).');
      fetchAll();
    } catch (error) {
      message.error(error?.response?.data?.userMsg || 'Không thể ghi nhận kết quả');
    } finally {
      setActing(false);
    }
  };

  const handleResend = async () => {
    try {
      setActing(true);
      await applicationAPI.createMagicLink(applicationId, 'OFFER_RESPONSE');
      message.success(`Đã gửi lại thư mời tới ${application?.candidateEmail || 'ứng viên'}.`);
    } catch (error) {
      message.error(error?.response?.data?.userMsg || 'Không thể gửi lại thư mời');
    } finally {
      setActing(false);
    }
  };

  const handleWithdraw = async () => {
    try {
      setActing(true);
      await applicationAPI.reject(applicationId, 'Công ty thu hồi thư mời');
      message.success('Đã thu hồi thư mời (hồ sơ chuyển sang Từ chối)');
      fetchAll();
    } catch (error) {
      message.error(error?.response?.data?.userMsg || 'Không thể thu hồi thư mời');
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" tip="Đang tải thư mời..." />
      </div>
    );
  }

  if (!offer) {
    return (
      <Result
        status="404"
        title="Chưa có thư mời"
        subTitle="Hồ sơ này chưa được gửi thư mời nhận việc."
        extra={<Button type="primary" onClick={backToList}>Về danh sách thư mời</Button>}
      />
    );
  }

  const isPending = offer.status === 'PENDING';

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={backToList} />
          <div>
            <Title level={3} className="page-title">Chi tiết thư mời</Title>
            <Text type="secondary">
              Hồ sơ #{offer.applicationId} • {application?.jobTitle || offer.jobTitle || '—'}
            </Text>
          </div>
        </div>
        <Space>
          {getStatusTag(offer.status)}
          {application?.currentState && getAppStatusTag(application.currentState)}
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card
            title={<Space><UserOutlined style={{ color: MATCHA_GREEN }} />Ứng viên</Space>}
            style={{ height: '100%' }}
          >
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Space>
                <Avatar size={44} style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{application?.candidateName || '—'}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <MailOutlined /> {application?.candidateEmail || '—'}
                  </Text>
                </div>
              </Space>

              <Divider style={{ margin: '4px 0 8px' }} />

              <Descriptions column={1} size="small" colon={false}>
                <Descriptions.Item label="Điện thoại">{application?.candidatePhone || '—'}</Descriptions.Item>
                <Descriptions.Item label="Nguồn hồ sơ">{application?.candidateSource || '—'}</Descriptions.Item>
                <Descriptions.Item label="Địa chỉ trên thư">{offer.candidateAddress || '—'}</Descriptions.Item>
              </Descriptions>

              {/* Ứng viên trả lời bằng cách Reply chính email thư mời, không bấm gì trong hệ thống. */}
              <Text type="secondary" style={{ fontSize: 12 }}>
                Ứng viên đã nhận nguyên lá thư trong email và trả lời bằng cách phản hồi email đó.
              </Text>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card title={<Space><FileTextOutlined style={{ color: MATCHA_GREEN }} />Nội dung thư mời</Space>}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
              <Descriptions.Item label="Vị trí">{offer.jobTitle || '—'}</Descriptions.Item>
              <Descriptions.Item label="Phòng ban">{offer.department || '—'}</Descriptions.Item>
              <Descriptions.Item label="Báo cáo cho">{offer.reportingTo || '—'}</Descriptions.Item>
              <Descriptions.Item label="Hình thức">{offer.employmentType || '—'}</Descriptions.Item>
              <Descriptions.Item label="Địa điểm">{offer.workLocation || '—'}</Descriptions.Item>
              <Descriptions.Item label="Ngày bắt đầu">
                {offer.startDate ? dayjs(offer.startDate).format('DD/MM/YYYY') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Mức lương">
                <Text strong style={{ color: MATCHA_GREEN }}>{formatSalary(offer)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Thưởng/Ưu đãi">{offer.bonus || '—'}</Descriptions.Item>
              <Descriptions.Item label="Phúc lợi" span={2}>
                <span style={{ whiteSpace: 'pre-wrap' }}>{offer.benefits || '—'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Điều khoản" span={2}>
                <span style={{ whiteSpace: 'pre-wrap' }}>{offer.terms || '—'}</span>
              </Descriptions.Item>
            </Descriptions>

            {offer.note && (
              <>
                <Divider style={{ margin: '16px 0 12px' }} />
                <Title level={5} style={{ marginBottom: 8 }}>Lời nhắn kèm thư</Title>
                <div style={{
                  background: '#f5f5f4', padding: 12, borderRadius: 8,
                  whiteSpace: 'pre-wrap', fontSize: 13,
                }}>
                  {offer.note}
                </div>
              </>
            )}

            <Divider style={{ margin: '16px 0 12px' }} />

            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Người ký">
                {offer.signerName
                  ? `${offer.signerName}${offer.signerTitle ? ` — ${offer.signerTitle}` : ''}`
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Liên hệ nhân sự">
                {offer.hrContactName || offer.hrContactEmail || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Đã gửi lúc">
                {offer.sentAt ? dayjs(offer.sentAt).format('DD/MM/YYYY HH:mm') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Hạn phản hồi">
                {offer.expiresAt ? dayjs(offer.expiresAt).format('DD/MM/YYYY') : '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      {offer.respondedAt && (
        <Card style={{ marginTop: 16 }} title="Kết quả đã ghi nhận">
          <Space direction="vertical" size={6}>
            {getStatusTag(offer.status)}
            <Text type="secondary" style={{ fontSize: 13 }}>
              Ghi nhận lúc {dayjs(offer.respondedAt).format('DD/MM/YYYY HH:mm')}
            </Text>
            {offer.outcomeNote && (
              <div style={{
                background: '#f5f5f4', padding: 12, borderRadius: 8,
                fontSize: 13, whiteSpace: 'pre-wrap',
              }}>
                {offer.outcomeNote}
              </div>
            )}
          </Space>
        </Card>
      )}

      {isPending && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <Space>
              <Button icon={<SendOutlined />} loading={acting} onClick={handleResend}>
                Gửi lại thư mời
              </Button>
              <Popconfirm
                title="Thu hồi thư mời này?"
                description="Hồ sơ sẽ chuyển sang Từ chối."
                onConfirm={handleWithdraw}
                okText="Thu hồi"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<StopOutlined />} loading={acting}>Thu hồi</Button>
              </Popconfirm>
            </Space>
            <Space>
              <Popconfirm
                title="Ứng viên từ chối?"
                description="Hồ sơ sẽ chuyển sang Từ chối."
                onConfirm={() => handleRecordOutcome(false)}
                okText="Xác nhận" cancelText="Hủy" okButtonProps={{ danger: true }}
              >
                <Button icon={<CloseCircleOutlined />} loading={acting}>Từ chối</Button>
              </Popconfirm>
              <Popconfirm
                title="Ứng viên đã nhận việc?"
                description="Hồ sơ sẽ chuyển sang Trúng tuyển."
                onConfirm={() => handleRecordOutcome(true)}
                okText="Xác nhận" cancelText="Hủy"
              >
                <Button type="primary" icon={<CheckCircleOutlined />} loading={acting}
                  style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}>
                  Đã nhận việc
                </Button>
              </Popconfirm>
            </Space>
          </div>
        </Card>
      )}
    </div>
  );
};

export default OfferDetail;
