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
  Rate,
  Table,
} from 'antd';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  UserOutlined,
  TeamOutlined,
  VideoCameraOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import '../Dashboard.css';

const { Title, Text } = Typography;

const MATCHA_GREEN = '#5D8C3E';

const DeptInterviewDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const interview = {
    id: id || 1,
    candidate: 'Nguyễn Văn Minh',
    candidateEmail: 'minhnv@email.com',
    candidatePhone: '0912 345 678',
    position: 'Senior Frontend Developer',
    department: 'Engineering',
    requestTitle: 'Senior Frontend Developer',
    interviewType: 'Technical Interview',
    scheduledDate: '2026-07-08',
    scheduledTime: '14:00',
    duration: 60,
    level: 2,
    totalLevel: 3,
    status: 'COMPLETED',
    interviewers: [
      { name: 'Trần Văn A', role: 'Technical Lead', score: 8, feedback: 'Ứng viên có kiến thức vững về React và TypeScript.' },
      { name: 'Lê Thị B', role: 'Senior Engineer', score: 7, feedback: 'Kỹ năng problem-solving tốt, giao tiếp rõ ràng.' },
    ],
    meetingLink: 'https://meet.google.com/abc-defg-hij',
  };

  const getScoreColor = (score) => {
    if (score >= 8) return '#52c41a';
    if (score >= 6) return '#faad14';
    return '#f5222d';
  };

  const getRecommendationColor = (rec) => {
    const colors = {
      STRONG_HIRE: '#52c41a',
      HIRE: '#73d13d',
      CONSIDER: '#faad14',
      NO_HIRE: '#f5222d',
    };
    return colors[rec] || '#999';
  };

  const avgScore =
    interview.interviewers.reduce((sum, i) => sum + i.score, 0) / interview.interviewers.length;

  const decisionColumns = [
    {
      title: 'Người phỏng vấn',
      key: 'interviewer',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />
          <div>
            <Text strong>{record.name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{record.role}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Điểm',
      key: 'score',
      width: 200,
      render: (_, record) => (
        <div>
          <Rate disabled count={5} value={record.score} style={{ fontSize: 16 }} />
          <Text strong style={{ marginLeft: 8, color: getScoreColor(record.score * 2) }}>
            {record.score}/5
          </Text>
        </div>
      ),
    },
    {
      title: 'Nhận xét',
      dataIndex: 'feedback',
      key: 'feedback',
    },
  ];

  return (
    <div className="dept-interview-detail-page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/dept/interviews')} />
          <div>
            <Title level={3} className="page-title">Chi Tiết Phỏng Vấn</Title>
            <Text type="secondary">
              {dayjs(interview.scheduledDate).format('DD/MM/YYYY')} lúc {interview.scheduledTime} • Vòng {interview.level}/{interview.totalLevel}
            </Text>
          </div>
        </div>
        <Space>
          {interview.meetingLink && (
            <Button icon={<VideoCameraOutlined />} style={{ borderColor: MATCHA_GREEN, color: MATCHA_GREEN }}>
              Tham gia phỏng vấn
            </Button>
          )}
        </Space>
      </div>

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={16}>
          <Card className="main-card" bordered={false} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <Avatar size={64} style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />
              <div style={{ flex: 1 }}>
                <Title level={4} style={{ margin: 0 }}>{interview.candidate}</Title>
                <Text type="secondary">{interview.candidateEmail}</Text>
                <br />
                <Text type="secondary">{interview.candidatePhone}</Text>
              </div>
              <Tag color={interview.status === 'COMPLETED' ? 'success' : 'processing'} style={{ fontSize: 14 }}>
                {interview.status === 'COMPLETED' ? 'Đã hoàn thành' : 'Đã lên lịch'}
              </Tag>
            </div>

            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Vị trí ứng tuyển" span={2}>
                <Text strong>{interview.position}</Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>• {interview.department}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Yêu cầu tuyển dụng">{interview.requestTitle}</Descriptions.Item>
              <Descriptions.Item label="Vòng phỏng vấn">Vòng {interview.level} / {interview.totalLevel}</Descriptions.Item>
              <Descriptions.Item label="Loại phỏng vấn">{interview.interviewType}</Descriptions.Item>
              <Descriptions.Item label="Thời lượng">{interview.duration} phút</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card className="main-card" bordered={false} style={{ marginBottom: 20 }}>
            <Title level={5}>
              <TeamOutlined style={{ marginRight: 8 }} />
              Đánh giá từ người phỏng vấn
            </Title>
            <Table
              columns={decisionColumns}
              dataSource={interview.interviewers}
              rowKey="name"
              pagination={false}
              style={{ marginTop: 16 }}
            />
          </Card>

          <Card className="main-card" bordered={false}>
            <Title level={5}>Quyết định tuyển dụng</Title>
            <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { key: 'STRONG_HIRE', label: 'Trúng tuyển mạnh', color: '#52c41a' },
                { key: 'HIRE', label: 'Trúng tuyển', color: '#73d13d' },
                { key: 'CONSIDER', label: 'Cân nhắc', color: '#faad14' },
                { key: 'NO_HIRE', label: 'Không trúng tuyển', color: '#f5222d' },
              ].map((opt) => (
                <Button
                  key={opt.key}
                  style={{
                    height: 48,
                    borderColor: opt.color,
                    color: opt.color,
                  }}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="main-card" bordered={false} style={{ marginBottom: 20 }}>
            <Title level={5}>
              <TeamOutlined style={{ marginRight: 8 }} />
              Tổng quan điểm đánh giá
            </Title>
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: `${getScoreColor(avgScore)}15`,
                  border: `4px solid ${getScoreColor(avgScore)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                }}
              >
                <Text strong style={{ fontSize: 32, color: getScoreColor(avgScore) }}>
                  {avgScore.toFixed(1)}
                </Text>
              </div>
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>Điểm trung bình</Text>
            </div>

            <Divider />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {interview.interviewers.map((interviewer) => (
                <div key={interviewer.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>{interviewer.name}</Text>
                  <Tag color={getScoreColor(interviewer.score * 2)}>
                    {interviewer.score}/5
                  </Tag>
                </div>
              ))}
            </div>
          </Card>

          <Card className="main-card" bordered={false}>
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
                <ClockCircleOutlined style={{ color: '#faad14' }} />
                <Text>{interview.scheduledTime} ({interview.duration} phút)</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TeamOutlined style={{ color: '#1890ff' }} />
                <Text>{interview.interviewers.length} người phỏng vấn</Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DeptInterviewDetail;
