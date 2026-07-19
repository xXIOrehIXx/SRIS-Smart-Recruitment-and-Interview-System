import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Table, Tag, Avatar, Button, Typography, List, Progress, Select, Spin, message, Badge, Space, Modal, Descriptions, Statistic, Divider } from 'antd';
import {
  FileTextOutlined,
  TeamOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  PlusOutlined,
  RightOutlined,
  CalendarOutlined,
  BellOutlined,
  TrophyOutlined,
  VideoCameraOutlined,
  CloseCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { dashboardAPI, interviewAPI, jobsAPI, applicationAPI } from '../services/api';
import dayjs from 'dayjs';
import './Dashboard.css';

const { Title, Text } = Typography;
const { Option } = Select;
const MATCHA_GREEN = '#5D8C3E';

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const role = user?.role;
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);

  // Interviewer states
  const [upcomingInterviews, setUpcomingInterviews] = useState([]);
  const [pendingGrading, setPendingGrading] = useState([]);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const isAdmin = role === ROLES.ADMIN;
  const isDeptManager = role === ROLES.DEPARTMENT_MANAGER;
  const isInterviewer = role === ROLES.INTERVIEWER;

  useEffect(() => {
    if (isInterviewer) {
      fetchInterviewerData();
    } else {
      fetchDashboard();
      fetchJobs();
    }
  }, [selectedJob, isInterviewer]);

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

  const fetchInterviewerData = async () => {
    try {
      setLoading(true);
      const [overviewRes, scheduleRes] = await Promise.all([
        dashboardAPI.getOverview().catch(() => ({ data: null })),
        interviewAPI.getMySchedules().catch(() => ({ data: [] })),
      ]);
      setDashboardData(overviewRes?.data || null);
      let data = scheduleRes?.data || [];
      if (!Array.isArray(data)) {
        data = data.interviews || data.schedules || data.items || [];
      }
      const normalized = Array.isArray(data) ? data.map((item) => ({
        id: item.scheduleId || item.id,
        applicationId: item.applicationId,
        candidate: item.candidateName || item.candidate || 'N/A',
        position: item.positionTitle || item.jobTitle || item.position || 'N/A',
        jobId: item.jobId,
        department: item.department || 'N/A',
        date: item.interviewDate || item.scheduledDate || item.date,
        time: item.interviewTime || item.startTime || item.time,
        endTime: item.endTime || item.interviewEndTime,
        duration: item.duration || 60,
        type: item.interviewType || item.type || 'Technical',
        level: item.round || item.interviewRound || item.level || 1,
        status: item.status || 'UPCOMING',
        meetingLink: item.meetingLink || item.meetingUrl || '',
      })) : [];
      const upcoming = normalized.filter(i => i.status === 'UPCOMING' || i.status === 'CONFIRMED' || i.status === 'PENDING');
      setUpcomingInterviews(upcoming.slice(0, 5));
      setPendingGrading(normalized.filter(i => i.status === 'PENDING').slice(0, 5));
    } catch (error) {
      console.error('Error fetching interviewer dashboard:', error);
      message.error('Không thể tải dữ liệu dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidatesBySchedule = async (applicationId) => {
    // 1 buoi phong van gan voi dung 1 ho so — doc chi tiet qua /applications/{id}
    // (Interviewer co quyen; KHONG dung /aggregate — panel tong hop chi cho Recruiter/DM).
    try {
      setLoadingCandidates(true);
      const response = await applicationAPI.getById(applicationId);
      const app = response.data;
      setCandidates(app ? [{
        id: app.applicationId,
        applicationId: app.applicationId,
        name: app.candidateName,
        candidateName: app.candidateName,
        email: app.candidateEmail,
        position: app.jobTitle,
        currentState: app.currentState,
        aiMatchScore: app.aiMatchScore,
      }] : []);
    } catch (error) {
      console.error('Error fetching candidate:', error);
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const getTypeColor = (type) => {
    const colors = { Technical: 'blue', HR: 'green', Culture: 'purple' };
    return colors[type] || 'default';
  };

  const handleShowCandidates = (schedule) => {
    setSelectedSchedule(schedule);
    fetchCandidatesBySchedule(schedule.applicationId);
    setCandidateModalOpen(true);
  };

  const handleGradeCandidate = (scheduleId, candidate) => {
    setCandidateModalOpen(false);
    navigate(`/interviewer/grading/${scheduleId}`, { state: { scheduleId, candidate } });
  };

  const gradingColumns = [
    {
      title: 'Ứng viên',
      key: 'candidate',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />
          <div>
            <Text strong>{record.candidateName || record.candidate || record.name || 'N/A'}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{record.position || record.jobTitle || 'N/A'}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 120,
      render: (_, record) => {
        const isGraded = record.hasGraded || record.isGraded || record.score !== null;
        return isGraded ? <Tag color="success">Đã chấm</Tag> : <Tag color="warning">Chưa chấm</Tag>;
      },
    },
    {
      title: 'Điểm',
      key: 'score',
      width: 100,
      render: (_, record) => record.score !== undefined && record.score !== null
        ? <Text strong style={{ color: MATCHA_GREEN }}>{record.score}/{record.maxScore || 100}</Text>
        : <Text type="secondary">-</Text>,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 130,
      render: (_, record) => {
        const isGraded = record.hasGraded || record.isGraded || record.score !== null;
        return (
          <Button
            type={isGraded ? 'default' : 'primary'}
            size="small"
            icon={isGraded ? <EyeOutlined /> : <PlusOutlined />}
            onClick={() => handleGradeCandidate(selectedSchedule?.id, record)}
            style={{ background: isGraded ? undefined : MATCHA_GREEN, borderColor: isGraded ? MATCHA_GREEN : undefined, color: isGraded ? MATCHA_GREEN : '#fff' }}
          >
            {isGraded ? 'Sửa' : 'Chấm điểm'}
          </Button>
        );
      },
    },
  ];

  const stats = React.useMemo(() => {
    const summary = dashboardData?.summary || {};
    if (isAdmin) {
      return [
        { title: 'Tổng Tin Tuyển Dụng', value: summary.totalApplications || 0, trend: '+12%', trendUp: true, icon: <FileTextOutlined />, color: MATCHA_GREEN },
        { title: 'Ứng Viên Tiếp Nhận', value: summary.inPipeline || 0, trend: '+8%', trendUp: true, icon: <TeamOutlined />, color: '#1890ff' },
        { title: 'Ứng Viên Đã Tuyển', value: summary.hired || 0, trend: '+3', trendUp: true, icon: <UserOutlined />, color: '#52c41a' },
        { title: 'Tỷ Lệ Chấp Nhận Offer', value: summary.offerAcceptanceRatePct || 0, suffix: '%', trend: '+5%', trendUp: true, icon: <TrophyOutlined />, color: '#faad14' },
      ];
    }
    if (isDeptManager) {
      return [
        { title: 'Yêu Cầu Tuyển Dụng', value: summary.recruitmentRequests || 0, icon: <FileTextOutlined />, color: MATCHA_GREEN },
        { title: 'Chờ Phê Duyệt', value: summary.pendingApprovals || 0, icon: <ClockCircleOutlined />, color: '#faad14' },
        { title: 'Đã Phê Duyệt', value: summary.approvedRequests || 0, icon: <CheckCircleOutlined />, color: '#52c41a' },
        { title: 'Ứng Viên Quan Tâm', value: summary.inPipeline || 0, icon: <TeamOutlined />, color: '#1890ff' },
      ];
    }
    if (isInterviewer) {
      return [
        { title: 'Total Interviews', value: dashboardData?.summary?.totalInterviews || upcomingInterviews.length + pendingGrading.length, icon: <CalendarOutlined />, color: MATCHA_GREEN },
        { title: 'Pending Grading', value: pendingGrading.length, icon: <ClockCircleOutlined />, color: '#faad14' },
        { title: 'Completed', value: dashboardData?.summary?.completed || 0, icon: <CheckCircleOutlined />, color: '#52c41a' },
        { title: 'Avg Score', value: dashboardData?.summary?.avgScore || 82, suffix: '%', icon: <TeamOutlined />, color: '#1890ff' },
      ];
    }
    return [];
  }, [dashboardData, isAdmin, isDeptManager, isInterviewer, upcomingInterviews.length, pendingGrading.length]);

  const funnelData = dashboardData?.funnel || [];
  const maxFunnel = Math.max(...funnelData.map(f => f.count), 1);

  if (loading && !dashboardData) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  const renderHeaderActions = () => {
    if (isAdmin || isDeptManager) {
      return (
        <div className="header-actions">
          <Select
            placeholder="Chọn vị trí"
            allowClear
            style={{ width: 200 }}
            value={selectedJob}
            onChange={setSelectedJob}
            options={jobs.map(job => ({ value: job.jobId, label: job.title }))}
          />
          {(isAdmin || isDeptManager) && (
            <Button icon={<PlusOutlined />} type="primary" onClick={() => navigate(isAdmin ? '/recruiter/jobs/create' : '/dept/create-request')}>
              {isAdmin ? 'Đăng Tin Mới' : 'Tạo Yêu Cầu'}
            </Button>
          )}
        </div>
      );
    }
    if (isInterviewer) {
      return (
        <div className="header-actions">
          <Button icon={<PlusOutlined />} type="primary" onClick={() => navigate('/dept/create-request')}>
            Làm mới
          </Button>
        </div>
      );
    }
    return null;
  };

  const getTitle = () => {
    if (isAdmin) return 'Trang Chủ';
    if (isDeptManager) return 'Dashboard - Trưởng Phòng';
    if (isInterviewer) return 'Interviewer Dashboard';
    return 'Dashboard';
  };

  const getSubTitle = () => {
    if (isAdmin) return 'Tổng quan hệ thống tuyển dụng';
    if (isDeptManager) return 'Tổng quan yêu cầu tuyển dụng và quyết định hiring';
    if (isInterviewer) return 'Welcome back! Here\'s your interview schedule.';
    return '';
  };

  const pageTitleClass = isAdmin ? 'admin-dashboard' : isDeptManager ? 'dept-dashboard' : 'interviewer-dashboard';

  return (
    <div className={`dashboard-page ${pageTitleClass}`}>
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">{getTitle()}</Title>
          <Text type="secondary">{getSubTitle()}</Text>
        </div>
        <div className="header-actions">
          {renderHeaderActions()}
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
                    <span className="stat-value">{stat.value}{stat.suffix || ''}</span>
                    {stat.trend && <span className={`stat-trend ${stat.trendUp ? 'trend-up' : 'trend-down'}`}>
                      {stat.trendUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />}{stat.trend}
                    </span>}
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

      {isAdmin && (
        <>
          <Row gutter={[20, 20]}>
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
                      <Progress percent={(item.count / maxFunnel) * 100} showInfo={false} strokeColor={MATCHA_GREEN} trailColor="#f0f0f0" size="small" />
                    </div>
                  )) : (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#8c8c8b' }}>Chưa có dữ liệu phễu</div>
                  )}
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={16}>
              <Card className="dashboard-card" bordered={false}>
                <div className="card-header">
                  <Title level={5}>Ứng Viên Ứng Tuyển Gần Đây</Title>
                  <Button type="link" onClick={() => navigate('/recruiter/jobs')}>Xem tất cả <RightOutlined /></Button>
                </div>
                <Table
                  columns={[
                    { title: 'Ứng Viên', dataIndex: 'name', key: 'name', render: (text, record) => (
                      <div className="candidate-cell"><Avatar size={36} style={{ backgroundColor: MATCHA_GREEN }} icon={<TeamOutlined />} /><div><div className="candidate-name">{text}</div><Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text></div></div>
                    )},
                    { title: 'Vị Trí', dataIndex: 'job', key: 'job', render: (text) => <span style={{ fontWeight: 500 }}>{text}</span> },
                    { title: 'Trạng Thái', dataIndex: 'status', key: 'status', render: (status) => <Tag color={status === 'new' ? 'blue' : status === 'offer' ? 'green' : 'default'}>{status}</Tag> },
                    { title: 'Thời Gian', dataIndex: 'time', key: 'time', render: (time) => <span style={{ color: '#8c8c8b', fontSize: 13 }}><ClockCircleOutlined style={{ marginRight: 4 }} />{time}</span> },
                  ]}
                  dataSource={[]}
                  rowKey="id"
                  pagination={false}
                  className="applications-table"
                />
              </Card>
            </Col>
          </Row>
          <Row gutter={[20, 20]} className="quick-stats-row">
            <Col xs={24} sm={8}>
              <Card className="dashboard-card quick-stat-card" bordered={false}>
                <div className="quick-stat-content">
                  <div className="quick-stat-icon" style={{ backgroundColor: 'rgba(93, 140, 62, 0.1)' }}><CheckCircleOutlined style={{ color: MATCHA_GREEN, fontSize: 24 }} /></div>
                  <div className="quick-stat-info"><Text type="secondary">Offers Gửi Đi</Text><div className="quick-stat-value">{dashboardData?.summary?.offersSent || 0}</div></div>
                </div>
                <Progress percent={dashboardData?.summary?.totalApplications > 0 ? Math.round((dashboardData?.summary?.offersSent / dashboardData?.summary?.totalApplications) * 100) : 0} strokeColor={MATCHA_GREEN} showInfo={false} className="quick-stat-progress" />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card className="dashboard-card quick-stat-card" bordered={false}>
                <div className="quick-stat-content">
                  <div className="quick-stat-icon" style={{ backgroundColor: 'rgba(82, 196, 26, 0.1)' }}><CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} /></div>
                  <div className="quick-stat-info"><Text type="secondary">Offers Đã Chấp Nhận</Text><div className="quick-stat-value">{dashboardData?.summary?.offersAccepted || 0}</div></div>
                </div>
                <Progress percent={dashboardData?.summary?.offersSent > 0 ? Math.round((dashboardData?.summary?.offersAccepted / dashboardData?.summary?.offersSent) * 100) : 0} strokeColor="#52c41a" showInfo={false} className="quick-stat-progress" />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card className="dashboard-card quick-stat-card" bordered={false}>
                <div className="quick-stat-content">
                  <div className="quick-stat-icon" style={{ backgroundColor: 'rgba(255, 77, 79, 0.1)' }}><ArrowDownOutlined style={{ color: '#ff4d4f', fontSize: 24 }} /></div>
                  <div className="quick-stat-info"><Text type="secondary">Từ Chối</Text><div className="quick-stat-value">{dashboardData?.summary?.rejected || 0}</div></div>
                </div>
                <Progress percent={dashboardData?.summary?.totalApplications > 0 ? Math.round((dashboardData?.summary?.rejected / dashboardData?.summary?.totalApplications) * 100) : 0} strokeColor="#ff4d4f" showInfo={false} className="quick-stat-progress" />
              </Card>
            </Col>
          </Row>
          <Card className="dashboard-card" bordered={false}>
            <div className="card-header"><Title level={5}>Thống Kê Offer</Title></div>
            <Row gutter={[24, 24]}>
              <Col xs={24} md={6}><div className="offer-stat-item"><Text type="secondary">Đã Gửi</Text><div className="offer-stat-value" style={{ color: '#1890ff' }}>{dashboardData?.summary?.offersSent || 0}</div></div></Col>
              <Col xs={24} md={6}><div className="offer-stat-item"><Text type="secondary">Chấp Nhận</Text><div className="offer-stat-value" style={{ color: '#52c41a' }}>{dashboardData?.summary?.offersAccepted || 0}</div></div></Col>
              <Col xs={24} md={6}><div className="offer-stat-item"><Text type="secondary">Từ Chối</Text><div className="offer-stat-value" style={{ color: '#ff4d4f' }}>{dashboardData?.summary?.offersDeclined || 0}</div></div></Col>
              <Col xs={24} md={6}><div className="offer-stat-item"><Text type="secondary">Đang Chờ</Text><div className="offer-stat-value" style={{ color: '#faad14' }}>{dashboardData?.summary?.offersPending || 0}</div></div></Col>
            </Row>
          </Card>
        </>
      )}

      {isDeptManager && (
        <>
          <Row gutter={[20, 20]}>
            <Col xs={24} lg={14}>
              <Card className="dashboard-card" bordered={false}>
                <div className="card-header">
                  <Title level={5}>Yêu Cầu Chờ Phê Duyệt</Title>
                  <Button type="link" onClick={() => navigate('/dept/hiring-decision')}>Xem tất cả <RightOutlined /></Button>
                </div>
                <Table
                  columns={[
                    { title: 'Vị trí', key: 'title', render: (text, record) => (
                      <div><Text strong>{text}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{record.department}</Text></div>
                    )},
                    { title: 'Số lượng', dataIndex: 'positions', width: 100, render: (val) => <Tag color="blue">{val} vị trí</Tag> },
                    { title: 'Mức ưu tiên', dataIndex: 'priority', width: 110, render: (val) => <Tag color={val === 'High' ? 'error' : val === 'Medium' ? 'warning' : 'success'}>{val}</Tag> },
                    { title: 'Ngày gửi', dataIndex: 'submittedDate', width: 110 },
                    { title: 'Thao tác', key: 'actions', width: 120, render: (_, record) => (
                      <Space><Button type="link" size="small" onClick={() => navigate(`/dept/hiring-decision/${record.id}`)}>Xem</Button>
                      <Button type="primary" size="small" onClick={() => navigate(`/dept/hiring-decision`)} style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}>Duyệt</Button></Space>
                    )},
                  ]}
                  dataSource={dashboardData?.pendingRequests || []}
                  rowKey="id"
                  pagination={false}
                  scroll={{ x: 650 }}
                />
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card className="dashboard-card" bordered={false}>
                <div className="card-header">
                  <Title level={5}>Quyết Định Gần Đây</Title>
                  <Button type="link" onClick={() => navigate('/dept/hiring-decision')}>Xem tất cả <RightOutlined /></Button>
                </div>
                <Table
                  columns={[
                    { title: 'Ứng viên', key: 'candidate', render: (_, record) => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} /><Text strong>{record.candidate}</Text></div> },
                    { title: 'Vị trí', dataIndex: 'position', key: 'position' },
                    { title: 'Quyết định', dataIndex: 'action', key: 'action', render: (val) => <Tag color={val === 'APPROVED' ? 'success' : 'error'}>{val === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'}</Tag> },
                    { title: 'Ngày', dataIndex: 'date', key: 'date' },
                  ]}
                  dataSource={dashboardData?.recentDecisions || []}
                  rowKey="id"
                  pagination={false}
                />
              </Card>
            </Col>
          </Row>
          <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
            <Col xs={24} lg={12}>
              <Card className="dashboard-card" bordered={false}>
                <div className="card-header"><Title level={5}>Tiến Độ Tuyển Dụng Theo Phòng Ban</Title></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(dashboardData?.departmentProgress || []).map((dept, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><Text>{dept.department}</Text><Text type="secondary">{dept.filled || 0}/{dept.total || 0} vị trí</Text></div>
                      <Progress percent={dept.total > 0 ? Math.round((dept.filled / dept.total) * 100) : 0} strokeColor={dept.color || MATCHA_GREEN} />
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card className="dashboard-card" bordered={false}>
                <div className="card-header"><Title level={5}>Hoạt Động Gần Đây</Title></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(dashboardData?.activities || []).map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <Avatar size={32} style={{ backgroundColor: `${MATCHA_GREEN}15`, color: MATCHA_GREEN, flexShrink: 0, marginTop: 2 }} icon={item.icon || <FileTextOutlined />} />
                      <div><Text style={{ display: 'block' }}>{item.text}</Text><Text type="secondary" style={{ fontSize: 12 }}>{item.time}</Text></div>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {isInterviewer && (
        <>
          <Row gutter={[20, 20]}>
            <Col xs={24} lg={12}>
              <Card className="dashboard-card" bordered={false}>
                <div className="card-header">
                  <Title level={5}>Incoming Interviews</Title>
                  <Button type="link" onClick={() => navigate('/interviewer/incoming')}>View All</Button>
                </div>
                <List
                  itemLayout="horizontal"
                  dataSource={upcomingInterviews}
                  loading={loading}
                  locale={{ emptyText: 'Không có lịch phỏng vấn sắp tới' }}
                  renderItem={(item) => (
                    <List.Item className="interview-item" actions={[
                      <Button key="candidates" type="primary" size="small" icon={<TeamOutlined />} onClick={() => handleShowCandidates(item)} style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}>DS Ứng viên</Button>,
                      <Button key="join" type="default" size="small" icon={<VideoCameraOutlined />} onClick={() => window.open(item.meetingLink, '_blank')}>Join</Button>,
                    ]}>
                      <List.Item.Meta avatar={<Avatar size={44} style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />} title={<span className="candidate-name">{item.candidate}</span>} description={
                        <div className="interview-meta"><span>{item.position}</span><span>•</span><span><ClockCircleOutlined /> {item.date ? dayjs(item.date).format('DD/MM/YYYY') : '-'} {item.time || ''}</span></div>
                      } />
                      <Tag color={getTypeColor(item.type)}>{item.type}</Tag>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card className="dashboard-card" bordered={false}>
                <div className="card-header">
                  <Title level={5}>Pending Grading</Title>
                  <Button type="link" onClick={() => navigate('/interviewer/grading')}>View All</Button>
                </div>
                <List
                  itemLayout="horizontal"
                  dataSource={pendingGrading.slice(0, 5)}
                  loading={loading}
                  locale={{ emptyText: 'Không có bài chấm điểm nào chờ' }}
                  renderItem={(item) => (
                    <List.Item className="interview-item" actions={[
                      <Button key="grade" type="primary" size="small" onClick={() => navigate(`/interviewer/grading/${item.id}`)}>Grade Now</Button>,
                    ]}>
                      <List.Item.Meta avatar={<Avatar size={44} style={{ backgroundColor: '#faad14' }} icon={<UserOutlined />} />} title={<span className="candidate-name">{item.candidate}</span>} description={
                        <div className="interview-meta"><span>{item.position}</span><span>•</span><span>{item.interviewDate || '-'}</span></div>
                      } />
                      <Tag color="warning">Pending</Tag>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}

      <Modal
        title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TeamOutlined style={{ color: MATCHA_GREEN }} />Danh sách ứng viên phỏng vấn</div>}
        open={candidateModalOpen}
        onCancel={() => { setCandidateModalOpen(false); setSelectedSchedule(null); setCandidates([]); }}
        footer={null}
        width={800}
      >
        {selectedSchedule && (
          <div style={{ marginTop: 16 }}>
            <Descriptions column={3} size="small" style={{ marginBottom: 16, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
              <Descriptions.Item label="Buổi PV"><Text strong>{selectedSchedule.candidate}</Text></Descriptions.Item>
              <Descriptions.Item label="Vị trí">{selectedSchedule.position}</Descriptions.Item>
              <Descriptions.Item label="Ngày">{selectedSchedule.date ? dayjs(selectedSchedule.date).format('DD/MM/YYYY') : '-'}</Descriptions.Item>
              <Descriptions.Item label="Giờ">{selectedSchedule.time || '-'} - {selectedSchedule.endTime || '-'}</Descriptions.Item>
              <Descriptions.Item label="Loại"><Tag color={getTypeColor(selectedSchedule.type)}>{selectedSchedule.type}</Tag></Descriptions.Item>
              <Descriptions.Item label="Vòng"><Tag color="cyan">Vòng {selectedSchedule.level}</Tag></Descriptions.Item>
            </Descriptions>
            <Divider orientation="left">Danh sách cần chấm điểm</Divider>
            {loadingCandidates ? <div style={{ textAlign: 'center', padding: 40 }}>Đang tải...</div> : candidates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}><UserOutlined style={{ fontSize: 48, marginBottom: 16 }} /><p>Chưa có ứng viên nào trong buổi phỏng vấn này</p></div>
            ) : (
              <Table columns={gradingColumns} dataSource={candidates} rowKey="id" pagination={false} loading={loadingCandidates} />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Dashboard;
