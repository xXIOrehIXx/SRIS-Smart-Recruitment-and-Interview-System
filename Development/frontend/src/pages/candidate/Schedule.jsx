import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Typography,
  Button,
  Tag,
  Descriptions,
  Result,
  Spin,
  Radio,
  message,
  Alert,
  Space,
  Divider,
} from 'antd';
import {
  ClockCircleOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { candidateAPI } from '../../services/api';
import './css/Schedule.css';

const { Header, Content, Footer } = Layout;
const { Title, Text, Paragraph } = Typography;

const MATCHA_GREEN = '#5D8C3E';

// BE schema (CandidateScheduleDtos.cs):
//   CandidateSlotDto       { SlotId, StartTime }      → chỉ 2 field, không lộ interviewer
//   CandidateScheduleDto   { ScheduleId, RoundNumber, Status, Slots[], ConfirmedSlot? }
//   Status: PENDING | CONFIRMED | NO_SLOT_FITS | CANCELLED
//   PENDING + có PoolId    → Slots là các khung OPEN + tương lai
//   CONFIRMED + ConfirmedSlotId → ConfirmedSlot có giá trị, Slots rỗng

const STATUS_META = {
  PENDING: {
    color: 'warning',
    label: 'Chờ bạn chọn khung giờ',
    tone: 'gold',
  },
  CONFIRMED: {
    color: 'success',
    label: 'Đã xác nhận',
    tone: 'green',
  },
  NO_SLOT_FITS: {
    color: 'default',
    label: 'Bạn đã báo không khung phù hợp',
    tone: 'mute',
  },
  CANCELLED: {
    color: 'error',
    label: 'Lịch đã bị hủy',
    tone: 'red',
  },
};

const Logo = () => (
  <div className="header-logo">
    <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="12" fill={MATCHA_GREEN} />
      <path
        d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.8956 14 32V16Z"
        stroke="white"
        strokeWidth="2.5"
      />
      <path d="M20 22L24 26L28 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 18V26" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
    <span>SRIS</span>
  </div>
);

const Schedule = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scheduleData, setScheduleData] = useState(null);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(null); // 'confirmed' | 'no-slot'
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    if (token) {
      fetchSchedule();
    } else {
      setError('Token không hợp lệ hoặc đã hết hạn.');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const response = await candidateAPI.getSchedule(token);
      setScheduleData(response.data);
    } catch (err) {
      console.error('Error fetching schedule:', err);
      const errorMsg =
        err?.response?.data?.message ||
        err?.response?.data?.userMsg ||
        err?.response?.data ||
        'Không thể tải thông tin lịch phỏng vấn. Liên kết có thể đã hết hạn.';
      setError(typeof errorMsg === 'string' ? errorMsg : 'Liên kết đã hết hạn hoặc không hợp lệ.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedSlot) {
      message.warning('Vui lòng chọn một khung giờ phỏng vấn.');
      return;
    }
    try {
      setSubmitting(true);
      await candidateAPI.confirmSchedule(token, selectedSlot);
      message.success('Đã chốt lịch thành công.');
      setSubmitted('confirmed');
    } catch (err) {
      console.error('Error confirming schedule:', err);
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.userMsg ||
        'Không thể xác nhận lịch. Vui lòng thử lại.';
      message.error(errMsg);
      // 409 (slot vừa bị người khác đặt) → refetch để ẩn khung đã mất
      if (err?.response?.status === 409) {
        await fetchSchedule();
        setSelectedSlot(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleNoSlot = async () => {
    try {
      setSubmitting(true);
      await candidateAPI.noSlotAvailable(token);
      message.success('Đã ghi nhận phản hồi của bạn.');
      setSubmitted('no-slot');
    } catch (err) {
      console.error('Error reporting no slot:', err);
      message.error(
        err?.response?.data?.message ||
          err?.response?.data?.userMsg ||
          'Không thể gửi phản hồi. Vui lòng thử lại.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ===========================================================
  // Render: Loading
  // ===========================================================
  if (loading) {
    return (
      <Layout className="schedule-layout">
        <Header className="sch-header">
          <Logo />
        </Header>
        <Content className="sch-content">
          <div style={{ textAlign: 'center', padding: 80 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">Đang tải thông tin lịch phỏng vấn...</Text>
            </div>
          </div>
        </Content>
      </Layout>
    );
  }

  // ===========================================================
  // Render: Error
  // ===========================================================
  if (error) {
    return (
      <Layout className="schedule-layout">
        <Header className="sch-header">
          <Logo />
        </Header>
        <Content className="sch-content">
          <Result
            status="error"
            icon={<CloseCircleOutlined style={{ color: '#f5222d' }} />}
            title="Không thể tải lịch phỏng vấn"
            subTitle={error}
            extra={
              <Button type="primary" onClick={() => window.close()}>
                Đóng
              </Button>
            }
          />
        </Content>
        <Footer className="sch-footer">
          <Text type="secondary">© 2026 SRIS - Smart Recruitment & Interview System</Text>
        </Footer>
      </Layout>
    );
  }

  // ===========================================================
  // Render: Sau khi confirm thành công (PENDING → CONFIRMED)
  // ===========================================================
  if (submitted === 'confirmed') {
    const confirmedSlot = scheduleData?.confirmedSlot; // backend đã set ConfirmedSlot ở response confirm
    return (
      <Layout className="schedule-layout">
        <Header className="sch-header">
          <Logo />
        </Header>
        <Content className="sch-content">
          <Result
            status="success"
            icon={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: 72 }} />}
            title="Xác nhận lịch phỏng vấn thành công!"
            subTitle={
              <div>
                {confirmedSlot?.startTime && (
                  <Paragraph style={{ marginTop: 8 }}>
                    <CalendarOutlined /> Khung giờ bạn đã chọn:{' '}
                    <Text strong>
                      {dayjs(confirmedSlot.startTime).format('dddd, DD/MM/YYYY — HH:mm')}
                    </Text>
                  </Paragraph>
                )}
                <Paragraph style={{ color: '#666' }}>
                  Chúng tôi sẽ gửi email xác nhận kèm lịch phỏng vấn chi tiết trong thời gian sớm nhất.
                </Paragraph>
              </div>
            }
            extra={
              <Button type="primary" onClick={() => window.close()}>
                Đóng
              </Button>
            }
          />
        </Content>
        <Footer className="sch-footer">
          <Text type="secondary">© 2026 SRIS - Smart Recruitment & Interview System</Text>
        </Footer>
      </Layout>
    );
  }

  // ===========================================================
  // Render: Sau khi báo không có khung phù hợp
  // ===========================================================
  if (submitted === 'no-slot') {
    return (
      <Layout className="schedule-layout">
        <Header className="sch-header">
          <Logo />
        </Header>
        <Content className="sch-content">
          <Result
            status="info"
            icon={<ClockCircleOutlined style={{ color: MATCHA_GREEN, fontSize: 72 }} />}
            title="Phản hồi của bạn đã được ghi nhận"
            subTitle={
              <Paragraph style={{ color: '#666' }}>
                Bộ phận tuyển dụng sẽ liên hệ với bạn để sắp xếp khung giờ khác.
              </Paragraph>
            }
            extra={
              <Button type="primary" onClick={() => window.close()}>
                Đóng
              </Button>
            }
          />
        </Content>
        <Footer className="sch-footer">
          <Text type="secondary">© 2026 SRIS - Smart Recruitment & Interview System</Text>
        </Footer>
      </Layout>
    );
  }

  // ===========================================================
  // Render: Form chính
  // ===========================================================
  const status = scheduleData?.status || 'PENDING';
  const meta = STATUS_META[status] || STATUS_META.PENDING;
  const slots = scheduleData?.slots || [];
  const confirmedSlot = scheduleData?.confirmedSlot;
  const roundNumber = scheduleData?.roundNumber;

  return (
    <Layout className="schedule-layout">
      <Header className="sch-header">
        <Logo />
        <Tag color={meta.color} icon={<CalendarOutlined />}>
          {meta.label}
        </Tag>
      </Header>

      <Content className="sch-content">
        <div className="sch-container">
          {/* Hero */}
          <div className="sch-hero">
            <div className="sch-hero-icon">
              <CalendarOutlined />
            </div>
            <Title level={2} className="sch-hero-title">
              {status === 'PENDING' && 'Chọn lịch phỏng vấn'}
              {status === 'CONFIRMED' && 'Lịch phỏng vấn của bạn'}
              {status === 'NO_SLOT_FITS' && 'Chưa có khung phù hợp'}
              {status === 'CANCELLED' && 'Lịch đã bị hủy'}
            </Title>
            <Paragraph className="sch-hero-subtitle">
              {status === 'PENDING' &&
                'Vui lòng chọn một khung giờ phỏng vấn phù hợp. Sau khi chốt, bạn sẽ nhận email xác nhận.'}
              {status === 'CONFIRMED' &&
                'Bạn đã chốt khung giờ phỏng vấn. Vui lòng có mặt đúng giờ.'}
              {status === 'NO_SLOT_FITS' &&
                'Bạn đã phản hồi rằng chưa có khung phù hợp. Bộ phận tuyển dụng sẽ liên hệ lại.'}
              {status === 'CANCELLED' &&
                'Lịch này đã bị hủy. Nếu có thắc mắc, vui lòng liên hệ bộ phận nhân sự.'}
            </Paragraph>
          </div>

          {/* Thông tin vòng */}
          {roundNumber !== undefined && (
            <Alert
              message={`Vòng phỏng vấn số ${roundNumber}`}
              type="info"
              showIcon
              className="sch-info-alert"
              style={{ marginBottom: 16 }}
            />
          )}

          {/* ============== PENDING: chọn slot ============== */}
          {status === 'PENDING' && (
            <Card className="sch-slots-card">
              <div className="sch-slots-header">
                <Title level={4} style={{ margin: 0 }}>
                  <CalendarOutlined /> Khung giờ khả dụng
                </Title>
                <Text type="secondary">Chọn 1 khung bên dưới</Text>
              </div>

              {slots.length === 0 ? (
                <Alert
                  message="Hiện chưa có khung giờ nào được mở"
                  description={
                    <div>
                      <Paragraph>
                        Vui lòng liên hệ bộ phận tuyển dụng, hoặc bấm "Báo không có khung phù hợp" bên dưới
                        để nhân sự biết và mở vòng mới cho bạn.
                      </Paragraph>
                    </div>
                  }
                  type="warning"
                  showIcon
                />
              ) : (
                <>
                  <Alert
                    type="info"
                    icon={<ExclamationCircleOutlined />}
                    message="Vì có nhiều ứng viên cùng chọn pool này — khung vừa có người đặt sẽ tự biến mất. Nếu bấm Xác nhận mà khung đã hết, vui lòng chọn khung khác."
                    style={{ marginBottom: 16 }}
                  />
                  <Radio.Group
                    onChange={(e) => setSelectedSlot(e.target.value)}
                    value={selectedSlot}
                    className="sch-slots-group"
                    style={{ width: '100%' }}
                  >
                    <div className="sch-slots-list">
                      {slots.map((slot) => {
                        const start = slot.startTime ? dayjs(slot.startTime) : null;
                        return (
                          <Card
                            key={slot.slotId}
                            className={`sch-slot-card ${selectedSlot === slot.slotId ? 'selected' : ''}`}
                            hoverable
                            onClick={() => setSelectedSlot(slot.slotId)}
                          >
                            <Radio value={slot.slotId} onClick={(e) => e.stopPropagation()}>
                              <div className="sch-slot-content">
                                <div className="sch-slot-date">
                                  <CalendarOutlined />{' '}
                                  {start ? start.format('dddd, DD/MM/YYYY') : '—'}
                                </div>
                                <div className="sch-slot-time">
                                  <ClockCircleOutlined />{' '}
                                  {start ? start.format('HH:mm') : '—'}
                                </div>
                                {start && (
                                  <Tag color="green" style={{ marginTop: 6 }}>
                                    Còn{' '}
                                    {Math.max(
                                      0,
                                      Math.ceil((start.valueOf() - Date.now()) / (1000 * 60 * 60 * 24))
                                    )}{' '}
                                    ngày nữa
                                  </Tag>
                                )}
                              </div>
                            </Radio>
                          </Card>
                        );
                      })}
                    </div>
                  </Radio.Group>
                </>
              )}

              <Divider />

              <div className="sch-actions">
                <Button
                  type="primary"
                  size="large"
                  icon={<CheckCircleOutlined />}
                  onClick={handleConfirm}
                  loading={submitting}
                  disabled={!selectedSlot || slots.length === 0}
                  className="sch-confirm-btn"
                >
                  Xác nhận lịch phỏng vấn
                </Button>

                <Button
                  size="large"
                  onClick={handleNoSlot}
                  loading={submitting}
                  className="sch-no-slot-btn"
                >
                  <ClockCircleOutlined /> Báo không có khung phù hợp
                </Button>
              </div>
            </Card>
          )}

          {/* ============== CONFIRMED: hiển thị khung đã chốt ============== */}
          {status === 'CONFIRMED' && confirmedSlot && (
            <Card className="sch-confirmed-card">
              <Descriptions
                column={1}
                size="large"
                bordered
                title={
                  <Space>
                    <CheckCircleOutlined style={{ color: MATCHA_GREEN, fontSize: 20 }} />
                    <Text strong>Thông tin buổi phỏng vấn</Text>
                  </Space>
                }
              >
                <Descriptions.Item label="Vòng">{roundNumber ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="Ngày giờ">
                  <Text strong style={{ color: MATCHA_GREEN }}>
                    {confirmedSlot.startTime
                      ? dayjs(confirmedSlot.startTime).format('dddd, DD/MM/YYYY — HH:mm')
                      : '—'}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Mã lịch">
                  <Tag>#{scheduleData?.scheduleId ?? '—'}</Tag>
                </Descriptions.Item>
              </Descriptions>
              <Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
                Vui lòng có mặt trước buổi phỏng vấn 5–10 phút. Nếu cần đổi lịch, liên hệ bộ phận
                nhân sự qua email trong thư mời gốc.
              </Paragraph>
            </Card>
          )}

          {/* ============== NO_SLOT_FITS / CANCELLED: thông báo ============== */}
          {(status === 'NO_SLOT_FITS' || status === 'CANCELLED') && (
            <Alert
              type={status === 'CANCELLED' ? 'error' : 'info'}
              showIcon
              message={
                status === 'CANCELLED'
                  ? 'Lịch phỏng vấn đã bị hủy'
                  : 'Chưa có khung phù hợp'
              }
              description={
                <Paragraph style={{ marginBottom: 0, color: '#666' }}>
                  {status === 'CANCELLED'
                    ? 'Vòng phỏng vấn này đã bị hủy. Nếu có thắc mắc, vui lòng liên hệ bộ phận nhân sự.'
                    : 'Bạn đã phản hồi rằng chưa có khung nào phù hợp. Bộ phận tuyển dụng sẽ mở vòng mới và liên hệ lại.'}
                </Paragraph>
              }
            />
          )}

          <Text type="secondary" className="sch-footer-note">
            Nếu bạn cần hỗ trợ, vui lòng liên hệ bộ phận nhân sự qua email hoặc số điện thoại trong email mời gốc.
          </Text>
        </div>
      </Content>

      <Footer className="sch-footer">
        <Text type="secondary">© 2026 SRIS - Smart Recruitment & Interview System</Text>
      </Footer>
    </Layout>
  );
};

export default Schedule;
