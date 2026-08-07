import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Layout, Card, Typography, Button, Tag, Descriptions, Result, Spin, Space, Alert } from 'antd';
import {
  CloseCircleOutlined, FileTextOutlined, TrophyOutlined, CalendarOutlined,
  DollarOutlined, DownloadOutlined, MailOutlined, EnvironmentOutlined,
} from '@ant-design/icons';
import { candidateAPI } from '../../services/api';
import './css/CandidateResponse.css';

const { Header, Content, Footer } = Layout;
const { Title, Text, Paragraph } = Typography;

const MATCHA_GREEN = '#5D8C3E';

const HeaderLogo = () => (
  <div className="header-logo">
    <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="12" fill={MATCHA_GREEN} />
      <path d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z" stroke="white" strokeWidth="2.5" />
      <path d="M20 22L24 26L28 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 18V26" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
    <span>SRIS</span>
  </div>
);

/**
 * Trang ứng viên xem THƯ MỜI NHẬN VIỆC qua magic link (docs 5.15).
 *
 * KHÔNG còn nút Đồng ý/Từ chối: ứng viên đọc/tải bản PDF rồi trả lời nhà tuyển dụng
 * qua email/điện thoại; Human Resource ghi nhận kết quả trong Portal. Vì thế trang này chỉ đọc.
 */
