import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Row, Col, Card, Typography, Avatar, Tag, Button, Tabs, Timeline, Progress, Space, Divider } from 'antd';
import { 
  ArrowLeftOutlined, 
  MailOutlined, 
  PhoneOutlined, 
  CalendarOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import './css/CandidateDetail.css';

const { Title, Text, Paragraph } = Typography;

const CandidateDetail = () => {
  const navigate = useNavigate();

  const candidate = {
    id: 1,
    name: 'Alex Morgan',
    email: 'alex.morgan@email.com',
    phone: '+1 234 567 890',
    location: 'Hanoi, Vietnam',
    appliedDate: '2026-06-16',
    position: 'Senior Frontend Developer',
    stage: 'Interview',
    score: 85,
    experience: '5 years',
    education: 'Bachelor of Computer Science',
    resume: 'resume_alex_morgan.pdf',
  };

  const interviews = [
    { date: '2026-06-20', type: 'Technical Interview', status: 'completed', score: 85 },
    { date: '2026-06-18', type: 'HR Interview', status: 'completed', score: 90 },
    { date: '2026-06-25', type: 'Final Interview', status: 'upcoming' },
  ];

  const notes = [
    { author: 'Nguyen Van A', date: '2026-06-19', note: 'Strong technical skills, good communication.' },
    { author: 'Tran Thi B', date: '2026-06-18', note: 'Passed HR screening. Recommended for next round.' },
  ];

  const tabItems = [
    {
      key: 'profile',
      label: 'Profile',
      children: (
        <div className="profile-tab">
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              <Card className="info-card" bordered={false}>
                <Title level={5}>About</Title>
                <Paragraph>
                  Experienced frontend developer with 5+ years of experience in building web applications.
                  Proficient in React, TypeScript, and modern CSS. Strong problem-solving skills and
                  excellent communication abilities.
                </Paragraph>
                
                <Divider />
                
                <Title level={5}>Work Experience</Title>
                <div className="experience-item">
                  <h4>Senior Frontend Developer</h4>
                  <Text type="secondary">Tech Company XYZ • 2022 - Present</Text>
                  <p>Led the frontend team, built scalable React applications.</p>
                </div>
                <div className="experience-item">
                  <h4>Frontend Developer</h4>
                  <Text type="secondary">Startup ABC • 2019 - 2022</Text>
                  <p>Developed web applications using React and Node.js.</p>
                </div>
                
                <Divider />
                
                <Title level={5}>Education</Title>
                <div className="education-item">
                  <h4>Bachelor of Computer Science</h4>
                  <Text type="secondary">University of Technology • 2015 - 2019</Text>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card className="info-card" bordered={false}>
                <Title level={5}>Skills</Title>
                <div className="skills-list">
                  <Tag color="green">React</Tag>
                  <Tag color="green">TypeScript</Tag>
                  <Tag color="green">JavaScript</Tag>
                  <Tag color="blue">Node.js</Tag>
                  <Tag color="blue">CSS/SCSS</Tag>
                  <Tag color="purple">GraphQL</Tag>
                  <Tag color="purple">Redux</Tag>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: 'resume',
      label: 'Resume',
      children: (
        <Card className="resume-card" bordered={false}>
          <div className="resume-preview">
            <FileTextOutlined style={{ fontSize: 48, color: '#5D8C3E' }} />
            <Title level={4}>{candidate.resume}</Title>
            <Button type="primary" icon={<FileTextOutlined />}>
              Download Resume
            </Button>
          </div>
        </Card>
      ),
    },
    {
      key: 'interviews',
      label: 'Interviews',
      children: (
        <Card className="interviews-card" bordered={false}>
          <Timeline
            items={interviews.map((interview, index) => ({
              color: interview.status === 'completed' ? 'green' : 'blue',
              children: (
                <div className="timeline-item">
                  <div className="timeline-header">
                    <span className="interview-type">{interview.type}</span>
                    <Tag color={interview.status === 'completed' ? 'success' : 'processing'}>
                      {interview.status === 'completed' ? 'Completed' : 'Upcoming'}
                    </Tag>
                  </div>
                  <Text type="secondary" className="interview-date">
                    <CalendarOutlined /> {interview.date}
                  </Text>
                  {interview.score && (
                    <div className="interview-score">
                      <span>Score:</span>
                      <Progress percent={interview.score} size="small" strokeColor="#5D8C3E" />
                    </div>
                  )}
                </div>
              ),
            }))}
          />
        </Card>
      ),
    },
    {
      key: 'notes',
      label: 'Notes',
      children: (
        <Card className="notes-card" bordered={false}>
          {notes.map((note, index) => (
            <div key={index} className="note-item">
              <div className="note-header">
                <Avatar size={32} style={{ backgroundColor: '#5D8C3E' }}>
                  {note.author[0]}
                </Avatar>
                <div className="note-meta">
                  <span className="note-author">{note.author}</span>
                  <span className="note-date">{note.date}</span>
                </div>
              </div>
              <p className="note-content">{note.note}</p>
            </div>
          ))}
        </Card>
      ),
    },
  ];

  return (
    <div className="candidate-detail-page">
      <Button 
        onClick={() => navigate('/recruiter/jobs')} 
        className="back-btn"
        icon={<ArrowLeftOutlined />}
      >
        Back
      </Button>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={8}>
          <Card className="profile-card" bordered={false}>
            <div className="profile-header">
              <Avatar size={100} style={{ backgroundColor: '#5D8C3E', fontSize: 40 }}>
                {candidate.name[0]}
              </Avatar>
              <Title level={3} className="profile-name">{candidate.name}</Title>
              <Text type="secondary">{candidate.position}</Text>
              
              <div className="profile-tags">
                <Tag color="blue">{candidate.stage}</Tag>
                <Tag color={candidate.score >= 80 ? 'success' : 'warning'}>
                  Score: {candidate.score}%
                </Tag>
              </div>
            </div>

            <Divider />

            <div className="profile-contact">
              <div className="contact-item">
                <MailOutlined />
                <span>{candidate.email}</span>
              </div>
              <div className="contact-item">
                <PhoneOutlined />
                <span>{candidate.phone}</span>
              </div>
              <div className="contact-item">
                <CalendarOutlined />
                <span>Applied: {candidate.appliedDate}</span>
              </div>
            </div>

            <Divider />

            <Space direction="vertical" style={{ width: '100%' }}>
              <Button block icon={<MailOutlined />}>Send Email</Button>
              <Button block icon={<CalendarOutlined />} type="primary" className="schedule-btn">
                Schedule Interview
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
