import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Table, Tag, Avatar, Button, Typography, List, Progress, Select, Spin, message } from 'antd';
import {
  FileTextOutlined,
  TeamOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  PlusOutlined,
  RightOutlined,
  ClockCircleOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TrophyOutlined,
  RiseOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, jobsAPI } from '../../services/api';
import './AdminDashboard.css';

const { Title, Text } = Typography;

// Matcha color palette
const MATCHA_GREEN = '#5D8C3E';
const MATCHA_LIGHT = 'rgba(93, 140, 62, 0.1)';
const MATCHA_BG = '#f4f8f2';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  console.log('AdminDashboard mounted'); // DEBUG

  // Fetch dashboard data
  useEffect(() => {
    console.log('useEffect triggered, selectedJob:', selectedJob); // DEBUG
    fetchDashboard();
    fetchJobs();
  }, [selectedJob]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getOverview(selectedJob);
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      message.error('Không thể tải dữ liệu dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      setJobs(response.data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  // Stats cards data
  const stats = [
    {
      title: 'Tổng Tin Tuyển Dụng',
      value: dashboardData?.summary?.totalApplications || 0,
      suffix: '',
      trend: '+12%',
      trendUp: true,
      icon: <FileTextOutlined />,
      color: MATCHA_GREEN
    },
    {
      title: 'Ứng Viên Tiếp Nhận',
      value: dashboardData?.summary?.inPipeline || 0,
      suffix: '',
      trend: '+8%',
      trendUp: true,
      icon: <TeamOutlined />,
      color: '#1890ff'
    },
    {
      title: 'Ứng Viên Đã Tuyển',
      value: dashboardData?.summary?.hired || 0,
      suffix: '',
      trend: '+3',
      trendUp: true,
      icon: <UserOutlined />,
      color: '#52c41a'
    },
    {
      title: 'Tỷ Lệ Chấp Nhận Offer',
      value: dashboardData?.summary?.offerAcceptanceRatePct || 0,
      suffix: '%',
      trend: '+5%',
      trendUp: true,
      icon: <TrophyOutlined />,
      color: '#faad14'
    },
  ];

  // Pipeline stages
  const funnelData = dashboardData?.funnel || [];
  const maxFunnel = Math.max(...funnelData.map(f => f.count), 1);

  // Recent applications placeholder
  const recentApplications = [
    { id: 1, name: 'Nguyễn Văn A', email: 'nguyenvana@email.com', job: 'Senior Frontend Developer', status: 'new', time: '2 giờ trước' },
    { id: 2, name: 'Trần Thị B', email: 'tranthib@email.com', job: 'Backend Engineer', status: 'screening', time: '5 giờ trước' },
    { id: 3, name: 'Lê Văn C', email: 'levanc@email.com', job: 'Product Manager', status: 'interview', time: '1 ngày trước' },
    { id: 4, name: 'Phạm Thị D', email: 'phamthid@email.com', job: 'UX Designer', status: 'offer', time: '2 ngày trước' },
  ];

  const getStatusColor = (status) => {
    const colors = {
      new: 'blue',
      screening: 'purple',
      interview: 'orange',
      offer: 'green',
      hired: 'green',
      rejected: 'red'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status) => {
    const texts = {
      new: 'Mới',
      screening: 'Đang sàng lọc',
      interview: 'Phỏng vấn',
      offer: 'Offer',
      hired: 'Đã tuyển',
      rejected: 'Từ chối'
    };
    return texts[status] || status;
  };

  const applicationColumns = [
    {
      title: 'Ứng Viên',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="candidate-cell">
          <Avatar size={36} style={{ backgroundColor: MATCHA_GREEN }} icon={<TeamOutlined />} />
          <div>
            <div className="candidate-name">{text}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Vị Trí',
      dataIndex: 'job',
      key: 'job',
      render: (text) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
    },
    {
      title: 'Thời Gian',
      dataIndex: 'time',
      key: 'time',
      render: (time) => (
        <span style={{ color: '#8c8c8b', fontSize: 13 }}>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          {time}
        </span>
      ),
    },
  ];

  if (loading && !dashboardData) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="dashboard-page admin-dashboard">
      {/* Header */}
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Trang Chủ</Title>
          <Text type="secondary">Tổng quan hệ thống tuyển dụng</Text>
        </div>
        <div className="header-actions">
          <Select
            placeholder="Chọn vị trí"
            allowClear
            style={{ width: 200 }}
            onChange={(value) => {
              setSelectedJob(value);
            }}
            options={jobs.map(job => ({ value: job.JobId, label: job.title }))}
          />
          <Button icon={<PlusOutlined />} type="primary" onClick={() => navigate('/recruiter/jobs/create')}>
            Đăng Tin Mới
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
              <Title level={5}>Phễu Tuyển Dụng</Title>
              <Tag color="processing">Tổng</Tag>
            </div>
            <div className="pipeline-chart">
              {funnelData.length > 0 ? funnelData.map((item, index) => (
                <div key={index} className="pipeline-item">
                  <div className="pipeline-label">
                    <span className="pipeline-dot" style={{ backgroundColor: MATCHA_GREEN }}></span>
                    <span>{item.state}</span>
                    <span className="pipeline-count">{item.count}</span>
                  </div>
                  <Progress
                    percent={(item.count / maxFunnel) * 100}
                    showInfo={false}
                    strokeColor={MATCHA_GREEN}
                    trailColor="#f0f0f0"
                    size="small"
                  />
                </div>
              )) : (
                <div style={{ textAlign: 'center', padding: '20px', color: '#8c8c8b' }}>
                  Chưa có dữ liệu phễu
                </div>
              )}
            </div>
          </Card>
        </Col>

        {/* Pipeline Mobile (show on small screens when no funnel data) */}
        <Col xs={24} lg={16}>
          <Card className="dashboard-card" bordered={false}>
            <div className="card-header">
              <Title level={5}>Ứng Viên Ứng Tuyển Gần Đây</Title>
              <Button type="link" onClick={() => navigate('/recruiter/jobs')}>
                Xem tất cả <RightOutlined />
              </Button>
            </div>
            <Table
              columns={applicationColumns}
              dataSource={recentApplications}
              rowKey="id"
              pagination={false}
              className="applications-table"
            />
          </Card>
        </Col>
      </Row>

      {/* Quick Stats Row */}
      <Row gutter={[20, 20]} className="quick-stats-row">
        <Col xs={24} sm={8}>
          <Card className="dashboard-card quick-stat-card" bordered={false}>
            <div className="quick-stat-content">
              <div className="quick-stat-icon" style={{ backgroundColor: MATCHA_LIGHT }}>
                <CheckCircleOutlined style={{ color: MATCHA_GREEN, fontSize: 24 }} />
              </div>
              <div className="quick-stat-info">
                <Text type="secondary">Offers Gửi Đi</Text>
                <div className="quick-stat-value">{dashboardData?.summary?.offersSent || 0}</div>
              </div>
            </div>
            <Progress
              percent={dashboardData?.summary?.totalApplications > 0
                ? Math.round((dashboardData?.summary?.offersSent / dashboardData?.summary?.totalApplications) * 100)
                : 0}
              strokeColor={MATCHA_GREEN}
              showInfo={false}
              className="quick-stat-progress"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="dashboard-card quick-stat-card" bordered={false}>
            <div className="quick-stat-content">
              <div className="quick-stat-icon" style={{ backgroundColor: 'rgba(82, 196, 26, 0.1)' }}>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />
              </div>
              <div className="quick-stat-info">
                <Text type="secondary">Offers Đã Chấp Nhận</Text>
                <div className="quick-stat-value">{dashboardData?.summary?.offersAccepted || 0}</div>
              </div>
            </div>
            <Progress
              percent={dashboardData?.summary?.offersSent > 0
                ? Math.round((dashboardData?.summary?.offersAccepted / dashboardData?.summary?.offersSent) * 100)
                : 0}
              strokeColor="#52c41a"
              showInfo={false}
              className="quick-stat-progress"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="dashboard-card quick-stat-card" bordered={false}>
            <div className="quick-stat-content">
              <div className="quick-stat-icon" style={{ backgroundColor: 'rgba(255, 77, 79, 0.1)' }}>
                <ArrowDownOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />
              </div>
              <div className="quick-stat-info">
                <Text type="secondary">Từ Chối</Text>
                <div className="quick-stat-value">{dashboardData?.summary?.rejected || 0}</div>
              </div>
            </div>
            <Progress
              percent={dashboardData?.summary?.totalApplications > 0
                ? Math.round((dashboardData?.summary?.rejected / dashboardData?.summary?.totalApplications) * 100)
                : 0}
              strokeColor="#ff4d4f"
              showInfo={false}
              className="quick-stat-progress"
            />
          </Card>
        </Col>
      </Row>

      {/* Offer Stats */}
      <Card className="dashboard-card" bordered={false}>
        <div className="card-header">
          <Title level={5}>Thống Kê Offer</Title>
        </div>
        <Row gutter={[24, 24]}>
          <Col xs={24} md={6}>
            <div className="offer-stat-item">
              <Text type="secondary">Đã Gửi</Text>
              <div className="offer-stat-value" style={{ color: '#1890ff' }}>
                {dashboardData?.summary?.offersSent || 0}
              </div>
            </div>
          </Col>
          <Col xs={24} md={6}>
            <div className="offer-stat-item">
              <Text type="secondary">Chấp Nhận</Text>
              <div className="offer-stat-value" style={{ color: '#52c41a' }}>
                {dashboardData?.summary?.offersAccepted || 0}
              </div>
            </div>
          </Col>
          <Col xs={24} md={6}>
            <div className="offer-stat-item">
              <Text type="secondary">Từ Chối</Text>
              <div className="offer-stat-value" style={{ color: '#ff4d4f' }}>
                {dashboardData?.summary?.offersDeclined || 0}
              </div>
            </div>
          </Col>
          <Col xs={24} md={6}>
            <div className="offer-stat-item">
              <Text type="secondary">Đang Chờ</Text>
              <div className="offer-stat-value" style={{ color: '#faad14' }}>
                {dashboardData?.summary?.offersPending || 0}
              </div>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default AdminDashboard;
