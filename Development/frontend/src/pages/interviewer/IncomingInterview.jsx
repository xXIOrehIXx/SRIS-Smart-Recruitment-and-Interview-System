import React, { useEffect, useState } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { interviewAPI } from '../../services/api';
import InterviewDetailModal from './InterviewDetailModal';
import '../Dashboard.css';

const { Title, Text } = Typography;

const MATCHA_GREEN = '#5D8C3E';

// ====== Helpers =================================================
const RECOMMENDATIONS = [
  { key: 'STRONG_HIRE', label: 'Trúng tuyển mạnh', color: '#52c41a' },
  { key: 'HIRE', label: 'Trúng tuyển', color: '#73d13d' },
  { key: 'CONSIDER', label: 'Cân nhắc', color: '#faad14' },
  { key: 'NO_HIRE', label: 'Không trúng tuyển', color: '#f5222d' },
];

// Status hiển thị cho lịch (PENDING|CONFIRMED|CANCELLED...).
const statusConfig = {
  PENDING: { color: 'warning', label: 'Chờ ứng viên chốt lịch' },
  CONFIRMED: { color: 'processing', label: 'Đã chốt lịch' },
  NO_SLOT_FITS: { color: 'error', label: 'Không khớp khung giờ' },
  CANCELLED: { color: 'default', label: 'Đã hủy' },
};

