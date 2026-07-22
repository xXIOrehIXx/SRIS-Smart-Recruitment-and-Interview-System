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
import { dashboardAPI, interviewAPI, jobsAPI, applicationAPI, recruitmentRequestAPI } from '../services/api';
import dayjs from 'dayjs';
import './Dashboard.css';

const { Title, Text } = Typography;
const { Option } = Select;
const MATCHA_GREEN = '#5D8C3E';

const FUNNEL_LABELS = {
  NEW: "Hồ sơ mới", SCREENING: "Sàng lọc", INTERVIEW: "Phỏng vấn",
  OFFER: "Offer", HIRED: "Đã tuyển", REJECTED: "Từ chối",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const role = user?.role;
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);

  // DM: yêu cầu tuyển dụng thật (đếm KPI + bảng chờ duyệt)
  const [requests, setRequests] = useState([]);

  // Interviewer states
  const [upcomingInterviews, setUpcomingInterviews] = useState([]);
  const [pendingGrading, setPendingGrading] = useState([]);
  const [interviewerStats, setInterviewerStats] = useState({ total: 0, upcoming: 0, submitted: 0 });
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
      if (isDeptManager) fetchRequests();
    }
  }, [selectedJob, isInterviewer]);

  const fetchRequests = async () => {
    try {
      const response = await recruitmentRequestAPI.getAll();
      setRequests(response.data || []);
    } catch (error) {
      console.error('Error fetching recruitment requests:', error);
    }
  };

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
    // MyScheduleDto: { scheduleId, applicationId, roundNumber, status, startTime, candidateName, candidateEmail, jobTitle }
    // status lịch: PENDING (chờ ứng viên chốt slot) | CONFIRMED | NO_SLOT_FITS | CANCELLED
    try {
      setLoading(true);
      const res = await interviewAPI.getMySchedules().catch(() => ({ data: [] }));
      const data = Array.isArray(res?.data) ? res.data : [];
      const normalized = data.map((item) => ({
        id: item.scheduleId,
        applicationId: item.applicationId,
        candidate: item.candidateName || 'N/A',
        position: item.jobTitle || 'N/A',
        round: item.roundNumber || 1,
        startTime: item.startTime,
        status: item.status,
      }));
      const active = normalized.filter((i) => i.status !== 'CANCELLED');
      const now = dayjs();
      const upcoming = active
        .filter((i) => i.startTime && dayjs(i.startTime).isAfter(now))
        .sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf());
      setUpcomingInterviews(upcoming.slice(0, 5));

      // Buổi CONFIRMED đã diễn ra -> hỏi phiếu chấm của mình (my-sheet) xem đã SUBMITTED chưa
      const past = active
        .filter((i) => i.status === 'CONFIRMED' && i.startTime && !dayjs(i.startTime).isAfter(now))
        .sort((a, b) => dayjs(b.startTime).valueOf() - dayjs(a.startTime).valueOf())
        .slice(0, 8);
      const sheets = await Promise.all(
        past.map((s) =>
          interviewAPI.getMySheet(s.id)
            .then((r) => ({ schedule: s, myStatus: r.data?.myStatus }))
            .catch(() => ({ schedule: s, myStatus: null }))
        )
      );
      const pending = sheets.filter((x) => x.myStatus && x.myStatus !== 'SUBMITTED').map((x) => x.schedule);
      setPendingGrading(pending.slice(0, 5));
      setInterviewerStats({
        total: active.length,
        upcoming: upcoming.length,
        submitted: sheets.filter((x) => x.myStatus === 'SUBMITTED').length,
      });
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
        { title: 'Tổng Hồ Sơ Ứng Tuyển', value: summary.totalApplications || 0, icon: <FileTextOutlined />, color: MATCHA_GREEN },
        { title: 'Đang Trong Pipeline', value: summary.inPipeline || 0, icon: <TeamOutlined />, color: '#1890ff' },
        { title: 'Ứng Viên Đã Tuyển', value: summary.hired || 0, icon: <UserOutlined />, color: '#52c41a' },
        { title: 'Tỷ Lệ Chấp Nhận Offer', value: summary.offerAcceptanceRatePct ?? 0, suffix: '%', icon: <TrophyOutlined />, color: '#faad14' },
      ];
    }
    if (isDeptManager) {
      // Đếm từ danh sách yêu cầu tuyển dụng thật (recruitmentRequestAPI)
      const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
      const approvedCount = requests.filter((r) => r.status === 'APPROVED' || r.status === 'CONVERTED').length;
      return [
        { title: 'Yêu Cầu Tuyển Dụng', value: requests.length, icon: <FileTextOutlined />, color: MATCHA_GREEN },
        { title: 'Chờ Phê Duyệt', value: pendingCount, icon: <ClockCircleOutlined />, color: '#faad14' },
        { title: 'Đã Duyệt / Đã Tạo Job', value: approvedCount, icon: <CheckCircleOutlined />, color: '#52c41a' },
        { title: 'Hồ Sơ Trong Pipeline', value: summary.inPipeline || 0, icon: <TeamOutlined />, color: '#1890ff' },
      ];
    }
    if (isInterviewer) {
      return [
        { title: 'Buổi Phỏng Vấn', value: interviewerStats.total, icon: <CalendarOutlined />, color: MATCHA_GREEN },
        { title: 'Sắp Diễn Ra', value: interviewerStats.upcoming, icon: <ClockCircleOutlined />, color: '#1890ff' },
        { title: 'Chờ Chấm Điểm', value: pendingGrading.length, icon: <ClockCircleOutlined />, color: '#faad14' },
        { title: 'Đã Nộp Phiếu', value: interviewerStats.submitted, icon: <CheckCircleOutlined />, color: '#52c41a' },
      ];
    }
    return [];
  }, [dashboardData, requests, isAdmin, isDeptManager, isInterviewer, interviewerStats, pendingGrading.length]);

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
          <Button type="primary" onClick={fetchInterviewerData}>
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
                      <div className="pipeline-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="pipeline-dot" style={{ backgroundColor: MATCHA_GREEN, width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }}></span>
                        <span>{FUNNEL_LABELS[item.state] || item.state}</span>
                        <span className="pipeline-count" style={{ marginLeft: 'auto', fontWeight: 600, color: MATCHA_GREEN }}>{item.count}</span>
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
                    { title: 'Ứng Viên', dataIndex: 'candidateName', key: 'candidateName', render: (text, record) => (
                      <div className="candidate-cell"><Avatar size={36} style={{ backgroundColor: MATCHA_GREEN }} icon={<TeamOutlined />} /><div><div className="candidate-name">{text}</div><Text type="secondary" style={{ fontSize: 12 }}>{record.candidateEmail}</Text></div></div>
                    )},
                    { title: 'Vị Trí', dataIndex: 'jobTitle', key: 'jobTitle', render: (text) => <span style={{ fontWeight: 500 }}>{text}</span> },
                    { title: 'Trạng Thái', dataIndex: 'currentState', key: 'currentState', render: (state) => <Tag color={state === 'NEW' ? 'blue' : state === 'HIRED' ? 'green' : state === 'REJECTED' ? 'red' : state === 'OFFER' ? 'gold' : 'default'}>{FUNNEL_LABELS[state] || state}</Tag> },
                    { title: 'Ngày Nộp', dataIndex: 'appliedAt', key: 'appliedAt', render: (v) => <span style={{ color: '#8c8c8b', fontSize: 13 }}><ClockCircleOutlined style={{ marginRight: 4 }} />{v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '-'}</span> },
                  ]}
                  dataSource={dashboardData?.recentApplications || []}
                  rowKey="applicationId"
                  pagination={false}
                  className="applications-table"
                  onRow={(record) => ({ onClick: () => navigate(`/recruiter/candidates/${record.applicationId}`), style: { cursor: 'pointer' } })}
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
                  <Title level={5}>Yêu Cầu Đang Chờ Duyệt</Title>
                  <Button type="link" onClick={() => navigate('/dept/requests')}>Xem tất cả <RightOutlined /></Button>
                </div>
                <Table
                  columns={[
                    { title: 'Vị trí', dataIndex: 'title', key: 'title', render: (text, record) => (
                      <div><Text strong>{text}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{record.department || '-'}</Text></div>
                    )},
                    { title: 'Số lượng', dataIndex: 'quantity', width: 100, render: (val) => <Tag color="blue">{val} vị trí</Tag> },
                    { title: 'Mức ưu tiên', dataIndex: 'priority', width: 110, render: (val) => <Tag color={val === 'HIGH' ? 'error' : val === 'MEDIUM' ? 'warning' : 'success'}>{val === 'HIGH' ? 'Cao' : val === 'MEDIUM' ? 'Trung bình' : 'Thấp'}</Tag> },
                    { title: 'Ngày gửi', dataIndex: 'createdAt', width: 110, render: (v) => v ? dayjs(v).format('DD/MM/YYYY') : '-' },
                    { title: 'Thao tác', key: 'actions', width: 90, render: () => (
                      <Button type="link" size="small" onClick={() => navigate('/dept/requests')}>Xem</Button>
                    )},
                  ]}
                  dataSource={requests.filter((r) => r.status === 'PENDING')}
                  rowKey="requestId"
                  pagination={false}
                  scroll={{ x: 650 }}
                  locale={{ emptyText: 'Không có yêu cầu nào chờ duyệt' }}
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
                    { title: 'Ứng viên', key: 'candidate', render: (_, record) => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} /><Text strong>{record.candidateName}</Text></div> },
                    { title: 'Vị trí', dataIndex: 'jobTitle', key: 'jobTitle' },
                    { title: 'Quyết định', dataIndex: 'currentState', key: 'currentState', render: (val) => <Tag color={val === 'HIRED' ? 'success' : 'error'}>{val === 'HIRED' ? 'Tuyển' : 'Loại'}</Tag> },
                    { title: 'Ngày', dataIndex: 'stageUpdatedAt', key: 'stageUpdatedAt', render: (v) => v ? dayjs(v).format('DD/MM/YYYY') : '-' },
                  ]}
                  dataSource={dashboardData?.recentDecisions || []}
                  rowKey="applicationId"
                  pagination={false}
                  locale={{ emptyText: 'Chưa có quyết định nào' }}
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><Text>{dept.department}</Text><Text type="secondary">{dept.hired || 0}/{dept.total || 0} hồ sơ đã tuyển</Text></div>
                      <Progress percent={dept.total > 0 ? Math.round((dept.hired / dept.total) * 100) : 0} strokeColor={MATCHA_GREEN} />
                    </div>
                  ))}
                  {(!dashboardData?.departmentProgress || dashboardData.departmentProgress.length === 0) && (
                    <Text type="secondary">Chưa có hồ sơ nào gắn với phòng ban</Text>
                  )}
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card className="dashboard-card" bordered={false}>
                <div className="card-header"><Title level={5}>Hoạt Động Gần Đây</Title></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(dashboardData?.recentActivities || []).map((item, idx) => {
                    const ACTION_LABELS = {
                      STATE_CHANGE: item.toState ? `chuyển sang ${FUNNEL_LABELS[item.toState] || item.toState}` : 'chuyển trạng thái',
                      INTERVIEW_INVITED: 'được mời phỏng vấn',
                      INTERVIEW_SCHEDULED: 'đã chốt lịch phỏng vấn',
                      INTERVIEW_CANCELLED: 'bị hủy lịch phỏng vấn',
                      INTERVIEW_NO_SLOT_FITS: 'không chọn được khung giờ phỏng vấn',
                      OFFER_MADE: 'được gửi offer',
                    };
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <Avatar size={32} style={{ backgroundColor: `${MATCHA_GREEN}15`, color: MATCHA_GREEN, flexShrink: 0, marginTop: 2 }} icon={<FileTextOutlined />} />
                        <div>
                          <Text style={{ display: 'block' }}><Text strong>{item.candidateName}</Text> {ACTION_LABELS[item.action] || item.action}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>{item.createdAt ? dayjs(item.createdAt).format('DD/MM/YYYY HH:mm') : ''}</Text>
                        </div>
                      </div>
                    );
                  })}
                  {(!dashboardData?.recentActivities || dashboardData.recentActivities.length === 0) && (
                    <Text type="secondary">Chưa có hoạt động nào</Text>
                  )}
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
                    ]}>
                      <List.Item.Meta avatar={<Avatar size={44} style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />} title={<span className="candidate-name">{item.candidate}</span>} description={
                        <div className="interview-meta"><span>{item.position}</span><span>•</span><span><ClockCircleOutlined /> {item.startTime ? dayjs(item.startTime).format('DD/MM/YYYY HH:mm') : '-'}</span></div>
                      } />
                      <Tag color="cyan">Vòng {item.round}</Tag>
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
                  dataSource={pendingGrading}
                  loading={loading}
                  locale={{ emptyText: 'Không có phiếu chấm nào chờ' }}
                  renderItem={(item) => (
                    <List.Item className="interview-item" actions={[
                      <Button key="grade" type="primary" size="small" onClick={() => navigate(`/interviewer/grading/${item.id}`)}>Chấm điểm</Button>,
                    ]}>
                      <List.Item.Meta avatar={<Avatar size={44} style={{ backgroundColor: '#faad14' }} icon={<UserOutlined />} />} title={<span className="candidate-name">{item.candidate}</span>} description={
                        <div className="interview-meta"><span>{item.position}</span><span>•</span><span>{item.startTime ? dayjs(item.startTime).format('DD/MM/YYYY HH:mm') : '-'}</span></div>
                      } />
                      <Tag color="warning">Chờ chấm</Tag>
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
              <Descriptions.Item label="Thời gian">{selectedSchedule.startTime ? dayjs(selectedSchedule.startTime).format('DD/MM/YYYY HH:mm') : '-'}</Descriptions.Item>
              <Descriptions.Item label="Vòng"><Tag color="cyan">Vòng {selectedSchedule.round}</Tag></Descriptions.Item>
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