const CandidateResponse = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [offerData, setOfferData] = useState(null);
  const [error, setError] = useState(null);

  const letterUrl = token ? candidateAPI.offerLetterUrl(token) : null;

  useEffect(() => {
    if (!token) {
      setError('Liên kết không hợp lệ hoặc đã hết hạn.');
      setLoading(false);
      return;
    }
    fetchOffer();
  }, [token]);

  const fetchOffer = async () => {
    try {
      setLoading(true);
      const response = await candidateAPI.getOffer(token);
      setOfferData(response.data);
    } catch (err) {
      console.error('Error fetching offer:', err);
      // BE trả ErrorObjectCommon (userMsg), không phải `message`.
      setError(
        err?.response?.data?.userMsg ||
        'Không thể tải thư mời nhận việc. Liên kết có thể đã hết hạn.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout className="candidate-response-layout">
        <Header className="cr-header"><HeaderLogo /></Header>
        <Content className="cr-content">
          <div style={{ textAlign: 'center', padding: 80 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">Đang tải thư mời nhận việc...</Text>
            </div>
          </div>
        </Content>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout className="candidate-response-layout">
        <Header className="cr-header"><HeaderLogo /></Header>
        <Content className="cr-content">
          <Result
            status="error"
            icon={<CloseCircleOutlined style={{ color: '#f5222d' }} />}
            title="Không thể mở thư mời"
            subTitle={error}
            extra={<Button type="primary" onClick={() => navigate('/')}>Quay về trang chủ</Button>}
          />
        </Content>
      </Layout>
    );
  }

  const formatSalary = () => {
    if (!offerData?.salaryAmount) return 'Thỏa thuận';
    const amount = new Intl.NumberFormat('vi-VN').format(offerData.salaryAmount);
    const currency = offerData.currency || 'VND';
    const period = offerData.salaryPeriod === 'NAM' ? '/năm'
      : offerData.salaryPeriod === 'THANG' ? '/tháng' : '';
    return `${amount} ${currency}${period}`;
  };

  const formatDate = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('vi-VN', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  };

  const hrContact = offerData?.hrContactEmail || offerData?.hrContactName;

  return (
    <Layout className="candidate-response-layout">
      <Header className="cr-header">
        <HeaderLogo />
        <Tag color="green" icon={<FileTextOutlined />}>Thư mời nhận việc</Tag>
      </Header>

      <Content className="cr-content">
        <div className="cr-container">
          <div className="cr-hero">
            <div className="cr-hero-icon"><TrophyOutlined /></div>
            <Title level={2} className="cr-hero-title">
              Chúc mừng bạn đã vượt qua phỏng vấn!
            </Title>
            <Paragraph className="cr-hero-subtitle">
              {offerData?.companyName || 'Nhà tuyển dụng'} trân trọng gửi bạn thư mời nhận việc
              {offerData?.jobTitle ? ` cho vị trí ${offerData.jobTitle}` : ''}. Bạn có thể xem
              trực tiếp bên dưới hoặc tải bản PDF về máy.
            </Paragraph>
          </div>

          <Card className="cr-offer-card">
            <div className="cr-offer-header">
              <div>
                <Title level={4} style={{ margin: 0 }}>Tóm tắt</Title>
                <Text type="secondary">
                  Vị trí: <strong>{offerData?.jobTitle || 'N/A'}</strong>
                </Text>
              </div>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                href={letterUrl}
                download
                style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
              >
                Tải thư (PDF)
              </Button>
            </div>

            <Descriptions column={{ xs: 1, sm: 2 }} className="cr-offer-details">
              <Descriptions.Item label={<span><DollarOutlined /> Mức lương</span>}>
                <Text strong style={{ color: MATCHA_GREEN, fontSize: 16 }}>{formatSalary()}</Text>
              </Descriptions.Item>
              {offerData?.startDate && (
                <Descriptions.Item label={<span><CalendarOutlined /> Ngày bắt đầu</span>}>
                  <Text strong>{formatDate(offerData.startDate)}</Text>
                </Descriptions.Item>
              )}
              {offerData?.department && (
                <Descriptions.Item label="Phòng ban">{offerData.department}</Descriptions.Item>
              )}
              {offerData?.employmentType && (
                <Descriptions.Item label="Hình thức làm việc">{offerData.employmentType}</Descriptions.Item>
              )}
              {offerData?.workLocation && (
                <Descriptions.Item label={<span><EnvironmentOutlined /> Địa điểm</span>}>
                  {offerData.workLocation}
                </Descriptions.Item>
              )}
              {offerData?.expiresAt && (
                <Descriptions.Item label="Mong nhận phản hồi trước">
                  <Text type="danger" strong>{formatDate(offerData.expiresAt)}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>

            <Alert
              type="info"
              showIcon
              icon={<MailOutlined />}
              style={{ marginTop: 16 }}
              message="Cách xác nhận"
              description={
                <Space direction="vertical" size={2}>
                  <span>
                    Vui lòng phản hồi trực tiếp email bạn vừa nhận để xác nhận bạn có nhận
                    lời mời hay không — trang này không có nút bấm xác nhận.
                  </span>
                  {hrContact && (
                    <span>
                      Người liên hệ:{' '}
                      <strong>
                        {offerData.hrContactName}
                        {offerData.hrContactName && offerData.hrContactEmail ? ' — ' : ''}
                        {offerData.hrContactEmail}
                      </strong>
                    </span>
                  )}
                </Space>
              }
            />
          </Card>

          {/* Bản thư đầy đủ — nhúng thẳng PDF cho ứng viên đọc ngay, không phải tải mới xem được. */}
          <Card className="cr-offer-card" style={{ marginTop: 24 }} styles={{ body: { padding: 12 } }}>
            <object data={letterUrl} type="application/pdf" className="cr-letter-frame">
              <div style={{ padding: 24, textAlign: 'center' }}>
                <Paragraph type="secondary">
                  Trình duyệt của bạn không hiển thị được PDF trực tiếp.
                </Paragraph>
                <Button type="primary" icon={<DownloadOutlined />} href={letterUrl} download>
                  Tải thư mời nhận việc (PDF)
                </Button>
              </div>
            </object>
          </Card>
        </div>
      </Content>

      <Footer className="cr-footer">
        <Text type="secondary">© 2026 SRIS - Smart Recruitment & Interview System</Text>
      </Footer>
    </Layout>
  );
};

export default CandidateResponse;
