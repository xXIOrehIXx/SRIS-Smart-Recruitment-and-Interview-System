import React from 'react';
import { Row, Col, Card, Table, Tag, Avatar, Button, Typography, List } from 'antd';
import { CalendarOutlined, ClockCircleOutlined, CheckCircleOutlined, UserOutlined, VideoCameraOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import '../Dashboard.css';

const { Title, Text } = Typography;

const InterviewerDashboard = () => {
  const navigate = useNavigate();

  const stats = [
    { title: 'Total Interviews', value: 24, icon: <CalendarOutlined />, color: '#5D8C3E' },
    { title: 'Pending Grading', value: 5, icon: <ClockCircleOutlined />, color: '#faad14' },
    { title: 'Completed', value: 18, icon: <CheckCircleOutlined />, color: '#52c41a' },
    { title: 'Avg Score', value: 82, suffix: '%', icon: <TeamOutlined />, color: '#1890ff' },
  ];

  const upcomingInterviews = [
    { id: 1, candidate: 'Alex Morgan', position: 'Frontend Developer', time: 'Today, 2:00 PM', type: 'Technical' },
    { id: 2, candidate: 'Jane Doe', position: 'Product Manager', time: 'Tomorrow, 10:00 AM', type: 'HR' },
    { id: 3, candidate: 'John Smith', position: 'UX Designer', time: 'Jun 26, 3:00 PM', type: 'Culture' },
  ];

  const pendingGrading = [
    { id: 1, candidate: 'Sam Wilson', position: 'Backend Engineer', interviewDate: '2026-06-20', score: null },
    { id: 2, candidate: 'Emily Chen', position: 'Data Analyst', interviewDate: '2026-06-21', score: null },
    { id: 3, candidate: 'Mike Brown', position: 'DevOps Engineer', interviewDate: '2026-06-22', score: null },
  ];

  const columns = [
    {
      title: 'Candidate',
      dataIndex: 'candidate',
      key: 'candidate',
      render: (text) => (
        <div className="candidate-cell">
          <Avatar style={{ backgroundColor: '#5D8C3E' }}>{text[0]}</Avatar>
          <span>{text}</span>
        </div>
      ),
    },
    { title: 'Position', dataIndex: 'position', key: 'position' },
    { title: 'Date', dataIndex: 'interviewDate', key: 'interviewDate' },
    {
      title: 'Status',
      dataIndex: 'score',
      key: 'score',
      render: () => <Tag color="warning">Pending</Tag>,
    },
    {
      title: '',
      key: 'action',
      render: () => (
        <Button type="primary" size="small" onClick={() => navigate('/interviewer/grading/1')}>
          Grade Now
        </Button>
      ),
    },
  ];

  return (
    <div className="dashboard-page interviewer-dashboard">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Interviewer Dashboard</Title>
          <Text type="secondary">Welcome back! Here's your interview schedule.</Text>
        </div>
      </div>

      <Row gutter={[20, 20]} className="stats-row">
        {stats.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card className="stat-card" bordered={false}>
              <div className="stat-card-content">
                <div className="stat-info">
                  <Text type="secondary" className="stat-title">{stat.title}</Text>
                  <span className="stat-value">{stat.value}{stat.suffix}</span>
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
        <Col xs={24} lg={12}>
          <Card className="dashboard-card" bordered={false}>
            <div className="card-header">
              <Title level={5}>Upcoming Interviews</Title>
              <Button type="link" onClick={() => navigate('/interviewer/incoming')}>View All</Button>
            </div>
            <List
              itemLayout="horizontal"
              dataSource={upcomingInterviews}
              renderItem={(item) => (
                <List.Item className="interview-item">
                  <List.Item.Meta
                    avatar={<Avatar size={44} style={{ backgroundColor: '#5D8C3E' }} icon={<UserOutlined />} />}
                    title={<span className="candidate-name">{item.candidate}</span>}
                    description={
                      <div className="interview-meta">
                        <span>{item.position}</span>
                        <span>•</span>
                        <span><ClockCircleOutlined /> {item.time}</span>
                      </div>
                    }
                  />
                  <Tag color="blue">{item.type}</Tag>
                  <Button type="primary" icon={<VideoCameraOutlined />} className="join-btn">
                    Join
                  </Button>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card className="dashboard-card" bordered={false}>
            <div className="card-header">
              <Title level={5}>Pending Grading</Title>
            </div>
            <Table columns={columns} dataSource={pendingGrading} rowKey="id" pagination={false} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default InterviewerDashboard;
