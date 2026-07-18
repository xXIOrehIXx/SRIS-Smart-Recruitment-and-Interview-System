import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Layout, Card, Typography, Button, Tag, Descriptions, Result, Spin, Radio, message, Alert } from 'antd';
import { ClockCircleOutlined, CalendarOutlined, UserOutlined, MailOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { candidateAPI } from '../../services/api';
import './css/Schedule.css';

const { Header, Content, Footer } = Layout;
const { Title, Text, Paragraph } = Typography;

const MATCHA_GREEN = '#5D8C3E';

const Schedule = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scheduleData, setScheduleData] = useState(null);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    if (token) {
      fetchSchedule();
    } else {
      setError('Token không hợp lệ hoặc đã hết hạn.');
      setLoading(false);
    }
  }, [token]);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const response = await candidateAPI.getSchedule(token);
      setScheduleData(response.data);
    } catch (err) {
      console.error('Error fetching schedule:', err);
      const errorMsg = err?.response?.data?.message || err?.response?.data || 'Không thể tải thông tin lịch phỏng vấn. Liên kết có thể đã hết hạn.';
      setError(errorMsg);
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
      setSubmitted('confirmed');
    } catch (err) {
      console.error('Error confirming schedule:', err);
      message.error(err?.response?.data?.message || 'Không thể xác nhận lịch. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNoSlot = async () => {
    try {
      setSubmitting(true);
      await candidateAPI.noSlotAvailable(token);
      setSubmitted('no-slot');
    } catch (err) {
      console.error('Error reporting no slot:', err);
      message.error(err?.response?.data?.message || 'Không thể gửi phản hồi. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <Layout className="schedule-layout">
        <Header className="sch-header">
          <div className="header-logo">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill={MATCHA_GREEN}/>
              <path d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z" stroke="white" strokeWidth="2.5"/>
              <path d="M20 22L24 26L28 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M24 18V26" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <span>SRIS</span>
          </div>
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

  if (error) {
    return (
      <Layout className="schedule-layout">
        <Header className="sch-header">
          <div className="header-logo">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill={MATCHA_GREEN}/>
              <path d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z" stroke="white" strokeWidth="2.5"/>
              <path d="M20 22L24 26L28 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M24 18V26" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <span>SRIS</span>
          </div>
        </Header>
        <Content className="sch-content">
          <Result
            status="error"
            icon={<CloseCircleOutlined style={{ color: '#f5222d' }} />}
            title="Không thể tải lịch phỏng vấn"
            subTitle={error}
            extra={
              <Button type="primary" onClick={() => navigate('/')}>
                Đóng
              </Button>
            }
          />
        </Content>
      </Layout>
    );
  }

  if (submitted === 'confirmed') {
    return (
      <Layout className="schedule-layout">
        <Header className="sch-header">
          <div className="header-logo">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill={MATCHA_GREEN}/>
              <path d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z" stroke="white" strokeWidth="2.5"/>
              <path d="M20 22L24 26L28 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M24 18V26" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <span>SRIS</span>
          </div>
        </Header>
        <Content className="sch-content">
          <Result
            status="success"
            icon={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: 72 }} />}
            title="Xác nhận thành công!"
            subTitle={
              <div>
                <p>Bạn đã xác nhận tham gia phỏng vấn thành công.</p>
                <p style={{ marginTop: 8, color: '#666' }}>
                  Chúng tôi sẽ gửi email xác nhận kèm lịch phỏng vấn chi tiết trong thời gian sớm nhất.
                </p>
              </div>
            }
            extra={
              <Button type="primary" onClick={() => window.close()}>
                Đóng
              </Button>
            }
          />
        </Content>
      </Layout>
    );
  }

  if (submitted === 'no-slot') {
    return (
      <Layout className="schedule-layout">
        <Header className="sch-header">
          <div className="header-logo">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill={MATCHA_GREEN}/>
              <path d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z" stroke="white" strokeWidth="2.5"/>
              <path d="M20 22L24 26L28 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M24 18V26" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <span>SRIS</span>
          </div>
        </Header>
        <Content className="sch-content">
          <Result
            status="info"
            icon={<ClockCircleOutlined style={{ color: MATCHA_GREEN, fontSize: 72 }} />}
            title="Phản hồi của bạn đã được ghi nhận"
            subTitle={
              <div>
                <p>Chúng tôi đã ghi nhận rằng bạn chưa có khung giờ phù hợp.</p>
                <p style={{ marginTop: 8, color: '#666' }}>
                  Bộ phận tuyển dụng sẽ liên hệ với bạn để sắp xếp lịch phỏng vấn khác.
                </p>
              </div>
            }
            extra={
              <Button type="primary" onClick={() => window.close()}>
                Đóng
              </Button>
            }
          />
        </Content>
      </Layout>
    );
  }

  const slots = scheduleData?.slots || [];

  return (
    <Layout className="schedule-layout">
      <Header className="sch-header">
        <div className="header-logo">
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill={MATCHA_GREEN}/>
            <path d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z" stroke="white" strokeWidth="2.5"/>
            <path d="M20 22L24 26L28 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M24 18V26" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <span>SRIS</span>
        </div>
        <Tag color="green" icon={<CalendarOutlined />}>Xác nhận lịch phỏng vấn</Tag>
      </Header>

      <Content className="sch-content">
        <div className="sch-container">
          <div className="sch-hero">
            <div className="sch-hero-icon">
              <CalendarOutlined />
            </div>
            <Title level={2} className="sch-hero-title">
              Chọn lịch phỏng vấn
            </Title>
            <Paragraph className="sch-hero-subtitle">
              Vui lòng chọn một khung giờ phỏng vấn phù hợp với bạn. 
              Sau khi xác nhận, bạn sẽ nhận được email xác nhận kèm lịch chi tiết.
            </Paragraph>
          </div>

          <Alert
            message="Thông tin phỏng vấn"
            description={
              <Descriptions size="small" column={1} className="sch-info">
                <Descriptions.Item label={<span><UserOutlined /> Vị trí ứng tuyển</span>}>
                  <Text strong>{scheduleData?.jobTitle || 'N/A'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<span><MailOutlined /> Email liên hệ</span>}>
                  {scheduleData?.candidateEmail || 'N/A'}
                </Descriptions.Item>
              </Descriptions>
            }
            type="info"
            showIcon
            className="sch-info-alert"
          />

          <Card className="sch-slots-card">
            <div className="sch-slots-header">
              <Title level={4} style={{ margin: 0 }}>
                <CalendarOutlined /> Khung giờ phỏng vấn
              </Title>
              <Text type="secondary">Chọn 1 trong các khung giờ dưới đây</Text>
            </div>

            {slots.length === 0 ? (
              <Alert
                message="Hiện không có khung giờ trống"
                description="Vui lòng liên hệ bộ phận tuyển dụng để được sắp xếp lịch phỏng vấn khác."
                type="warning"
                showIcon
              />
            ) : (
              <Radio.Group 
                onChange={(e) => setSelectedSlot(e.target.value)} 
                value={selectedSlot}
                className="sch-slots-group"
              >
                <div className="sch-slots-list">
                  {slots.map((slot) => (
                    <Card 
                      key={slot.slotId} 
                      className={`sch-slot-card ${selectedSlot === slot.slotId ? 'selected' : ''}`}
                      hoverable
                    >
                      <Radio value={slot.slotId}>
                        <div className="sch-slot-content">
                          <div className="sch-slot-date">
                            <CalendarOutlined /> {formatDate(slot.startTime)}
                          </div>
                          <div className="sch-slot-time">
                            <ClockCircleOutlined /> {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          </div>
                          {slot.interviewerName && (
                            <div className="sch-slot-interviewer">
                              <UserOutlined /> Người phỏng vấn: {slot.interviewerName}
                            </div>
                          )}
                        </div>
                      </Radio>
                    </Card>
                  ))}
                </div>
              </Radio.Group>
            )}
          </Card>

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
            
            {slots.length > 0 && (
              <Button
                size="large"
                onClick={handleNoSlot}
                loading={submitting}
                className="sch-no-slot-btn"
              >
                <ClockCircleOutlined /> Không có khung giờ phù hợp
              </Button>
            )}
          </div>

          <Text type="secondary" className="sch-footer-note">
            Nếu bạn cần hỗ trợ thêm, vui lòng liên hệ bộ phận nhân sự qua email hoặc số điện thoại được cung cấp trong email gốc.
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
