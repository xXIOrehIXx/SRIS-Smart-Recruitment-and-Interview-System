import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Row, Col, Card, Typography, Avatar, Tag, Button, Tabs, Timeline, Progress, Space, Divider, Spin, message } from 'antd';
import { 
  ArrowLeftOutlined, 
  MailOutlined, 
  PhoneOutlined, 
  CalendarOutlined,
  FileTextOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { applicationAPI, interviewAPI } from '../../services/api';
import './css/CandidateDetail.css';

const { Title, Text, Paragraph } = Typography;

const MATCHA_GREEN = '#5D8C3E';

const CandidateDetail = () => {
  const { id: applicationId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    if (applicationId) {
      fetchApplicationDetails();
    }
  }, [applicationId]);

  const fetchApplicationDetails = async () => {
    try {
      setLoading(true);
      
      const [appRes, historyRes, notesRes] = await Promise.all([
        applicationAPI.getById(applicationId),
        applicationAPI.getHistory(applicationId),
        applicationAPI.getNotes(applicationId)
      ]);

      setApplication(appRes.data);
      setInterviews(historyRes.data || []);
      setNotes(notesRes.data || []);
    } catch (error) {
      console.error('Error fetching application details:', error);
      message.error('Không thể tải thông tin ứng viên');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  };

  const getStageLabel = (stage) => {
    const labels = {
      'Applied': 'Đã Ứng Tuyển',
      'Screening': 'Sàng Lọc',
      'Interview': 'Phỏng Vấn',
      'Offer': 'Offer',
      'Hired': 'Đã Tuyển',
      'Rejected': 'Từ Chối'
    };
    return labels[stage] || stage || 'N/A';
  };

  const getStageColor = (stage) => {
    const colors = {
      'Applied': 'blue',
      'Screening': 'purple',
      'Interview': 'orange',
      'Offer': 'green',
      'Hired': 'success',
      'Rejected': 'red'
    };
    return colors[stage] || 'default';
  };

  const candidate = application?.candidate || application || {};

  const tabItems = [
    {
      key: 'profile',
      label: 'Hồ Sơ',
      children: (
        <div className="profile-tab">
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              <Card className="info-card" bordered={false}>
                <Title level={5}>Giới Thiệu</Title>
                <Paragraph>
                  {candidate.bio || candidate.about || 'Chưa có thông tin giới thiệu.'}
                </Paragraph>
                
                <Divider />
                
                <Title level={5}>Kinh Nghiệm Làm Việc</Title>
                {candidate.experience?.length > 0 ? (
                  candidate.experience.map((exp, index) => (
                    <div key={index} className="experience-item">
                      <h4>{exp.position || exp.title}</h4>
                      <Text type="secondary">{exp.company} • {exp.startDate} - {exp.endDate || 'Hiện tại'}</Text>
                      <p>{exp.description}</p>
                    </div>
                  ))
                ) : (
                  <Text type="secondary">Chưa có thông tin kinh nghiệm</Text>
                )}
                
                <Divider />
                
                <Title level={5}>Học Vấn</Title>
                {candidate.education?.length > 0 ? (
                  candidate.education.map((edu, index) => (
                    <div key={index} className="education-item">
                      <h4>{edu.degree}</h4>
                      <Text type="secondary">{edu.school} • {edu.year}</Text>
                    </div>
                  ))
                ) : (
                  <Text type="secondary">Chưa có thông tin học vấn</Text>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card className="info-card" bordered={false}>
                <Title level={5}>Kỹ Năng</Title>
                <div className="skills-list">
                  {candidate.skills?.length > 0 ? (
                    candidate.skills.map((skill, index) => (
                      <Tag key={index} color="green">{skill}</Tag>
                    ))
                  ) : (
                    <Text type="secondary">Chưa có kỹ năng</Text>
                  )}
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: 'resume',
      label: 'CV',
      children: (
        <Card className="resume-card" bordered={false}>
          {candidate.cvUrl ? (
            <div className="resume-preview">
              <FileTextOutlined style={{ fontSize: 48, color: MATCHA_GREEN }} />
              <Title level={4}>{candidate.cvFileName || 'Resume'}</Title>
              <Button 
                type="primary" 
                icon={<FileTextOutlined />}
                href={candidate.cvUrl}
                target="_blank"
              >
                Tải CV
              </Button>
            </div>
          ) : (
            <div className="resume-preview">
              <FileTextOutlined style={{ fontSize: 48, color: '#ccc' }} />
              <Text type="secondary">Chưa có CV</Text>
            </div>
          )}
        </Card>
      ),
    },
    {
      key: 'interviews',
      label: 'Lịch Phỏng Vấn',
      children: (
        <Card className="interviews-card" bordered={false}>
          {interviews.length > 0 ? (
            <Timeline
              items={interviews.map((interview, index) => ({
                color: interview.status === 'completed' ? 'green' : 'blue',
                children: (
                  <div className="timeline-item">
                    <div className="timeline-header">
                      <span className="interview-type">{interview.type || interview.interviewType}</span>
                      <Tag color={interview.status === 'completed' ? 'success' : 'processing'}>
                        {interview.status === 'completed' ? 'Hoàn thành' : 'Sắp tới'}
                      </Tag>
                    </div>
                    <Text type="secondary" className="interview-date">
                      <CalendarOutlined /> {formatDate(interview.date || interview.scheduledAt)}
                    </Text>
                    {interview.score && (
                      <div className="interview-score">
                        <span>Điểm: {interview.score}</span>
                        <Progress percent={interview.score} size="small" strokeColor={MATCHA_GREEN} />
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Text type="secondary">Chưa có lịch phỏng vấn</Text>
            </div>
          )}
        </Card>
      ),
    },
    {
      key: 'notes',
      label: 'Ghi Chú',
      children: (
        <Card className="notes-card" bordered={false}>
          {notes.length > 0 ? (
            notes.map((note, index) => (
              <div key={index} className="note-item">
                <div className="note-header">
                  <Avatar size={32} style={{ backgroundColor: MATCHA_GREEN }}>
                    {(note.authorName || note.author || 'N')[0]}
                  </Avatar>
                  <div className="note-meta">
                    <span className="note-author">{note.authorName || note.author}</span>
                    <span className="note-date">{formatDate(note.createdAt || note.date)}</span>
                  </div>
                </div>
                <p className="note-content">{note.content || note.note}</p>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Text type="secondary">Chưa có ghi chú</Text>
            </div>
          )}
        </Card>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="candidate-detail-page">
      <div className="page-header">
        <Button 
          onClick={() => navigate(-1)} 
          className="back-btn"
          icon={<ArrowLeftOutlined />}
        >
          Quay Lại
        </Button>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={fetchApplicationDetails}
          loading={loading}
        >
          Làm Mới
        </Button>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={8}>
          <Card className="profile-card" bordered={false}>
            <div className="profile-header">
              <Avatar size={100} style={{ backgroundColor: MATCHA_GREEN, fontSize: 40 }}>
                {(candidate.fullName || candidate.name || 'N')[0]}
              </Avatar>
              <Title level={3} className="profile-name">{candidate.fullName || candidate.name || 'N/A'}</Title>
              <Text type="secondary">{application?.jobTitle || candidate.position || 'N/A'}</Text>
              
              <div className="profile-tags">
                <Tag color={getStageColor(application?.state)}>
                  {getStageLabel(application?.state)}
                </Tag>
                {(application?.cvScore || candidate.score) && (
                  <Tag color={(application?.cvScore || candidate.score) >= 80 ? 'success' : 'warning'}>
                    Điểm: {application?.cvScore || candidate.score}%
                  </Tag>
                )}
              </div>
            </div>

            <Divider />

            <div className="profile-contact">
              <div className="contact-item">
                <MailOutlined />
                <span>{candidate.email || 'N/A'}</span>
              </div>
              {candidate.phone && (
                <div className="contact-item">
                  <PhoneOutlined />
                  <span>{candidate.phone}</span>
                </div>
              )}
              <div className="contact-item">
                <CalendarOutlined />
                <span>Ứng tuyển: {formatDate(application?.appliedAt || candidate.appliedDate)}</span>
              </div>
            </div>

            <Divider />

            <Space direction="vertical" style={{ width: '100%' }}>
              <Button block icon={<MailOutlined />}>Gửi Email</Button>
              <Button block icon={<CalendarOutlined />} type="primary" className="schedule-btn">
                Lên Lịch Phỏng Vấn
              </Button>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card className="content-card" bordered={false}>
            <Tabs items={tabItems} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CandidateDetail;
