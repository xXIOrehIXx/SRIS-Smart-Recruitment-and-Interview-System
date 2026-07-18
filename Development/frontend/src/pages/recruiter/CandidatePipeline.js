import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Typography, Avatar, Tag, Button, Badge, Dropdown, Input, Space, Modal, message, Spin, Progress } from 'antd';
import { 
  SearchOutlined, 
  MoreOutlined,
  UserOutlined,
  MailOutlined,
  CalendarOutlined,
  EyeOutlined,
  FileTextOutlined,
  ArrowRightOutlined,
  TeamOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { jobsAPI, applicationAPI } from '../../services/api';
import './css/CandidatePipeline.css';

const { Title, Text } = Typography;

const MATCHA_GREEN = '#5D8C3E';

const CandidatePipeline = () => {
  const { id: jobId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
      fetchApplications();
    }
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      const response = await jobsAPI.getById(jobId);
      setJob(response.data);
    } catch (error) {
      console.error('Error fetching job details:', error);
      message.error('Không thể tải thông tin tin tuyển dụng');
    }
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await applicationAPI.getAll(jobId);
      // Backend trả ApplicationBoardDto: { jobId, applications: [ApplicationCardDto] }
      const appList = response.data?.applications || [];

      // Transform API data to pipeline format
      const transformedApps = appList.map(app => ({
        ...app,
        id: app.applicationId,
        stage: app.currentState || 'NEW',
        candidate: {
          id: app.applicationId,
          name: app.candidateName || 'N/A',
          email: app.candidateEmail || 'N/A',
          phone: '',
          applied: app.appliedAt,
          score: app.aiMatchScore != null ? Math.round(app.aiMatchScore) : null,
          avatar: null,
        }
      }));
      
      setApplications(transformedApps);
    } catch (error) {
      console.error('Error fetching applications:', error);
      message.error('Không thể tải danh sách ứng viên');
    } finally {
      setLoading(false);
    }
  };

  // Group applications by stage: 6 state nội bộ → 4 pha hiển thị
  // (OFFER/HIRED gộp vào cột Quyết định; REJECTED ẩn khỏi board)
  const getStageGroups = () => {
    const stages = {
      NEW: { id: 'NEW', title: 'Hồ Sơ Mới', color: '#1890ff', candidates: [] },
      SCREENING: { id: 'SCREENING', title: 'Sàng Lọc', color: '#722ed1', candidates: [] },
      INTERVIEW: { id: 'INTERVIEW', title: 'Phỏng Vấn', color: '#faad14', candidates: [] },
      OFFER: { id: 'OFFER', title: 'Quyết Định', color: '#52c41a', candidates: [] },
    };
    const STATE_TO_COLUMN = {
      NEW: 'NEW', SCREENING: 'SCREENING', INTERVIEW: 'INTERVIEW',
      OFFER: 'OFFER', HIRED: 'OFFER',
    };

    applications.forEach(app => {
      const stageKey = STATE_TO_COLUMN[app.stage];

      if (stageKey && stages[stageKey]) {
        stages[stageKey].candidates.push({
          id: app.id,
          name: app.candidate?.name || app.fullName || 'N/A',
          email: app.candidate?.email || app.email || 'N/A',
          applied: app.candidate?.applied || app.appliedAt || 'N/A',
          score: app.cvScore || app.score || null,
          interview: app.nextInterview ? formatDateTime(app.nextInterview) : null,
          phone: app.candidate?.phone || app.phone || '',
          cvUrl: app.cvUrl,
        });
      }
    });

    return Object.values(stages);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { 
      day: '2-digit', 
      month: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatAppliedDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) return `${diffDays} ngày trước`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
    return date.toLocaleDateString('vi-VN');
  };

  const handleCandidateClick = (candidate) => {
    setSelectedCandidate(candidate);
    setIsDetailModalOpen(true);
  };

  const handleTransition = async (applicationId, newState) => {
    try {
      await applicationAPI.transition(applicationId, newState);
      message.success('Đã cập nhật trạng thái ứng viên');
      fetchApplications();
    } catch (error) {
      console.error('Error transitioning application:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể cập nhật trạng thái');
    }
  };

  // Reject bắt buộc có lý do (docs 5.7 — reject_reason phục vụ dashboard)
  const openRejectModal = (candidate) => {
    let reason = '';
    Modal.confirm({
      title: `Từ chối ứng viên ${candidate.name}?`,
      content: (
        <Input.TextArea
          rows={3}
          placeholder="Lý do từ chối (bắt buộc)..."
          onChange={(e) => { reason = e.target.value; }}
        />
      ),
      okText: 'Từ chối',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      onOk: async () => {
        if (!reason.trim()) {
          message.error('Vui lòng nhập lý do từ chối');
          return Promise.reject();
        }
        try {
          await applicationAPI.reject(candidate.id, reason.trim());
          message.success('Đã từ chối ứng viên');
          fetchApplications();
        } catch (error) {
          console.error('Error rejecting application:', error);
          message.error(error?.response?.data?.userMsg || 'Không thể từ chối ứng viên');
          return Promise.reject();
        }
      },
    });
  };

  const getMenuItems = (candidate) => [
    {
      key: 'view',
      icon: <EyeOutlined />,
      label: 'Xem Hồ Sơ',
      onClick: () => handleCandidateClick(candidate),
    },
    {
      key: 'email',
      icon: <MailOutlined />,
      label: 'Gửi Email',
    },
    {
      key: 'schedule',
      icon: <CalendarOutlined />,
      label: 'Lên Lịch Phỏng Vấn',
    },
    {
      type: 'divider',
    },
    {
      key: 'move',
      icon: <ArrowRightOutlined />,
      label: 'Chuyển sang...',
      // Pipeline forward-only: NEW → SCREENING → INTERVIEW → OFFER
      children: [
        { key: 'SCREENING', label: 'Sàng Lọc', onClick: () => handleTransition(candidate.id, 'SCREENING') },
        { key: 'INTERVIEW', label: 'Phỏng Vấn', onClick: () => handleTransition(candidate.id, 'INTERVIEW') },
        { key: 'OFFER', label: 'Offer', onClick: () => handleTransition(candidate.id, 'OFFER') },
      ],
    },
    {
      key: 'reject',
      label: 'Từ Chối',
      danger: true,
      onClick: () => openRejectModal(candidate),
    },
  ];

  const stageGroups = getStageGroups();

  if (loading && !applications.length) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="candidate-pipeline-page">
      <div className="page-header">
        <div>
          <Button onClick={() => navigate('/recruiter/jobs')} className="back-btn">
            ← Quay lại Tin Tuyển Dụng
          </Button>
          <Title level={3} className="page-title">{job?.title || 'Ứng Viên'}</Title>
          <Text type="secondary">Quản lý ứng viên cho vị trí này</Text>
        </div>
        <div className="header-actions">
          <Input
            placeholder="Tìm kiếm ứng viên..."
            prefix={<SearchOutlined style={{ color: '#8c8c8b' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="search-input"
            allowClear
          />
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchApplications}
            loading={loading}
          >
            Làm Mới
          </Button>
        </div>
      </div>

      {/* Pipeline Stats */}
      <div className="pipeline-stats-bar">
        {stageGroups.map((stage) => (
          <div key={stage.id} className="pipeline-stat-item" style={{ borderLeftColor: stage.color }}>
            <span className="stat-label">{stage.title}</span>
            <span className="stat-count">{stage.candidates.length}</span>
          </div>
        ))}
      </div>

      <div className="kanban-board">
        {stageGroups.map((col) => (
          <div key={col.id} className="kanban-column">
            <div className="column-header">
              <div className="column-title">
                <span className="column-dot" style={{ backgroundColor: col.color }}></span>
                <span>{col.title}</span>
                <span className="column-count">({col.candidates.length})</span>
              </div>
            </div>
            
            <div className="column-content">
              {col.candidates.map((candidate) => (
                <Card 
                  key={candidate.id} 
                  className="candidate-card"
                  bordered={false}
                  onClick={() => handleCandidateClick(candidate)}
                  hoverable
                >
                  <div className="card-header">
                    <Avatar 
                      size={40} 
                      style={{ backgroundColor: MATCHA_GREEN }}
                      icon={<UserOutlined />}
                    />
                    <Dropdown 
                      menu={{ items: getMenuItems(candidate) }} 
                      trigger={['click']}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button 
                        type="text" 
                        size="small" 
                        icon={<MoreOutlined />} 
                        className="card-menu-btn"
                      />
                    </Dropdown>
                  </div>
                  
                  <div className="card-body">
                    <h4 className="candidate-name">{candidate.name}</h4>
                    <p className="candidate-email">{candidate.email}</p>
                    
                    <div className="card-meta">
                      <span className="meta-item">
                        <FileTextOutlined /> {formatAppliedDate(candidate.applied)}
                      </span>
                      {candidate.score && (
                        <span className="meta-item score">
                          <TeamOutlined /> Điểm: {candidate.score}%
                        </span>
                      )}
                      {candidate.interview && (
                        <span className="meta-item interview">
                          <CalendarOutlined /> {candidate.interview}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="card-footer">
                    <Button type="text" size="small" icon={<EyeOutlined />}>
                      Xem
                    </Button>
                    <Button type="text" size="small" icon={<CalendarOutlined />}>
                      Lịch
                    </Button>
                  </div>
                </Card>
              ))}
              
              {col.candidates.length === 0 && (
                <div className="empty-column">
                  <Text type="secondary">Chưa có ứng viên</Text>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        title={null}
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={null}
        width={700}
        className="candidate-modal"
      >
        {selectedCandidate && (
          <div className="candidate-detail">
            <div className="detail-header">
              <Avatar size={72} style={{ backgroundColor: MATCHA_GREEN }}>
                {(selectedCandidate.name || 'N')[0]}
              </Avatar>
              <div className="detail-info">
                <h2>{selectedCandidate.name}</h2>
                <p>{selectedCandidate.email}</p>
                <div className="detail-tags">
                  <Tag color="blue">Ứng Viên</Tag>
                  {selectedCandidate.score && (
                    <Tag color="green">Điểm: {selectedCandidate.score}%</Tag>
                  )}
                </div>
              </div>
            </div>
            
            <div className="detail-content">
              <div className="info-section">
                <h4>Thông Tin Liên Hệ</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <MailOutlined />
                    <span>{selectedCandidate.email}</span>
                  </div>
                  {selectedCandidate.phone && (
                    <div className="info-item">
                      <span>📱</span>
                      <span>{selectedCandidate.phone}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="info-section">
                <h4>Chi Tiết Đơn Ứng Tuyển</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <FileTextOutlined />
                    <span>Ứng tuyển: {formatAppliedDate(selectedCandidate.applied)}</span>
                  </div>
                  <div className="info-item">
                    <CalendarOutlined />
                    <span>Vị trí: {job?.title || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {selectedCandidate.score && (
                <div className="info-section">
                  <h4>Điểm CV</h4>
                  <Progress 
                    percent={selectedCandidate.score} 
                    strokeColor={MATCHA_GREEN}
                    format={(percent) => `${percent}%`}
                  />
                </div>
              )}
            </div>
            
            <div className="detail-actions">
              <Space>
                <Button icon={<MailOutlined />}>Gửi Email</Button>
                <Button icon={<CalendarOutlined />}>Lên Lịch Phỏng Vấn</Button>
              </Space>
              <Button type="primary" className="move-btn">
                Chuyển Sang Bước Tiếp Theo
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CandidatePipeline;
