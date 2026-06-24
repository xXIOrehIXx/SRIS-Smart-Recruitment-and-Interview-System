import React from 'react';
import { Row, Col, Card, Table, Tag, Avatar, Button, Progress, Typography, List } from 'antd';
import { 
  FileTextOutlined, 
  TeamOutlined, 
  CalendarOutlined, 
  CheckCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  PlusOutlined,
  RightOutlined,
  ClockCircleOutlined,
  RiseOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './css/Dashboard.css';

const { Title, Text } = Typography;

const RecruiterDashboard = () => {
  const navigate = useNavigate();

  const stats = [
    { 
      title: 'Total Jobs', 
      value: 24, 
      suffix: '+', 
      trend: '+12%',
      trendUp: true,
      icon: <FileTextOutlined />,
      color: '#5D8C3E'
    },
    { 
      title: 'Active Candidates', 
      value: 156, 
      trend: '+8%',
      trendUp: true,
      icon: <TeamOutlined />,
      color: '#1890ff'
    },
    { 
      title: 'Interviews This Week', 
      value: 18, 
      trend: '-5%',
      trendUp: false,
      icon: <CalendarOutlined />,
      color: '#faad14'
    },
    { 
      title: 'Offers Sent', 
      value: 8, 
      trend: '+3',
      trendUp: true,
      icon: <CheckCircleOutlined />,
      color: '#52c41a'
    },
  ];

  const recentJobs = [
    { id: 1, title: 'Senior Frontend Developer', department: 'Engineering', applications: 45, status: 'active' },
    { id: 2, title: 'Product Manager', department: 'Product', applications: 32, status: 'active' },
    { id: 3, title: 'UX Designer', department: 'Design', applications: 28, status: 'paused' },
    { id: 4, title: 'Backend Engineer', department: 'Engineering', applications: 38, status: 'active' },
  ];

  const upcomingInterviews = [
    { id: 1, candidate: 'Alex Morgan', position: 'Frontend Developer', time: 'Today, 2:00 PM', status: 'upcoming' },
    { id: 2, candidate: 'Jane Doe', position: 'Product Manager', time: 'Tomorrow, 10:00 AM', status: 'upcoming' },
    { id: 3, candidate: 'John Smith', position: 'UX Designer', time: 'Tomorrow, 3:00 PM', status: 'pending' },
  ];

  const pipelineData = [
    { stage: 'Applied', count: 45, color: '#1890ff' },
    { stage: 'Screening', count: 28, color: '#722ed1' },
    { stage: 'Interview', count: 15, color: '#faad14' },
    { stage: 'Offer', count: 4, color: '#52c41a' },
  ];

  const columns = [
    {
      title: 'Job Title',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div className="job-title-cell">
          <span className="job-title">{text}</span>
          <Text type="secondary" className="job-department">{record.department}</Text>
        </div>
      ),
    },
    {
      title: 'Applications',
      dataIndex: 'applications',
      key: 'applications',
      render: (val) => <span className="applications-count">{val}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'success' : 'default'}>
          {status === 'active' ? 'Active' : 'Paused'}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="link" 
          className="view-btn"
          onClick={() => navigate(`/recruiter/jobs/${record.id}/candidates`)}
        >
          View <RightOutlined />
        </Button>
      ),
    },
  ];

  return (
    <div className="dashboard-page recruiter-dashboard">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Dashboard</Title>
          <Text type="secondary">Welcome back! Here's what's happening today.</Text>
        </div>
        <div className="header-actions">
          <Button icon={<PlusOutlined />} type="primary" onClick={() => navigate('/recruiter/jobs/create')}>
            Post New Job
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <Row gutter={[20, 20]} className="stats-row">
        {stats.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card className="stat-card" bordered={false}>
              <div className="stat-card-content">
                <div className="stat-info">
                  <Text type="secondary" className="stat-title">{stat.title}</Text>
                  <div className="stat-value-row">
                    <span className="stat-value">{stat.value}{stat.suffix}</span>
                    <span className={`stat-trend ${stat.trendUp ? 'trend-up' : 'trend-down'}`}>
                      {stat.trendUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                      {stat.trend}
                    </span>
                  </div>
                </div>
                <div className="stat-icon" style={{ backgroundColor: `${stat.color}15` }}>
                  <span style={{ color: stat.color }}>{stat.icon}</span>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[20, 20]}>
        {/* Pipeline Overview */}
        <Col xs={24} lg={8}>
          <Card className="dashboard-card pipeline-card" bordered={false}>
            <div className="card-header">
              <Title level={5}>Pipeline Overview</Title>
              <Tag color="processing">This Week</Tag>
            </div>
            <div className="pipeline-chart">
              {pipelineData.map((item, index) => (
                <div key={index} className="pipeline-item">
                  <div className="pipeline-label">
                    <span className="pipeline-dot" style={{ backgroundColor: item.color }}></span>
                    <span>{item.stage}</span>
                    <span className="pipeline-count">{item.count}</span>
                  </div>
                  <Progress 
                    percent={(item.count / 50) * 100} 
                    showInfo={false}
                    strokeColor={item.color}
                    trailColor="#f0f0f0"
                    size="small"
                  />
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* Upcoming Interviews */}
        <Col xs={24} lg={16}>
          <Card className="dashboard-card" bordered={false}>
            <div className="card-header">
              <Title level={5}>Upcoming Interviews</Title>
              <Button type="link" onClick={() => navigate('/interviewer/incoming')}>
                View All <RightOutlined />
              </Button>
            </div>
            <List
              itemLayout="horizontal"
              dataSource={upcomingInterviews}
              renderItem={(item) => (
                <List.Item className="interview-item">
                  <List.Item.Meta
                    avatar={
                      <Avatar 
                        size={44} 
                        style={{ backgroundColor: '#5D8C3E' }}
                        icon={<TeamOutlined />}
                      />
                    }
                    title={<span className="candidate-name">{item.candidate}</span>}
                    description={
                      <div className="interview-meta">
                        <span>{item.position}</span>
                        <span className="separator">•</span>
                        <ClockCircleOutlined />
                        <span>{item.time}</span>
                      </div>
                    }
                  />
                  <Tag color={item.status === 'upcoming' ? 'processing' : 'warning'}>
                    {item.status === 'upcoming' ? 'Confirmed' : 'Pending'}
                  </Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* Recent Jobs Table */}
      <Card className="dashboard-card recent-jobs-card" bordered={false}>
        <div className="card-header">
          <Title level={5}>Recent Job Posts</Title>
          <Button type="link" onClick={() => navigate('/recruiter/jobs')}>
            View All Jobs <RightOutlined />
          </Button>
        </div>
        <Table 
          columns={columns} 
          dataSource={recentJobs} 
          rowKey="id"
          pagination={false}
          className="jobs-table"
        />
      </Card>

      {/* Quick Actions */}
      <Row gutter={[20, 20]} className="quick-actions-row">
        <Col xs={24}>
          <Card className="dashboard-card quick-actions-card" bordered={false}>
            <div className="card-header">
              <Title level={5}>Quick Actions</Title>
            </div>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <div className="quick-action-item" onClick={() => navigate('/recruiter/jobs/create')}>
                  <div className="action-icon" style={{ backgroundColor: 'rgba(93, 140, 62, 0.1)' }}>
                    <FileTextOutlined style={{ color: '#5D8C3E' }} />
                  </div>
                  <span>Post New Job</span>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div className="quick-action-item" onClick={() => navigate('/recruiter/jobs')}>
                  <div className="action-icon" style={{ backgroundColor: 'rgba(24, 144, 255, 0.1)' }}>
                    <TeamOutlined style={{ color: '#1890ff' }} />
                  </div>
                  <span>View Candidates</span>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div className="quick-action-item" onClick={() => navigate('/interviews/schedule')}>
                  <div className="action-icon" style={{ backgroundColor: 'rgba(250, 173, 20, 0.1)' }}>
                    <CalendarOutlined style={{ color: '#faad14' }} />
                  </div>
                  <span>Schedule Interview</span>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div className="quick-action-item" onClick={() => navigate('/quiz/create')}>
                  <div className="action-icon" style={{ backgroundColor: 'rgba(82, 196, 26, 0.1)' }}>
                    <RiseOutlined style={{ color: '#52c41a' }} />
                  </div>
                  <span>Create Quiz</span>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default RecruiterDashboard;
