import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Tag, Avatar, Button, Typography, Spin, message, Select, Tooltip, Progress } from 'antd';
import { 
  FileTextOutlined, 
  TeamOutlined, 
  CalendarOutlined, 
  CheckCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  PlusOutlined,
  ClockCircleOutlined,
  UserOutlined,
  MailOutlined,
  TrophyOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI } from '../../services/api';
import './css/Dashboard.css';

const { Title, Text } = Typography;
const { Option } = Select;

const MATCHA_GREEN = '#5D8C3E';
const MATCHA_LIGHT = 'rgba(93, 140, 62, 0.1)';

const STATE_COLORS = {
  'NEW': '#1890ff',
  'INTERVIEW': '#faad14',
  'OFFER': '#52c41a'
};

const STATE_LABELS = {
  'NEW': 'Applied',
  'INTERVIEW': 'Interview',
  'OFFER': 'Offer'
};

const KANBAN_STATES = ['NEW', 'INTERVIEW', 'OFFER'];

const RecruiterDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kanbanLoading, setKanbanLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [kanbanData, setKanbanData] = useState({ columns: [] });
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    fetchDashboardOverview();
    fetchJobs();
    fetchKanbanData();
  }, []);

  const fetchDashboardOverview = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getOverview();
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard overview:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await dashboardAPI.getOverview();
      if (response.data?.summary?.totalApplications > 0) {
        setJobs([]);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const fetchKanbanData = async () => {
    try {
      setKanbanLoading(true);
      const response = await dashboardAPI.getKanban(selectedJob);
      setKanbanData(response.data || { columns: [] });
    } catch (error) {
      console.error('Error fetching kanban data:', error);
      message.error('Không thể tải dữ liệu Kanban');
    } finally {
      setKanbanLoading(false);
    }
  };

  const handleJobFilter = (jobId) => {
    setSelectedJob(jobId || null);
    fetchKanbanData();
  };

  const handleDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    message.info('Kéo thả chỉ để hiển thị. Để chuyển trạng thái, hãy sử dụng nút hành động trên card.');
  };

  // Stats cards data
  const stats = [
    { 
      title: 'Tổng Hồ Sơ', 
      value: dashboardData?.summary?.totalApplications || 0, 
      trend: '+12%',
      trendUp: true,
      icon: <FileTextOutlined />,
      color: MATCHA_GREEN
    },
    { 
      title: 'Đang Xử Lý', 
      value: dashboardData?.summary?.inPipeline || 0, 
      trend: '+8%',
      trendUp: true,
      icon: <TeamOutlined />,
      color: '#1890ff'
    },
    { 
      title: 'Đã Tuyển', 
      value: dashboardData?.summary?.hired || 0, 
      trend: '+3',
      trendUp: true,
      icon: <CheckCircleOutlined />,
      color: '#52c41a'
    },
    { 
      title: 'Bị Từ Chối', 
      value: dashboardData?.summary?.rejected || 0, 
      trend: '-5%',
      trendUp: false,
      icon: <CloseOutlined />,
      color: '#f5222d'
    },
  ];

  // Kanban columns (exclude REJECTED from main view)
  const kanbanColumns = kanbanData.columns?.filter(col => KANBAN_STATES.includes(col.state)) || [];

  const getScoreColor = (score) => {
    if (score === null || score === undefined) return '#d9d9d9';
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#faad14';
    return '#f5222d';
  };

  const renderCandidateCard = (card, index) => {
    const scoreColor = getScoreColor(card.aiMatchScore);
    
    return (
      <Draggable key={card.applicationId} draggableId={String(card.applicationId)} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`kanban-card ${snapshot.isDragging ? 'dragging' : ''}`}
            onClick={() => navigate(`/recruiter/candidates/${card.applicationId}`)}
          >
            <div className="card-header">
              <Avatar size={32} style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />
              <div className="card-info">
                <Text strong className="candidate-name">{card.candidateName}</Text>
                <Text type="secondary" className="candidate-email">
                  <MailOutlined /> {card.candidateEmail}
                </Text>
              </div>
            </div>
            
            <div className="card-job">
              <Tag color="blue" icon={<FileTextOutlined />}>{card.jobTitle}</Tag>
            </div>

            <div className="card-footer">
              <div className="card-meta">
                <Tooltip title="Điểm AI">
                  <div className="score-badge" style={{ backgroundColor: `${scoreColor}20`, color: scoreColor }}>
                    <TrophyOutlined /> {card.aiMatchScore ? `${card.aiMatchScore}%` : 'N/A'}
                  </div>
                </Tooltip>
                <Tooltip title="Ngày nộp">
                  <div className="date-badge">
                    <ClockCircleOutlined /> {new Date(card.appliedAt).toLocaleDateString('vi-VN')}
                  </div>
                </Tooltip>
              </div>
            </div>

            <div className="card-actions">
              <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); navigate(`/recruiter/candidates/${card.applicationId}`); }}>
                Chi tiết
              </Button>
              <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); message.info('Chuyển trạng thái'); }}>
                Chuyển
              </Button>
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  if (loading && !dashboardData) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="dashboard-page recruiter-dashboard">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Dashboard Tuyển Dụng</Title>
          <Text type="secondary">Quản lý pipeline ứng viên với giao diện Kanban</Text>
        </div>
        <div className="header-actions">
          <Select
            placeholder="Lọc theo vị trí"
            allowClear
            style={{ width: 200, marginRight: 12 }}
            onChange={handleJobFilter}
            value={selectedJob}
          >
            {jobs.map(job => (
              <Option key={job.jobId || job.id} value={job.jobId || job.id}>
                {job.title}
              </Option>
            ))}
          </Select>
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
                    <span className="stat-value">{stat.value}</span>
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

      {/* Pipeline Overview */}
      {dashboardData?.funnel && dashboardData.funnel.length > 0 && (
        <Card className="dashboard-card pipeline-card" bordered={false} style={{ marginBottom: 20 }}>
          <div className="card-header">
            <Title level={5}>Phễu Tuyển Dụng</Title>
          </div>
          <Row gutter={16}>
            {dashboardData.funnel
              .filter(item => KANBAN_STATES.includes(item.state))
              .map((item, index) => (
                <Col xs={24} sm={12} md={6} key={index}>
                  <div className="funnel-item">
                    <div className="funnel-value" style={{ color: STATE_COLORS[item.state] || MATCHA_GREEN }}>
                      {item.count}
                    </div>
                    <div className="funnel-label">{STATE_LABELS[item.state] || item.state}</div>
                    <Progress 
                      percent={dashboardData.summary.totalApplications > 0 
                        ? (item.count / dashboardData.summary.totalApplications) * 100 
                        : 0} 
                      showInfo={false}
                      strokeColor={STATE_COLORS[item.state] || MATCHA_GREEN}
                      trailColor="#f0f0f0"
                      size="small"
                    />
                  </div>
                </Col>
              ))}
          </Row>
        </Card>
      )}

      {/* Kanban Board */}
      <Card className="dashboard-card kanban-card" bordered={false}>
        <div className="card-header">
          <Title level={5}>Pipeline Ứng Viên</Title>
          <Button type="link" icon={<PlusOutlined />} onClick={() => fetchKanbanData()}>
            Làm mới
          </Button>
        </div>

        {kanbanLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="kanban-board">
              {kanbanColumns.map((column) => (
                <div key={column.state} className="kanban-column">
                  <div className="column-header" style={{ borderTopColor: STATE_COLORS[column.state] || MATCHA_GREEN }}>
                    <div className="column-title">
                      <span className="column-dot" style={{ backgroundColor: STATE_COLORS[column.state] || MATCHA_GREEN }}></span>
                      <Text strong>{column.stateLabel || STATE_LABELS[column.state] || column.state}</Text>
                      <Tag color={STATE_COLORS[column.state] || MATCHA_GREEN}>{column.count}</Tag>
                    </div>
                  </div>
                  
                  <Droppable droppableId={column.state}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`column-cards ${snapshot.isDraggingOver ? 'drag-over' : ''}`}
                      >
                        {column.cards && column.cards.length > 0 ? (
                          column.cards.map((card, index) => renderCandidateCard(card, index))
                        ) : (
                          <div className="empty-column">
                            <Text type="secondary">Chưa có ứng viên</Text>
                          </div>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        )}

        {(!kanbanData.columns || kanbanData.columns.length === 0) && !kanbanLoading && (
          <div className="empty-board">
            <FileTextOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
            <Title level={5} type="secondary">Chưa có dữ liệu ứng viên</Title>
            <Text type="secondary">Hãy thêm ứng viên hoặc chọn vị trí tuyển dụng để xem pipeline</Text>
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <Row gutter={[20, 20]} className="quick-actions-row">
        <Col xs={24}>
          <Card className="dashboard-card quick-actions-card" bordered={false}>
            <div className="card-header">
              <Title level={5}>Thao Tác Nhanh</Title>
            </div>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <div className="quick-action-item" onClick={() => navigate('/recruiter/jobs/create')}>
                  <div className="action-icon" style={{ backgroundColor: MATCHA_LIGHT }}>
                    <FileTextOutlined style={{ color: MATCHA_GREEN }} />
                  </div>
                  <span>Đăng Tin Mới</span>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div className="quick-action-item" onClick={() => navigate('/recruiter/jobs')}>
                  <div className="action-icon" style={{ backgroundColor: 'rgba(24, 144, 255, 0.1)' }}>
                    <TeamOutlined style={{ color: '#1890ff' }} />
                  </div>
                  <span>Xem Ứng Viên</span>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div className="quick-action-item" onClick={() => navigate('/interviews/schedule')}>
                  <div className="action-icon" style={{ backgroundColor: 'rgba(250, 173, 20, 0.1)' }}>
                    <CalendarOutlined style={{ color: '#faad14' }} />
                  </div>
                  <span>Lên Lịch Phỏng Vấn</span>
                </div>
              </Col>
<<<<<<< Updated upstream
              <Col xs={24} sm={12} md={6}>
                <div className="quick-action-item" onClick={() => navigate('/quiz/create')}>
                  <div className="action-icon" style={{ backgroundColor: 'rgba(82, 196, 26, 0.1)' }}>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  </div>
                  <span>Tạo Quiz</span>
                </div>
              </Col>
=======
>>>>>>> Stashed changes
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default RecruiterDashboard;
