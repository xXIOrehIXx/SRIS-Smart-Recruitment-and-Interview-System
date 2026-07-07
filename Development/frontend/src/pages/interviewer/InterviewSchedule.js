import React, { useState } from 'react';
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
  DatePicker,
  Row,
  Col,
  Badge,
  Modal,
  message,
} from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  VideoCameraOutlined,
  SearchOutlined,
  FilterOutlined,
  UserOutlined,
  TeamOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import '../Dashboard.css';

const { Title, Text } = Typography;
const { Option } = Select;

const MATCHA_GREEN = '#5D8C3E';

const InterviewerInterviewSchedule = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [rescheduleModal, setRescheduleModal] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState(null);

  const interviews = [
    {
      id: 1,
      candidate: 'Nguyễn Văn Minh',
      position: 'Senior Frontend Developer',
      department: 'Engineering',
      date: '2026-07-08',
      time: '14:00',
      endTime: '15:00',
      duration: 60,
      type: 'Technical',
      level: 1,
      status: 'UPCOMING',
      meetingLink: 'https://meet.google.com/abc-defg-hij',
    },
    {
      id: 2,
      candidate: 'Trần Thị Lan',
      position: 'UI/UX Designer',
      department: 'Design',
      date: '2026-07-09',
      time: '09:00',
      endTime: '10:00',
      duration: 60,
      type: 'HR',
      level: 1,
      status: 'UPCOMING',
      meetingLink: 'https://meet.google.com/xyz-uvwx-rst',
    },
    {
      id: 3,
      candidate: 'Lê Hoàng Nam',
      position: 'Backend Developer',
      department: 'Engineering',
      date: '2026-07-10',
      time: '15:00',
      endTime: '16:00',
      duration: 60,
      type: 'Technical',
      level: 2,
      status: 'UPCOMING',
      meetingLink: 'https://meet.google.com/pqr-stuv-wxy',
    },
    {
      id: 4,
      candidate: 'Phạm Thu Hà',
      position: 'QA Engineer',
      department: 'QA',
      date: '2026-07-11',
      time: '10:00',
      endTime: '11:00',
      duration: 60,
      type: 'Culture',
      level: 1,
      status: 'PENDING',
      meetingLink: 'https://meet.google.com/mno-pqrs-tuv',
    },
    {
      id: 5,
      candidate: 'Hoàng Đức Anh',
      position: 'Product Manager',
      department: 'Product',
      date: '2026-07-12',
      time: '13:00',
      endTime: '14:00',
      duration: 60,
      type: 'HR',
      level: 2,
      status: 'PENDING',
      meetingLink: 'https://meet.google.com/klm-nopq-rst',
    },
  ];

  const getStatusConfig = (status) => {
    const configs = {
      UPCOMING: { color: 'success', label: 'Sắp tới', icon: <VideoCameraOutlined /> },
      PENDING: { color: 'warning', label: 'Chờ xác nhận', icon: <ClockCircleOutlined /> },
      COMPLETED: { color: 'default', label: 'Đã hoàn thành', icon: <CalendarOutlined /> },
      CANCELLED: { color: 'error', label: 'Đã hủy', icon: <ExclamationCircleOutlined /> },
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
            <Text>{dayjs(record.date).format('DD/MM/YYYY')}</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ClockCircleOutlined style={{ color: '#faad14' }} />
            <Text>{record.time} - {record.endTime}</Text>
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
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: 220,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="primary"
            size="small"
            icon={<VideoCameraOutlined />}
            onClick={() => window.open(record.meetingLink, '_blank')}
            style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
          >
            Tham gia
          </Button>
          <Button
            size="small"
            onClick={() => {
              setSelectedInterview(record);
              setRescheduleModal(true);
            }}
          >
            Đổi lịch
          </Button>
          <Button
            type="text"
            size="small"
            onClick={() => navigate(`/interviewer/interview/${record.id}`)}
          >
            Chi tiết
          </Button>
        </Space>
      ),
    },
  ];

  const filteredData = interviews.filter((item) => {
    const matchesSearch =
      !searchText ||
      item.candidate.toLowerCase().includes(searchText.toLowerCase()) ||
      item.position.toLowerCase().includes(searchText.toLowerCase()) ||
      item.department.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const upcomingCount = interviews.filter((i) => i.status === 'UPCOMING').length;
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
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} lịch`,
          }}
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal
        title="Đổi lịch phỏng vấn"
        open={rescheduleModal}
        onCancel={() => {
          setRescheduleModal(false);
          setSelectedInterview(null);
        }}
        onOk={() => {
          message.success('Đã gửi yêu cầu đổi lịch!');
          setRescheduleModal(false);
        }}
        okText="Gửi yêu cầu"
      >
        {selectedInterview && (
          <div>
            <Text>
              Bạn đang yêu cầu đổi lịch phỏng vấn với <strong>{selectedInterview.candidate}</strong> cho vị trí{' '}
              <strong>{selectedInterview.position}</strong>.
            </Text>
            <div style={{ marginTop: 16 }}>
              <Text strong>Chọn ngày mới:</Text>
              <DatePicker style={{ width: '100%', marginTop: 8 }} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InterviewerInterviewSchedule;
