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
  Row,
  Col,
  Statistic,
  message,
} from 'antd';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { applicationAPI } from '../../services/api';
import '../Dashboard.css';

const { Title, Text } = Typography;
const { Option } = Select;

const MATCHA_GREEN = '#5D8C3E';

const InterviewerInterviewHistory = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await applicationAPI.getHistory(0);
      const data = response.data || [];

      const normalized = data.map((item) => ({
        id: item.applicationId || item.id,
        candidate: item.candidateName || item.candidate || 'N/A',
        position: item.positionTitle || item.jobTitle || item.position || 'N/A',
        department: item.department || 'N/A',
        date: item.interviewDate || item.scheduledDate || item.date,
        time: item.interviewTime || item.scheduledTime || item.time || '',
        type: item.interviewType || item.type || 'N/A',
        level: item.round || item.interviewRound || item.level || 1,
        status: item.status || 'PENDING',
        score: item.score ?? null,
        maxScore: item.maxScore || 50,
        recommendation: item.recommendation || null,
        graded: item.graded ?? (item.score !== null && item.score !== undefined),
        applicationId: item.applicationId || item.id,
      }));

      setHistory(normalized);
    } catch (error) {
      console.error('Error fetching interview history:', error);
      message.error('Không thể tải lịch sử phỏng vấn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const getStatusConfig = (status) => {
    const configs = {
      COMPLETED: { color: 'success', label: 'Đã hoàn thành', icon: <CheckCircleOutlined /> },
      CANCELLED: { color: 'error', label: 'Đã hủy', icon: <CloseCircleOutlined /> },
      MISSED: { color: 'warning', label: 'Bỏ lỡ', icon: <ClockCircleOutlined /> },
      PENDING: { color: 'processing', label: 'Chờ xử lý', icon: <ClockCircleOutlined /> },
    };
    return configs[status] || { color: 'default', label: status };
  };

  const getRecommendationConfig = (rec) => {
    const configs = {
      STRONG_HIRE: { color: '#52c41a', label: 'Trúng tuyển mạnh' },
      HIRE: { color: '#73d13d', label: 'Trúng tuyển' },
      CONSIDER: { color: '#faad14', label: 'Cân nhắc' },
      NO_HIRE: { color: '#f5222d', label: 'Không trúng tuyển' },
    };
    return configs[rec] || { color: 'default', label: '-' };
  };

  const getScoreColor = (score, max) => {
    if (score === null || score === undefined) return '#faad14';
    const percent = (score / max) * 100;
    if (percent >= 80) return '#52c41a';
    if (percent >= 60) return '#faad14';
    return '#f5222d';
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
      title: 'Ngày',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (date) => (date ? dayjs(date).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      key: 'type',
      width: 110,
      render: (type) => <Tag color="blue">{type}</Tag>,
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
      title: 'Điểm',
      key: 'score',
      width: 130,
      render: (_, record) => (
        <div>
          {record.graded ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong style={{ color: getScoreColor(record.score, record.maxScore), fontSize: 16 }}>
                {record.score}
              </Text>
              <Text type="secondary">/ {record.maxScore}</Text>
            </div>
          ) : (
            <Tag color="warning">Chưa chấm</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Đề xuất',
      key: 'recommendation',
      width: 150,
      render: (_, record) => {
        if (!record.graded) return <Text type="secondary">-</Text>;
        const config = getRecommendationConfig(record.recommendation);
        return <Tag style={{ background: `${config.color}15`, color: config.color, borderColor: config.color }}>{config.label}</Tag>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: 140,
      render: (_, record) => (
        <Space size={4}>
          {record.graded ? (
            <Button
              type="link"
              size="small"
              onClick={() => navigate(`/interviewer/interview/${record.applicationId || record.id}`)}
            >
              Xem lại
            </Button>
          ) : (
            <Button
              type="primary"
              size="small"
              onClick={() => navigate(`/interviewer/interview/${record.applicationId || record.id}`)}
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
            >
              Chấm điểm
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const filteredData = history.filter((item) => {
    const matchesSearch =
      !searchText ||
      (item.candidate || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (item.position || '').toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalInterviews = history.length;
  const completedInterviews = history.filter((i) => i.status === 'COMPLETED').length;
  const avgScore =
    history.filter((i) => i.graded && i.score !== null).length > 0
      ? Math.round(
          history
            .filter((i) => i.graded && i.score !== null)
            .reduce((sum, i) => sum + i.score, 0) /
            history.filter((i) => i.graded && i.score !== null).length
        )
      : 0;

  return (
    <div className="interview-history-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Lịch Sử Phỏng Vấn</Title>
          <Text type="secondary">Xem lại các buổi phỏng vấn đã thực hiện</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchHistory} loading={loading}>
          Làm mới
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Tổng phỏng vấn"
              value={totalInterviews}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: MATCHA_GREEN }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Đã hoàn thành"
              value={completedInterviews}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Điểm TB"
              value={avgScore}
              suffix="/ 50"
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

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
            >
              <Option value="all">Tất cả trạng thái</Option>
              <Option value="COMPLETED">Đã hoàn thành</Option>
              <Option value="CANCELLED">Đã hủy</Option>
              <Option value="MISSED">Bỏ lỡ</Option>
            </Select>
          </div>
          <Text type="secondary">
            {filteredData.length} buổi phỏng vấn
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
        />
      </Card>
    </div>
  );
};

export default InterviewerInterviewHistory;
