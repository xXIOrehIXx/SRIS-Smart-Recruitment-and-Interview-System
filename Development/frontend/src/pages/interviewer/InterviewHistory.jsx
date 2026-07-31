import React, { useEffect, useState } from 'react';
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
  Row,
  Col,
  Statistic,
  Empty,
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
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { interviewAPI } from '../../services/api';
import InterviewDetailModal from './InterviewDetailModal';
import '../Dashboard.css';

const { Title, Text } = Typography;

const MATCHA_GREEN = '#5D8C3E';

/**
 * Lịch sử phỏng vấn — dùng chung API `getMySchedules`, lọc các buổi:
 *   - ĐÃ CHẤM (mySheetStatus === 'SUBMITTED') — ưu tiên
 *   - HOẶC đã qua theo StartTime + có schedule CONFIRMED
 *
 * Mỗi row có 2 nút:
 *   - "Chi tiết" → mở popup InterviewDetailModal
 *   - "Xem / Sửa" → navigate sang /interviewer/grading/:id (load điểm đã nộp)
 */
const InterviewerInterviewHistory = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [sheetFilter, setSheetFilter] = useState('all');
  const [detailSchedule, setDetailSchedule] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const normalize = (raw) => {
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
      // Lịch sử chỉ quan tâm các buổi đã có phiếu (DRAFT hoặc SUBMITTED),
      // hoặc các buổi CONFIRMED đã qua StartTime.
      .filter((i) => {
        if (i.mySheetStatus === 'SUBMITTED' || i.mySheetStatus === 'DRAFT') return true;
        if (i.startTime && dayjs(i.startTime).isBefore(dayjs())) return true;
        return false;
      })
      .sort((a, b) => {
        // SUBMITTED trước, sau đó DRAFT, cuối cùng là đã qua chưa chấm
        const rank = (s) => (s === 'SUBMITTED' ? 0 : s === 'DRAFT' ? 1 : 2);
        if (rank(a.mySheetStatus) !== rank(b.mySheetStatus)) {
          return rank(a.mySheetStatus) - rank(b.mySheetStatus);
        }
        return dayjs(b.startTime).valueOf() - dayjs(a.startTime).valueOf();
      });
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await interviewAPI.getMySchedules();
      console.log('[InterviewHistory] raw response:', response);
      let data = response.data;
      if (data === null || data === undefined || data === '') data = [];
      else if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { data = []; }
      } else if (typeof data === 'object' && !Array.isArray(data)) {
        data = data.interviews || data.schedules || data.items || data.data || [];
      }
      setHistory(normalize(data));
    } catch (error) {
      console.error('Error fetching interview history:', error);
      message.error('Không thể tải lịch sử phỏng vấn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = (record) => {
    setDetailSchedule(record);
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
        mode: record.mySheetStatus === 'SUBMITTED' ? 'view' : 'continue',
      },
    });
  };

  const sheetStatusTag = (s) => {
    if (s === 'SUBMITTED') return <Tag color="success" icon={<CheckCircleOutlined />}>Đã nộp</Tag>;
    if (s === 'DRAFT') return <Tag color="warning" icon={<EditOutlined />}>Đang nháp</Tag>;
    return <Tag color="default" icon={<ClockCircleOutlined />}>Chưa chấm</Tag>;
  };

  const scheduleStatusTag = (s) => {
    if (s === 'CONFIRMED') return <Tag color="processing">Đã chốt lịch</Tag>;
    if (s === 'PENDING') return <Tag color="warning">Chờ ứng viên chốt</Tag>;
    if (s === 'CANCELLED') return <Tag color="default">Đã hủy</Tag>;
    return <Tag>{s}</Tag>;
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
      title: 'Ngày & Giờ',
      key: 'datetime',
      width: 180,
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
      width: 90,
      render: (level) => <Tag color="cyan">Vòng {level}</Tag>,
    },
    {
      title: 'Trạng thái lịch',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: scheduleStatusTag,
    },
    {
      title: 'Phiếu chấm',
      dataIndex: 'mySheetStatus',
      key: 'sheet',
      width: 140,
      render: sheetStatusTag,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 240,
      fixed: 'right',
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
            size="small"
            type={record.mySheetStatus === 'SUBMITTED' ? 'default' : 'primary'}
            icon={record.mySheetStatus === 'SUBMITTED' ? <CheckCircleOutlined /> : <EditOutlined />}
            onClick={() => navigateToGrading(record)}
            style={
              record.mySheetStatus === 'SUBMITTED'
                ? undefined
                : { background: MATCHA_GREEN, borderColor: MATCHA_GREEN }
            }
          >
            {record.mySheetStatus === 'SUBMITTED' ? 'Xem / Sửa' : 'Tiếp tục chấm'}
          </Button>
        </Space>
      ),
    },
  ];

  const filteredData = history.filter((item) => {
    const matchesSearch =
      !searchText ||
      (item.candidate || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (item.position || '').toLowerCase().includes(searchText.toLowerCase());
    const matchesSheet = sheetFilter === 'all' || item.mySheetStatus === sheetFilter;
    return matchesSearch && matchesSheet;
  });

  const submittedCount = history.filter((i) => i.mySheetStatus === 'SUBMITTED').length;
  const draftCount = history.filter((i) => i.mySheetStatus === 'DRAFT').length;

  return (
    <div className="interview-history-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Lịch sử phỏng vấn</Title>
          <Text type="secondary">
            Danh sách các buổi bạn đã/đang chấm. Bấm "Chi tiết" để xem popup,
            hoặc "Xem / Sửa" để mở lại phiếu chấm và chỉnh sửa.
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchHistory} loading={loading}>
          Làm mới
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Tổng buổi"
              value={history.length}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: MATCHA_GREEN }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Đã nộp"
              value={submittedCount}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Đang nháp"
              value={draftCount}
              prefix={<EditOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card className="main-card" bordered={false}>
        <div className="table-toolbar" style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Tìm theo tên ứng viên / vị trí..."
            prefix={<FileTextOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Select
            value={sheetFilter}
            onChange={setSheetFilter}
            style={{ width: 200 }}
            placeholder="Phiếu chấm"
            options={[
              { value: 'all', label: 'Tất cả phiếu' },
              { value: 'SUBMITTED', label: 'Đã nộp' },
              { value: 'DRAFT', label: 'Đang nháp' },
              { value: 'NOT_STARTED', label: 'Chưa chấm' },
            ]}
          />
          <Text type="secondary" style={{ marginLeft: 'auto' }}>
            {filteredData.length} buổi
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
            showTotal: (total) => `Tổng ${total} buổi`,
          }}
          scroll={{ x: 1100 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 4 }}>
                      Bạn chưa có buổi phỏng vấn nào trong lịch sử.
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Sau khi bạn nộp phiếu chấm, buổi đó sẽ xuất hiện ở đây.
                    </Text>
                  </div>
                }
              />
            ),
          }}
        />
      </Card>

      <InterviewDetailModal
        schedule={detailSchedule}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        mode="history"
      />
    </div>
  );
};

export default InterviewerInterviewHistory;
