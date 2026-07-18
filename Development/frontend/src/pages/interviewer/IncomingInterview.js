import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Avatar,
  Button,
  Typography,
  Space,
  Input,
  Select,
  Modal,
  Descriptions,
  Divider,
  message,
  Row,
  Badge,
} from 'antd';
import {
  VideoCameraOutlined,
  SearchOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  UserOutlined,
  TeamOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { interviewAPI, applicationAPI } from '../../services/api';
import '../Dashboard.css';

const { Title, Text } = Typography;

const MATCHA_GREEN = '#5D8C3E';

const IncomingInterview = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [interviews, setInterviews] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal states
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  useEffect(() => {
    fetchInterviews();
  }, []);

  const fetchInterviews = async () => {
    try {
      setLoading(true);
      const response = await interviewAPI.getMySchedules();

      let data = response.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        data = data.interviews || data.schedules || data.items || [];
      }
      data = data || [];

      const normalized = Array.isArray(data)
        ? data.map((item) => ({
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
            level: item.roundNumber || item.round || item.interviewRound || item.level || 1,
            status: item.status || 'UPCOMING',
            meetingLink: item.meetingLink || item.meetingUrl || '',
          }))
        : [];

      // Filter only upcoming/pending interviews
      setInterviews(normalized.filter(i =>
        i.status === 'UPCOMING' || i.status === 'CONFIRMED' || i.status === 'PENDING'
      ));
    } catch (error) {
      console.error('Error fetching interviews:', error);
      message.error('Không thể tải danh sách phỏng vấn');
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidatesBySchedule = async (applicationId) => {
    // 1 buổi phỏng vấn gắn với đúng 1 hồ sơ (schedule.applicationId) — đọc chi tiết hồ sơ
    // qua /applications/{id} (Interviewer có quyền; KHÔNG dùng /aggregate — đó là panel
    // tổng hợp chỉ dành cho Recruiter/DM sau khi mở blind).
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

  const handleShowCandidates = (record) => {
    setSelectedSchedule(record);
    fetchCandidatesBySchedule(record.applicationId);
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

  const getStatusConfig = (status) => {
    const configs = {
      UPCOMING: { color: 'success', label: 'Sắp tới' },
      PENDING: { color: 'warning', label: 'Chờ xác nhận' },
      CONFIRMED: { color: 'processing', label: 'Đã xác nhận' },
    };
    return configs[status] || { color: 'default', label: status };
  };

  const candidateColumns = [
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

  const columns = [
    {
      title: 'Ứng viên',
      key: 'candidate',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar style={{ backgroundColor: MATCHA_GREEN }}>{record.candidate[0]}</Avatar>
          <div>
            <Text strong>{record.candidate}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{record.position}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Ngày & Giờ',
      key: 'datetime',
      render: (_, record) => (
        <div>
          <div>
            <CalendarOutlined style={{ marginRight: 4, color: MATCHA_GREEN }} />
            <Text>{record.date ? dayjs(record.date).format('DD/MM/YYYY') : '-'}</Text>
          </div>
          <div>
            <ClockCircleOutlined style={{ marginRight: 4, color: '#faad14' }} />
            <Text type="secondary">{record.time || '-'} - {record.endTime || '-'}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag color={getTypeColor(type)}>{type}</Tag>,
    },
    {
      title: 'Vòng',
      dataIndex: 'level',
      key: 'level',
      render: (level) => <Tag color="cyan">Vòng {level}</Tag>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const config = getStatusConfig(status);
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="primary"
            size="small"
            icon={<TeamOutlined />}
            onClick={() => handleShowCandidates(record)}
            style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
          >
            DS Ứng viên
          </Button>
          <Button
            type="default"
            size="small"
            icon={<VideoCameraOutlined />}
            onClick={() => window.open(record.meetingLink, '_blank')}
          >
            Join
          </Button>
        </Space>
      ),
    },
  ];

  const filteredData = interviews.filter((item) => {
    const matchesSearch =
      !searchText ||
      (item.candidate || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (item.position || '').toLowerCase().includes(searchText.toLowerCase());
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="interviewer-dashboard">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Incoming Interviews</Title>
          <Text type="secondary">Your scheduled interviews</Text>
        </div>
        <Space>
          <Badge count={interviews.length} style={{ backgroundColor: MATCHA_GREEN }}>
            <Button
              type="default"
              icon={<CalendarOutlined />}
              onClick={() => navigate('/interviewer/schedule')}
            >
              Xem Lịch Phỏng Vấn
            </Button>
          </Badge>
          <Button icon={<ReloadOutlined />} onClick={fetchInterviews} loading={loading}>
            Làm mới
          </Button>
        </Space>
      </div>

      <Card className="main-card" bordered={false}>
        <div className="toolbar" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <Input
            placeholder="Tìm kiếm..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 150 }}
            placeholder="Loại PV"
          >
            <Select.Option value="all">Tất cả loại</Select.Option>
            <Select.Option value="Technical">Technical</Select.Option>
            <Select.Option value="HR">HR</Select.Option>
            <Select.Option value="Culture">Culture</Select.Option>
          </Select>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 150 }}
            placeholder="Trạng thái"
          >
            <Select.Option value="all">Tất cả</Select.Option>
            <Select.Option value="UPCOMING">Sắp tới</Select.Option>
            <Select.Option value="PENDING">Chờ xác nhận</Select.Option>
            <Select.Option value="CONFIRMED">Đã xác nhận</Select.Option>
          </Select>
        </div>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} lịch`,
          }}
        />
      </Card>

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
                columns={candidateColumns}
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

export default IncomingInterview;
