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
  DatePicker,
  Badge,
  Modal,
  message,
  Form,
} from 'antd';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  VideoCameraOutlined,
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
  const [rescheduleModal, setRescheduleModal] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [rescheduleForm] = Form.useForm();

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

  useEffect(() => {
    fetchInterviewSchedules();
  }, []);

  const getStatusConfig = (status) => {
    const configs = {
      UPCOMING: { color: 'success', label: 'Sắp tới', icon: <VideoCameraOutlined /> },
      PENDING: { color: 'warning', label: 'Chờ xác nhận', icon: <ClockCircleOutlined /> },
      COMPLETED: { color: 'default', label: 'Đã hoàn thành', icon: <CalendarOutlined /> },
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

  const handleReschedule = async (values) => {
    if (!selectedInterview) return;
    try {
      await interviewAPI.reschedule(selectedInterview.id, selectedInterview.id);
      message.success('Đã gửi yêu cầu đổi lịch!');
      setRescheduleModal(false);
      rescheduleForm.resetFields();
      fetchInterviewSchedules();
    } catch (error) {
      console.error('Error rescheduling:', error);
      message.error('Không thể đổi lịch. Vui lòng thử lại.');
    }
  };

  const handleCancel = async (record) => {
    try {
      await interviewAPI.cancelSchedule(record.id, 'Interviewer cancelled');
      message.success('Đã hủy lịch phỏng vấn');
      fetchInterviewSchedules();
    } catch (error) {
      console.error('Error cancelling:', error);
      message.error('Không thể hủy lịch. Vui lòng thử lại.');
    }
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
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space size={4}>
          {record.status !== 'CANCELLED' && record.status !== 'COMPLETED' && (
            <Button
              type="primary"
              size="small"
              icon={<VideoCameraOutlined />}
              onClick={() => window.open(record.meetingLink, '_blank')}
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
            >
              Tham gia
            </Button>
          )}
        </Space>
      ),
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
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal
        title="Đổi lịch phỏng vấn"
        open={rescheduleModal}
        onCancel={() => {
          setRescheduleModal(false);
          setSelectedInterview(null);
          rescheduleForm.resetFields();
        }}
        onOk={() => rescheduleForm.submit()}
        okText="Gửi yêu cầu"
      >
        {selectedInterview && (
          <Form
            form={rescheduleForm}
            layout="vertical"
            onFinish={handleReschedule}
          >
            <Text>
              Bạn đang yêu cầu đổi lịch phỏng vấn với <strong>{selectedInterview.candidate}</strong> cho vị trí{' '}
              <strong>{selectedInterview.position}</strong>.
            </Text>
            <Form.Item
              name="newDate"
              label="Chọn ngày mới"
              rules={[{ required: true, message: 'Vui lòng chọn ngày mới' }]}
              style={{ marginTop: 16 }}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="reason"
              label="Lý do (tùy chọn)"
            >
              <Input.TextArea rows={3} placeholder="Nhập lý do đổi lịch..." />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default InterviewerInterviewSchedule;
