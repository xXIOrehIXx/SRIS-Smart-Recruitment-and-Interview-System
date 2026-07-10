import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Table,
  Tag,
  Avatar,
  Button,
  Space,
  Input,
  Select,
  Badge,
  message,
} from 'antd';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SearchOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { interviewAPI } from '../../services/api';
import '../Dashboard.css';

const { Title, Text } = Typography;
const { Option } = Select;

const MATCHA_GREEN = '#5D8C3E';

const InterviewerInterviewSchedule = () => {
  const [loading, setLoading] = useState(false);
  const [interviews, setInterviews] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    fetchInterviewSchedules();
  }, []);

  const fetchInterviewSchedules = async () => {
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
            candidateEmail: item.candidateEmail || '',
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
            location: item.location || '',
            interviewerName: item.interviewerName || '',
            notes: item.notes || '',
          }))
        : [];

      setInterviews(normalized);
    } catch (error) {
      console.error('Error fetching interview schedules:', error);
      message.error('Không thể tải lịch phỏng vấn');
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status) => {
    const configs = {
      UPCOMING: { color: 'success', label: 'Sắp tới', icon: <CalendarOutlined /> },
      PENDING: { color: 'warning', label: 'Chờ xác nhận', icon: <ClockCircleOutlined /> },
      COMPLETED: { color: 'default', label: 'Đã hoàn thành', icon: <CheckCircleOutlined /> },
      CANCELLED: { color: 'error', label: 'Đã hủy', icon: <ExclamationCircleOutlined /> },
      CONFIRMED: { color: 'processing', label: 'Đã xác nhận', icon: <CheckCircleOutlined /> },
    };
    return configs[status] || { color: 'default', label: status };
  };

  const getTypeColor = (type) => {
    const colors = {
      Technical: 'blue',
      HR: 'green',
      Culture: 'purple',
    };
    return colors[type] || 'default';
  };

  const columns = [
    {
      title: 'Ứng viên',
      key: 'candidate',
      fixed: 'left',
      width: 240,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />
          <div>
            <Text strong>{record.candidate}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{record.position}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Phòng ban',
      dataIndex: 'department',
      key: 'department',
      width: 120,
    },
    {
      title: 'Ngày & Giờ',
      key: 'datetime',
      width: 180,
      render: (_, record) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <CalendarOutlined style={{ color: MATCHA_GREEN }} />
            <Text>{record.date ? dayjs(record.date).format('DD/MM/YYYY') : '-'}</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ClockCircleOutlined style={{ color: '#faad14' }} />
            <Text>{record.time || '-'} - {record.endTime || '-'}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      key: 'type',
      width: 110,
      render: (type) => <Tag color={getTypeColor(type)}>{type}</Tag>,
    },
    {
      title: 'Vòng',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level) => <Tag color="cyan">Vòng {level}</Tag>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status) => {
        const config = getStatusConfig(status);
        return <Tag color={config.color} icon={config.icon}>{config.label}</Tag>;
      },
    },
  ];

  const filteredData = interviews.filter((item) => {
    const matchesSearch =
      !searchText ||
      (item.candidate || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (item.position || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (item.department || '').toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const upcomingCount = interviews.filter((i) => i.status === 'UPCOMING' || i.status === 'CONFIRMED').length;
  const pendingCount = interviews.filter((i) => i.status === 'PENDING').length;

  return (
    <div className="interview-schedule-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Lịch Phỏng Vấn</Title>
          <Text type="secondary">Quản lý lịch phỏng vấn của bạn</Text>
        </div>
        <Space>
          <Badge count={upcomingCount} style={{ backgroundColor: MATCHA_GREEN }}>
            <Button icon={<CalendarOutlined />}>
              Sắp tới: {upcomingCount}
            </Button>
          </Badge>
          <Badge count={pendingCount} style={{ backgroundColor: '#faad14' }}>
            <Button icon={<ClockCircleOutlined />}>
              Chờ xác nhận: {pendingCount}
            </Button>
          </Badge>
          <Button icon={<ReloadOutlined />} onClick={fetchInterviewSchedules} loading={loading}>
            Làm mới
          </Button>
        </Space>
      </div>

      <Card className="main-card" bordered={false}>
        <div className="table-toolbar">
          <div className="toolbar-left">
            <Input
              placeholder="Tìm kiếm ứng viên, vị trí..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 260 }}
              allowClear
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 160 }}
              placeholder="Trạng thái"
            >
              <Option value="all">Tất cả trạng thái</Option>
              <Option value="UPCOMING">Sắp tới</Option>
              <Option value="PENDING">Chờ xác nhận</Option>
              <Option value="CONFIRMED">Đã xác nhận</Option>
              <Option value="COMPLETED">Đã hoàn thành</Option>
            </Select>
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              style={{ width: 140 }}
              placeholder="Loại PV"
            >
              <Option value="all">Tất cả loại</Option>
              <Option value="Technical">Technical</Option>
              <Option value="HR">HR</Option>
              <Option value="Culture">Culture</Option>
            </Select>
          </div>
          <Text type="secondary">
            {filteredData.length} lịch phỏng vấn
          </Text>
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
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
};

export default InterviewerInterviewSchedule;