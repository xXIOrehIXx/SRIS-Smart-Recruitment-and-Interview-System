import React, { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Typography,
  Button,
  Descriptions,
  Tag,
  Avatar,
  Space,
  Divider,
  message,
  Input,
  Rate,
} from 'antd';
import {
  ArrowLeftOutlined,
  VideoCameraOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  UserOutlined,
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  SaveOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import '../Dashboard.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

const MATCHA_GREEN = '#5D8C3E';

const InterviewerInterviewDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [feedback, setFeedback] = useState('');
  const [recommendation, setRecommendation] = useState(null);
  const [ratings, setRatings] = useState({
    technical: 0,
    communication: 0,
    problemSolving: 0,
    cultureFit: 0,
    attitude: 0,
  });
  const [loading, setLoading] = useState(false);

  const interview = {
    id: id || 1,
    candidateName: 'Nguyễn Văn Minh',
    candidateEmail: 'minhnv@email.com',
    candidatePhone: '0912 345 678',
    position: 'Senior Frontend Developer',
    department: 'Engineering',
    requestTitle: 'Senior Frontend Developer',
    interviewType: 'Technical Interview',
    scheduledDate: '2026-07-08',
    scheduledTime: '14:00',
    duration: 60,
    meetingLink: 'https://meet.google.com/abc-defg-hij',
    interviewLevel: 2,
    totalLevel: 3,
    status: 'COMPLETED',
    interviewer: 'Bạn',
    notes: 'Ứng viên có 5 năm kinh nghiệm với React và TypeScript. Đã làm việc tại các công ty công nghệ lớn.',
  };

  const criteria = [
    { key: 'technical', label: 'Kỹ thuật', desc: 'Kiến thức về React, TypeScript, CSS' },
    { key: 'communication', label: 'Giao tiếp', desc: 'Khả năng trình bày ý tưởng' },
    { key: 'problemSolving', label: 'Giải quyết vấn đề', desc: 'Tư duy logic, cách tiếp cận bài toán' },
    { key: 'cultureFit', label: 'Phù hợp văn hóa', desc: 'Phù hợp với văn hóa công ty' },
    { key: 'attitude', label: 'Thái độ', desc: 'Tinh thần học hỏi, trách nhiệm' },
  ];

  const recommendationOptions = [
    { key: 'STRONG_HIRE', label: 'Trúng tuyển mạnh', color: '#52c41a' },
    { key: 'HIRE', label: 'Trúng tuyển', color: '#73d13d' },
    { key: 'CONSIDER', label: 'Cân nhắc', color: '#faad14' },
    { key: 'NO_HIRE', label: 'Không trúng tuyển', color: '#f5222d' },
  ];

  const handleRatingChange = (key, value) => {
    setRatings({ ...ratings, [key]: value });
  };

  const getTotalScore = () => {
    const total = Object.values(ratings).reduce((sum, val) => sum + val, 0);
    return total;
  };

  const getMaxScore = () => criteria.length * 5;

  const getScoreColor = (score) => {
    const percent = (score / getMaxScore()) * 100;
    if (percent >= 80) return '#52c41a';
    if (percent >= 60) return '#faad14';
    return '#f5222d';
  };

  const handleSave = async () => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    message.success('Đã lưu đánh giá thành công!');
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (getTotalScore() === 0) {
      message.error('Vui lòng đánh giá ít nhất một tiêu chí');
      return;
    }
    if (!recommendation) {
      message.error('Vui lòng chọn đề xuất');
      return;
    }
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    message.success('Đã gửi đánh giá thành công!');
    setLoading(false);
    navigate('/interviewer/history');
  };

  return (
    <div className="interview-detail-page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/interviewer/schedule')}
          />
          <div>
            <Title level={3} className="page-title">Chi Tiết Phỏng Vấn</Title>
            <Text type="secondary">
              ID: #{interview.id} • {dayjs(interview.scheduledDate).format('DD/MM/YYYY')} lúc {interview.scheduledTime}
            </Text>
          </div>
        </div>
        <Space>
          <Button icon={<VideoCameraOutlined />} style={{ borderColor: MATCHA_GREEN, color: MATCHA_GREEN }}>
            Tham gia phỏng vấn
          </Button>
        </Space>
      </div>

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={16}>
          <Card className="main-card" bordered={false} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <Avatar size={64} style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />
              <div>
                <Title level={4} style={{ margin: 0 }}>{interview.candidateName}</Title>
                <Text type="secondary">{interview.candidateEmail}</Text>
                <br />
                <Text type="secondary">{interview.candidatePhone}</Text>
              </div>
              <Tag
                color={interview.status === 'COMPLETED' ? 'success' : 'processing'}
                style={{ marginLeft: 'auto' }}
              >
                {interview.status === 'COMPLETED' ? 'Đã hoàn thành' : 'Sắp tới'}
              </Tag>
            </div>

            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Vị trí ứng tuyển" span={2}>
                <Text strong>{interview.position}</Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>• {interview.department}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Yêu cầu tuyển dụng">
                {interview.requestTitle}
              </Descriptions.Item>
              <Descriptions.Item label="Vòng phỏng vấn">
                Vòng {interview.interviewLevel} / {interview.totalLevel}
              </Descriptions.Item>
              <Descriptions.Item label="Loại phỏng vấn">
                {interview.interviewType}
              </Descriptions.Item>
              <Descriptions.Item label="Thời lượng">
                {interview.duration} phút
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Title level={5}>
              <TeamOutlined style={{ marginRight: 8 }} />
              Thông tin bổ sung
            </Title>
            <Text>{interview.notes}</Text>
          </Card>

          <Card className="main-card" bordered={false} style={{ marginBottom: 20 }}>
            <Title level={5}>
              <FileTextOutlined style={{ marginRight: 8 }} />
              Đánh Giá Phỏng Vấn
            </Title>

            <div style={{ marginTop: 20 }}>
              {criteria.map((c) => (
                <div
                  key={c.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 0',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  <div>
                    <Text strong>{c.label}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>{c.desc}</Text>
                  </div>
                  <Rate
                    count={5}
                    value={ratings[c.key]}
                    onChange={(value) => handleRatingChange(c.key, value)}
                    style={{ fontSize: 20 }}
                  />
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 20,
                padding: '16px',
                background: `${getScoreColor(getTotalScore())}10`,
                borderRadius: 8,
              }}
            >
              <Text strong>Điểm tổng:</Text>
              <Text strong style={{ fontSize: 24, color: getScoreColor(getTotalScore()) }}>
                {getTotalScore()} / {getMaxScore()}
              </Text>
            </div>
          </Card>

          <Card className="main-card" bordered={false} style={{ marginBottom: 20 }}>
            <Title level={5}>Nhận Xét Chung</Title>
            <TextArea
              rows={4}
              placeholder="Nhập nhận xét chi tiết về ứng viên..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              style={{ marginBottom: 20 }}
            />

            <Title level={5}>Đề Xuất</Title>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {recommendationOptions.map((opt) => (
                <Button
                  key={opt.key}
                  type={recommendation === opt.key ? 'primary' : 'default'}
                  onClick={() => setRecommendation(opt.key)}
                  style={
                    recommendation === opt.key
                      ? { background: opt.color, borderColor: opt.color }
                      : {}
                  }
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={loading}
            >
              Lưu nháp
            </Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSubmit}
              loading={loading}
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
            >
              Gửi đánh giá
            </Button>
          </div>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="main-card" bordered={false} style={{ marginBottom: 20 }}>
            <Title level={5}>
              <CalendarOutlined style={{ marginRight: 8 }} />
              Thông tin lịch
            </Title>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarOutlined style={{ color: MATCHA_GREEN }} />
                <Text>{dayjs(interview.scheduledDate).format('dddd, DD/MM/YYYY')}</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClockCircleOutlined style={{ color: MATCHA_GREEN }} />
                <Text>{interview.scheduledTime} ({interview.duration} phút)</Text>
              </div>
            </div>
          </Card>

          <Card className="main-card" bordered={false}>
            <Title level={5}>
              <FileTextOutlined style={{ marginRight: 8 }} />
              Checklist
            </Title>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {[
                'Chuẩn bị câu hỏi phỏng vấn',
                'Xem lại CV ứng viên',
                'Kiểm tra kết nối Internet',
                'Chuẩn bị không gian yên tĩnh',
              ].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <Text>{item}</Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default InterviewerInterviewDetail;
