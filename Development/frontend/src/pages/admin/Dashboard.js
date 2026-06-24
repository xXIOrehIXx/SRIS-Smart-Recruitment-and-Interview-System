import React from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Typography, Progress, List, Badge, Button } from 'antd';
import { 
  TeamOutlined, 
  UserOutlined, 
  CheckCircleOutlined,
  RiseOutlined,
  AlertOutlined,
  ArrowUpOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import '../Dashboard.css';

const { Title, Text } = Typography;

const AdminDashboard = () => {
  const navigate = useNavigate();

  const stats = [
    { 
      title: 'Total Companies', 
      value: 45, 
      trend: '+5',
      icon: <TeamOutlined />,
      color: '#5D8C3E'
    },
    { 
      title: 'Active Users', 
      value: 234, 
      trend: '+12',
      icon: <UserOutlined />,
      color: '#1890ff'
    },
    { 
      title: 'Jobs Posted', 
      value: 128, 
      trend: '+8',
      icon: <CheckCircleOutlined />,
      color: '#52c41a'
    },
    { 
      title: 'Pending Approval', 
      value: 12, 
      trend: '-3',
      icon: <AlertOutlined />,
      color: '#faad14'
    },
  ];

  const companies = [
    { id: 1, name: 'Tech Corp Vietnam', plan: 'Enterprise', users: 45, status: 'active' },
    { id: 2, name: 'StartupXYZ', plan: 'Professional', users: 12, status: 'active' },
    { id: 3, name: 'Global Solutions', plan: 'Enterprise', users: 78, status: 'active' },
    { id: 4, name: 'Digital Dynamics', plan: 'Starter', users: 5, status: 'pending' },
  ];

  const systemHealth = [
    { name: 'API Server', status: 'healthy', uptime: '99.9%' },
    { name: 'Database', status: 'healthy', uptime: '99.8%' },
    { name: 'File Storage', status: 'healthy', uptime: '99.99%' },
    { name: 'Email Service', status: 'warning', uptime: '98.5%' },
  ];

  const columns = [
    {
      title: 'Company',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <span style={{ fontWeight: 600 }}>{text}</span>,
    },
    {
      title: 'Plan',
      dataIndex: 'plan',
      key: 'plan',
      render: (plan) => <Tag color={plan === 'Enterprise' ? 'gold' : plan === 'Professional' ? 'purple' : 'blue'}>{plan}</Tag>,
    },
    {
      title: 'Users',
      dataIndex: 'users',
      key: 'users',
      render: (users) => <Badge count={users} showZero style={{ backgroundColor: '#5D8C3E' }} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'success' : 'warning'}>
          {status === 'active' ? 'Active' : 'Pending'}
        </Tag>
      ),
    },
  ];

  return (
    <div className="dashboard-page admin-dashboard">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Admin Dashboard</Title>
          <Text type="secondary">System overview and management</Text>
        </div>
        <div className="header-actions">
          <Button type="primary" onClick={() => navigate('/admin/create-account')}>
            Add Company
          </Button>
        </div>
      </div>

      <Row gutter={[20, 20]} className="stats-row">
        {stats.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card className="stat-card" bordered={false}>
              <div className="stat-card-content">
                <div className="stat-info">
                  <Text type="secondary" className="stat-title">{stat.title}</Text>
                  <div className="stat-value-row">
                    <span className="stat-value">{stat.value}</span>
                    <span className="stat-trend trend-up">
                      <ArrowUpOutlined /> {stat.trend}
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
        <Col xs={24} lg={16}>
          <Card className="dashboard-card" bordered={false}>
            <div className="card-header">
              <Title level={5}>Company Overview</Title>
              <Button type="link">View All</Button>
            </div>
            <Table columns={columns} dataSource={companies} rowKey="id" pagination={false} />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="dashboard-card" bordered={false}>
            <div className="card-header">
              <Title level={5}>System Health</Title>
              <Tag color="success">All Systems Operational</Tag>
            </div>
            <List
              itemLayout="horizontal"
              dataSource={systemHealth}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={item.name}
                    description={`Uptime: ${item.uptime}`}
                  />
                  <Tag color={item.status === 'healthy' ? 'success' : 'warning'}>
                    {item.status}
                  </Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card className="dashboard-card" bordered={false}>
        <div className="card-header">
          <Title level={5}>Revenue Overview</Title>
        </div>
        <Row gutter={[24, 24]}>
          <Col xs={24} md={8}>
            <Statistic title="Monthly Revenue" value={45600} prefix="$" />
            <Progress percent={75} strokeColor="#5D8C3E" />
          </Col>
          <Col xs={24} md={8}>
            <Statistic title="Yearly Revenue" value={456000} prefix="$" />
            <Progress percent={60} strokeColor="#1890ff" />
          </Col>
          <Col xs={24} md={8}>
            <Statistic title="Growth" value={12.5} suffix="%" prefix={<RiseOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default AdminDashboard;
