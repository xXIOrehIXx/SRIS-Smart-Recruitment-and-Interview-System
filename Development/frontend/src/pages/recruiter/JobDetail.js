import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Row, Col, Card, Button, Tag, Typography, Descriptions, Tabs, Table, Avatar, Progress, Space, Modal, Select, DatePicker } from 'antd';
import { 
  EditOutlined, 
  ShareAltOutlined, 
  ClockCircleOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  UserAddOutlined,
  MailOutlined
} from '@ant-design/icons';
import './css/JobDetail.css';

const { Title, Text, Paragraph } = Typography;

const JobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const job = {
    id: 1,
    title: 'Senior Frontend Developer',
    department: 'Engineering',
    location: 'Hanoi, Vietnam',
    type: 'Full-time',
    salary: '$2,000 - $3,500',
    postedDate: '2026-06-15',
    status: 'active',
    description: 'We are looking for an experienced Frontend Developer to join our team. You will be responsible for building user interfaces, implementing designs, and ensuring a great user experience.',
    requirements: [
      '5+ years of experience in frontend development',
      'Strong proficiency in React, TypeScript, and modern CSS',
      'Experience with state management (Redux, MobX)',
      'Good understanding of backend technologies',
      'Excellent communication skills in English',
    ],
    benefits: [
      'Competitive salary and performance bonus',
      'Health insurance and social insurance',
      'Flexible working hours and remote work options',
      'Professional development and training',
      'Modern office with great facilities',
    ],
  };

  const candidatesData = [
    { id: 1, name: 'Alex Morgan', email: 'alex.morgan@email.com', stage: 'Interview', score: 85, appliedDate: '2026-06-16' },
    { id: 2, name: 'Sam Smith', email: 'sam.smith@email.com', stage: 'Screening', score: 72, appliedDate: '2026-06-17' },
    { id: 3, name: 'Jane Doe', email: 'jane.doe@email.com', stage: 'Applied', score: null, appliedDate: '2026-06-18' },
    { id: 4, name: 'John Connor', email: 'john.connor@email.com', stage: 'Offer', score: 92, appliedDate: '2026-06-10' },
  ];

  const pipelineStats = [
    { stage: 'Applied', count: 12, color: '#1890ff' },
    { stage: 'Screening', count: 8, color: '#722ed1' },
    { stage: 'Interview', count: 5, color: '#faad14' },
    { stage: 'Offer', count: 2, color: '#52c41a' },
  ];

  const candidatesColumns = [
    {
      title: 'Candidate',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div className="candidate-cell">
          <Avatar style={{ backgroundColor: '#5D8C3E' }}>{name[0]}</Avatar>
          <div className="candidate-info">
            <span className="candidate-name">{name}</span>
            <span className="candidate-email">{record.email}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      render: (stage) => {
        const colors = {
          'Applied': 'blue',
          'Screening': 'purple',
          'Interview': 'orange',
          'Offer': 'green',
        };
        return <Tag color={colors[stage]}>{stage}</Tag>;
      },
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      render: (score) => score ? (
        <Progress percent={score} size="small" strokeColor="#5D8C3E" />
      ) : <Text type="secondary">N/A</Text>,
    },
    {
      title: 'Applied',
      dataIndex: 'appliedDate',
      key: 'appliedDate',
      render: (date) => <Text type="secondary">{date}</Text>,
    },
    {
      title: '',
      key: 'actions',
      render: () => (
        <Space>
          <Button size="small">View</Button>
          <Button size="small" type="primary">Schedule</Button>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'candidates',
      label: `Candidates (${candidatesData.length})`,
      children: (
        <Table 
          columns={candidatesColumns} 
          dataSource={candidatesData} 
          rowKey="id"
          pagination={false}
          className="candidates-table"
        />
      ),
    },
    {
      key: 'pipeline',
      label: 'Pipeline',
      children: (
        <div className="pipeline-stats">
          {pipelineStats.map((item, index) => (
            <div key={index} className="pipeline-stat-item">
              <div className="pipeline-stat-header">
                <span className="stage-dot" style={{ backgroundColor: item.color }}></span>
                <span className="stage-name">{item.stage}</span>
                <span className="stage-count">{item.count}</span>
              </div>
              <Progress 
                percent={(item.count / 15) * 100} 
                showInfo={false}
                strokeColor={item.color}
                trailColor="#f0f0f0"
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'analytics',
      label: 'Analytics',
      children: (
        <div className="analytics-placeholder">
          <Text type="secondary">Analytics coming soon...</Text>
        </div>
      ),
    },
  ];

  return (
    <div className="job-detail-page">
      <div className="page-header">
        <Button onClick={() => navigate('/recruiter/jobs')} className="back-btn">
          ← Back to Jobs
        </Button>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card className="main-card" bordered={false}>
            <div className="job-header">
              <div className="job-info">
                <Title level={3} className="job-title">{job.title}</Title>
                <div className="job-tags">
                  <Tag color="blue">{job.type}</Tag>
                  <Tag color="green">{job.status}</Tag>
                  <Tag icon={<ClockCircleOutlined />}>Posted {job.postedDate}</Tag>
                </div>
              </div>
              <div className="job-actions">
                <Button icon={<ShareAltOutlined />}>Share</Button>
                <Button icon={<EditOutlined />}>Edit</Button>
              </div>
            </div>

            <div className="job-details-grid">
              <div className="detail-item">
                <TeamOutlined className="detail-icon" />
                <div>
                  <Text type="secondary">Department</Text>
                  <p>{job.department}</p>
                </div>
              </div>
              <div className="detail-item">
                <CalendarOutlined className="detail-icon" />
                <div>
                  <Text type="secondary">Location</Text>
                  <p>{job.location}</p>
                </div>
              </div>
              <div className="detail-item">
                <CheckCircleOutlined className="detail-icon" />
                <div>
                  <Text type="secondary">Salary Range</Text>
                  <p>{job.salary}</p>
                </div>
              </div>
            </div>

            <Tabs items={tabItems} className="job-tabs" />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="sidebar-card" bordered={false}>
            <Title level={5}>Quick Actions</Title>
            <div className="action-buttons">
              <Button 
                type="primary" 
                icon={<UserAddOutlined />} 
                block
                onClick={() => setIsScheduleModalOpen(true)}
                className="primary-action"
              >
                Schedule Interview
              </Button>
              <Button icon={<MailOutlined />} block>
                Send Email
              </Button>
              <Button icon={<EditOutlined />} block>
                Edit Job
              </Button>
            </div>
          </Card>

          <Card className="sidebar-card" bordered={false}>
            <Title level={5}>Pipeline Summary</Title>
            <div className="pipeline-summary">
              {pipelineStats.map((item, index) => (
                <div key={index} className="summary-item">
                  <span className="summary-label">{item.stage}</span>
                  <span className="summary-count">{item.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        title="Schedule Interview"
        open={isScheduleModalOpen}
        onCancel={() => setIsScheduleModalOpen(false)}
        footer={null}
      >
        <div className="schedule-form">
          <div className="form-group">
            <label>Select Candidate</label>
            <Select placeholder="Choose candidate" style={{ width: '100%' }} />
          </div>
          <div className="form-group">
            <label>Interview Type</label>
            <Select placeholder="Select type" style={{ width: '100%' }}>
              <Select.Option value="technical">Technical Interview</Select.Option>
              <Select.Option value="hr">HR Interview</Select.Option>
              <Select.Option value="culture">Culture Fit</Select.Option>
            </Select>
          </div>
          <div className="form-group">
            <label>Date & Time</label>
            <DatePicker showTime style={{ width: '100%' }} />
          </div>
          <Button type="primary" block className="submit-btn">
            Schedule
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default JobDetail;