// ====== Main page ==============================================
const IncomingInterview = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [interviews, setInterviews] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  const normalizeSchedules = (raw) => {
    const data = Array.isArray(raw) ? raw : [];
    return data
      .map((item) => ({
        id: item.scheduleId,
        scheduleId: item.scheduleId,
        applicationId: item.applicationId,
        candidate: item.candidateName || 'N/A',
        candidateName: item.candidateName || 'N/A',
        candidateEmail: item.candidateEmail || '',
        position: item.jobTitle || 'N/A',
        jobTitle: item.jobTitle || 'N/A',
        startTime: item.startTime,
        level: item.roundNumber || 1,
        roundNumber: item.roundNumber || 1,
        status: item.status,
        mySheetStatus: item.mySheetStatus || 'NOT_STARTED',
      }))
      .filter((i) => i.status === 'PENDING' || i.status === 'CONFIRMED')
      .filter((i) => i.startTime && dayjs(i.startTime).isAfter(dayjs().subtract(1, 'day')))
      .sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf());
  };

  const fetchInterviews = async () => {
    try {
      setLoading(true);
      const response = await interviewAPI.getMySchedules();
      console.log('[IncomingInterview] raw response:', response);

      let data = response.data;
      if (data === null || data === undefined || data === '') {
        console.warn('[IncomingInterview] response body rỗng — BE có thể trả [] nhưng bị mất do middleware/serializer.');
        data = [];
      } else if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          data = [];
        }
      } else if (typeof data === 'object' && !Array.isArray(data)) {
        data = data.interviews || data.schedules || data.items || data.data || [];
      }

      setInterviews(normalizeSchedules(data));
    } catch (error) {
      console.error('Error fetching interviews:', error);
      message.error('Không thể tải danh sách phỏng vấn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, []);

  const openDetail = (record) => {
    setSelectedSchedule(record);
    setDetailOpen(true);
  };

  const navigateToGrading = (record) => {
    navigate(`/interviewer/grading/${record.scheduleId}`, {
      state: {
        schedule: record,
        candidate: {
          candidateName: record.candidateName,
          candidate: record.candidateName,
          name: record.candidateName,
          email: record.candidateEmail,
          position: record.jobTitle,
          jobTitle: record.jobTitle,
          round: record.roundNumber,
          startTime: record.startTime,
        },
        mode: record.mySheetStatus === 'SUBMITTED'
          ? 'view'
          : record.mySheetStatus === 'DRAFT'
            ? 'continue'
            : 'new',
      },
    });
  };

  const sheetStatusLabel = (s) => {
    if (s === 'SUBMITTED') return { color: 'success', icon: <CheckCircleOutlined />, text: 'Đã nộp' };
    if (s === 'DRAFT') return { color: 'warning', icon: <EditOutlined />, text: 'Đang nháp' };
    return { color: 'default', icon: <EditOutlined />, text: 'Chưa chấm' };
  };

  const columns = [
    {
      title: 'Ứng viên',
      key: 'candidate',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar style={{ backgroundColor: MATCHA_GREEN }}>{(record.candidate || '?')[0]}</Avatar>
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
      sorter: (a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf(),
      defaultSortOrder: 'ascend',
      render: (_, record) => (
        <div>
          <div>
            <CalendarOutlined style={{ marginRight: 4, color: MATCHA_GREEN }} />
            <Text>{record.startTime ? dayjs(record.startTime).format('DD/MM/YYYY') : '-'}</Text>
          </div>
          <div>
            <ClockCircleOutlined style={{ marginRight: 4, color: '#faad14' }} />
            <Text type="secondary">{record.startTime ? dayjs(record.startTime).format('HH:mm') : '-'}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Vòng',
      dataIndex: 'level',
      key: 'level',
      render: (level) => <Tag color="cyan">Vòng {level}</Tag>,
    },
    {
      title: 'Trạng thái lịch',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const cfg = statusConfig[status] || { color: 'default', label: status };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Phiếu chấm',
      key: 'sheet',
      render: (_, record) => {
        const cfg = sheetStatusLabel(record.mySheetStatus);
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.text}</Tag>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={() => openDetail(record)}
          >
            Chi tiết
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigateToGrading(record)}
            style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
          >
            {record.mySheetStatus === 'SUBMITTED'
              ? 'Xem / Sửa'
              : record.mySheetStatus === 'DRAFT'
                ? 'Tiếp tục'
                : 'Chấm điểm'}
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
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="interviewer-dashboard">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Phỏng vấn sắp tới</Title>
          <Text type="secondary">
            Danh sách các buổi được phân công — sắp xếp theo thời gian gần nhất. Bấm "Chi tiết" để xem popup,
            hoặc "Chấm điểm" để vào trang chấm.
          </Text>
        </div>
        <Space>
          <Badge count={interviews.length} style={{ backgroundColor: MATCHA_GREEN }}>
            <Button icon={<CalendarOutlined />}>Buổi được phân công</Button>
          </Badge>
          <Button icon={<ReloadOutlined />} onClick={fetchInterviews} loading={loading}>
            Làm mới
          </Button>
        </Space>
      </div>

      <Card className="main-card" bordered={false}>
        <div className="toolbar" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <Input
            placeholder="Tìm theo tên ứng viên / vị trí..."
            prefix={<FileTextOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 220 }}
            placeholder="Trạng thái"
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'PENDING', label: 'Chờ ứng viên chốt lịch' },
              { value: 'CONFIRMED', label: 'Đã chốt lịch' },
            ]}
          />
        </div>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Tổng ${total} lịch` }}
          locale={{
            emptyText: (
              <div style={{ padding: 24 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  Bạn chưa có buổi phỏng vấn nào được giao.
                </Text>
                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  Các buổi sẽ hiện ở đây sau khi:
                  <ul style={{ marginTop: 8, paddingLeft: 24, textAlign: 'left' }}>
                    <li>Recruiter mở pool khung giờ và gán panel có bạn.</li>
                    <li>Ứng viên chốt 1 khung → schedule chuyển sang <Tag color="processing">CONFIRMED</Tag>.</li>
                  </ul>
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Nếu đã có ứng viên chốt mà vẫn trống, mở DevTools → Console, kiểm tra log <code>[IncomingInterview] raw response</code> để xem API có trả dữ liệu không.
                </Text>
              </div>
            ),
          }}
        />
      </Card>

      <InterviewDetailModal
        schedule={selectedSchedule}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        mode="incoming"
      />
    </div>
  );
};

export default IncomingInterview;
