import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Table,
  Tag,
  Avatar,
  Button,
  Typography,
  List,
  Space,
  Modal,
  Descriptions,
  Divider,
  message,
} from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  UserOutlined,
  VideoCameraOutlined,
  TeamOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { interviewAPI } from '../../services/api';
import '../Dashboard.css';

const { Title, Text } = Typography;

const MATCHA_GREEN = '#5D8C3E';

const InterviewerDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [upcomingInterviews, setUpcomingInterviews] = useState([]);
  const [pendingGrading, setPendingGrading] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    avgScore: 0,
  });

  // Modal states
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await interviewAPI.getMySchedules();
      let data = response.data || [];

      if (!Array.isArray(data)) {
        data = data.interviews || data.schedules || data.items || [];
      }

      // Normalize data
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

      // Upcoming interviews (UPCOMING, CONFIRMED)
      const upcoming = normalized.filter(i =>
        i.status === 'UPCOMING' || i.status === 'CONFIRMED' || i.status === 'PENDING'
      );
      setUpcomingInterviews(upcoming.slice(0, 5));

      // Update stats
      const completed = normalized.filter(i => i.status === 'COMPLETED').length;
      setStats({
        total: normalized.length,
        pending: upcoming.length,
        completed,
        avgScore: 82, // Will be calculated from actual data if available
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      message.error('Không thể tải dữ liệu dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidatesBySchedule = async (scheduleId) => {
    try {
      setLoadingCandidates(true);
      const response = await interviewAPI.getAggregate(scheduleId);
      let data = response.data;
      if (!Array.isArray(data)) {
        data = data?.candidates || data?.items || data?.applications || [];
      }
      setCandidates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleShowCandidates = (schedule) => {
    setSelectedSchedule(schedule);
    fetchCandidatesBySchedule(schedule.id);
    setCandidateModalOpen(true);
  };

  const handleGradeCandidate = (scheduleId, candidate) => {
    setCandidateModalOpen(false);
    navigate(`/interviewer/interview/${scheduleId}`, {
      state: { scheduleId, candidate }
    });
  };

  const getTypeColor = (type) => {
    const colors = {
      Technical: 'blue',
      HR: 'green',
      Culture: 'purple',
    };
    return colors[type] || 'default';
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
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.position || record.jobTitle || 'N/A'}
            </Text>
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
        return isGraded
          ? <Tag color="success">Đã chấm</Tag>
          : <Tag color="warning">Chưa chấm</Tag>;
      },
    },
    {
      title: 'Điểm',
      key: 'score',
      width: 100,
      render: (_, record) => (
        record.score !== undefined && record.score !== null
          ? <Text strong style={{ color: MATCHA_GREEN }}>{record.score}/{record.maxScore || 100}</Text>
          : <Text type="secondary">-</Text>
      ),
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
            icon={isGraded ? <EditOutlined /> : <PlusOutlined />}
            onClick={() => handleGradeCandidate(selectedSchedule?.id, record)}
            style={{
              background: isGraded ? undefined : MATCHA_GREEN,
              borderColor: isGraded ? MATCHA_GREEN : undefined,
              color: isGraded ? MATCHA_GREEN : '#fff',
            }}
          >
            {isGraded ? 'Sửa' : 'Chấm điểm'}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="dashboard-page interviewer-dashboard">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Interviewer Dashboard</Title>
          <Text type="secondary">Welcome back! Here's your interview schedule.</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchDashboardData} loading={loading}>
          Làm mới
        </Button>
      </div>

      <Row gutter={[20, 20]} className="stats-row">
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" bordered={false}>
            <div className="stat-card-content">
              <div className="stat-info">
                <Text type="secondary" className="stat-title">Total Interviews</Text>
                <span className="stat-value">{stats.total}</span>
              </div>
              <div className="stat-icon" style={{ backgroundColor: '#5D8C3E15' }}>
                <CalendarOutlined style={{ color: '#5D8C3E' }} />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" bordered={false}>
            <div className="stat-card-content">
              <div className="stat-info">
                <Text type="secondary" className="stat-title">Pending Grading</Text>
                <span className="stat-value">{stats.pending}</span>
              </div>
              <div className="stat-icon" style={{ backgroundColor: '#faad1415' }}>
                <ClockCircleOutlined style={{ color: '#faad14' }} />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" bordered={false}>
            <div className="stat-card-content">
              <div className="stat-info">
                <Text type="secondary" className="stat-title">Completed</Text>
                <span className="stat-value">{stats.completed}</span>
              </div>
              <div className="stat-icon" style={{ backgroundColor: '#52c41a15' }}>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" bordered={false}>
            <div className="stat-card-content">
              <div className="stat-info">
                <Text type="secondary" className="stat-title">Avg Score</Text>
                <span className="stat-value">{stats.avgScore}<span style={{ fontSize: 14 }}>%</span></span>
              </div>
              <div className="stat-icon" style={{ backgroundColor: '#1890ff15' }}>
                <TeamOutlined style={{ color: '#1890ff' }} />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={12}>
          <Card className="dashboard-card" bordered={false}>
            <div className="card-header">
              <Title level={5}>Incoming Interviews</Title>
              <Button type="link" onClick={() => navigate('/interviewer/incoming')}>
                View All
              </Button>
            </div>
            <List
              itemLayout="horizontal"
              dataSource={upcomingInterviews}
              loading={loading}
              locale={{ emptyText: 'Không có lịch phỏng vấn sắp tới' }}
              renderItem={(item) => (
                <List.Item
                  className="interview-item"
                  actions={[
                    <Button
                      key="candidates"
                      type="primary"
                      size="small"
                      icon={<TeamOutlined />}
                      onClick={() => handleShowCandidates(item)}
                      style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
                    >
                      DS Ứng viên
                    </Button>,
                    <Button
                      key="join"
                      type="default"
                      size="small"
                      icon={<VideoCameraOutlined />}
                      onClick={() => window.open(item.meetingLink, '_blank')}
                    >
                      Join
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar size={44} style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />}
                    title={<span className="candidate-name">{item.candidate}</span>}
                    description={
                      <div className="interview-meta">
                        <span>{item.position}</span>
                        <span>•</span>
                        <span><ClockCircleOutlined /> {item.date ? dayjs(item.date).format('DD/MM/YYYY') : '-'} {item.time || ''}</span>
                      </div>
                    }
                  />
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
              <Button type="link" onClick={() => navigate('/interviewer/schedule')}>
                View All
              </Button>
            </div>
            <List
              itemLayout="horizontal"
              dataSource={pendingGrading.slice(0, 5)}
              loading={loading}
              locale={{ emptyText: 'Không có bài chấm điểm nào chờ' }}
              renderItem={(item) => (
                <List.Item
                  className="interview-item"
                  actions={[
                    <Button
                      key="grade"
                      type="primary"
                      size="small"
                      onClick={() => navigate(`/interviewer/interview/${item.id}`, { state: { candidate: item } })}
                    >
                      Grade Now
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar size={44} style={{ backgroundColor: '#faad14' }} icon={<UserOutlined />} />}
                    title={<span className="candidate-name">{item.candidate}</span>}
                    description={
                      <div className="interview-meta">
                        <span>{item.position}</span>
                        <span>•</span>
                        <span>{item.interviewDate || '-'}</span>
                      </div>
                    }
                  />
                  <Tag color="warning">Pending</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* Modal Danh Sách Ứng Viên */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TeamOutlined style={{ color: MATCHA_GREEN }} />
            Danh sách ứng viên phỏng vấn
          </div>
        }
        open={candidateModalOpen}
        onCancel={() => {
          setCandidateModalOpen(false);
          setSelectedSchedule(null);
          setCandidates([]);
        }}
        footer={null}
        width={800}
      >
        {selectedSchedule && (
          <div style={{ marginTop: 16 }}>
            <Descriptions column={3} size="small" style={{ marginBottom: 16, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
              <Descriptions.Item label="Buổi PV">
                <Text strong>{selectedSchedule.candidate}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Vị trí">
                {selectedSchedule.position}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày">
                {selectedSchedule.date ? dayjs(selectedSchedule.date).format('DD/MM/YYYY') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Giờ">
                {selectedSchedule.time || '-'} - {selectedSchedule.endTime || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Loại">
                <Tag color={getTypeColor(selectedSchedule.type)}>{selectedSchedule.type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Vòng">
                <Tag color="cyan">Vòng {selectedSchedule.level}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Danh sách cần chấm điểm</Divider>

            {loadingCandidates ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                Đang tải...
              </div>
            ) : candidates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                <UserOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <p>Chưa có ứng viên nào trong buổi phỏng vấn này</p>
              </div>
            ) : (
              <Table
                columns={gradingColumns}
                dataSource={candidates}
                rowKey="id"
                pagination={false}
                loading={loadingCandidates}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InterviewerDashboard;
