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
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import '../Dashboard.css';

const { Title, Text } = Typography;
const { Option } = Select;

const MATCHA_GREEN = '#5D8C3E';

const InterviewerInterviewHistory = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const history = [
    {
      id: 1,
      candidate: 'Alex Morgan',
      position: 'Senior Frontend Developer',
      department: 'Engineering',
      date: '2026-07-01',
      time: '14:00',
      type: 'Technical',
      level: 1,
      status: 'COMPLETED',
      score: 42,
      maxScore: 50,
      recommendation: 'STRONG_HIRE',
      graded: true,
    },
    {
      id: 2,
      candidate: 'Jane Doe',
      position: 'Product Manager',
      department: 'Product',
      date: '2026-07-02',
      time: '10:00',
      type: 'HR',
      level: 1,
      status: 'COMPLETED',
      score: 35,
      maxScore: 50,
      recommendation: 'HIRE',
      graded: true,
    },
    {
      id: 3,
      candidate: 'John Smith',
      position: 'UX Designer',
      department: 'Design',
      date: '2026-07-03',
      time: '15:00',
      type: 'Culture',
      level: 1,
      status: 'COMPLETED',
      score: null,
      maxScore: 50,
      recommendation: null,
      graded: false,
    },
    {
      id: 4,
      candidate: 'Emily Chen',
      position: 'Backend Engineer',
      department: 'Engineering',
      date: '2026-07-04',
      time: '09:00',
      type: 'Technical',
      level: 2,
      status: 'COMPLETED',
      score: 28,
      maxScore: 50,
      recommendation: 'CONSIDER',
      graded: true,
    },
    {
      id: 5,
      candidate: 'Mike Brown',
      position: 'DevOps Engineer',
      department: 'Infrastructure',
      date: '2026-07-05',
      time: '11:00',
      type: 'Technical',
      level: 1,
      status: 'COMPLETED',
      score: 18,
      maxScore: 50,
      recommendation: 'NO_HIRE',
      graded: true,
    },
  ];

  const getStatusConfig = (status) => {
    const configs = {
      COMPLETED: { color: 'success', label: 'Đã hoàn thành', icon: <CheckCircleOutlined /> },
      CANCELLED: { color: 'error', label: 'Đã hủy', icon: <CloseCircleOutlined /> },
      MISSED: { color: 'warning', label: 'Bỏ lỡ', icon: <ClockCircleOutlined /> },
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
      render: (date) => dayjs(date).format('DD/MM/YYYY'),
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
              onClick={() => navigate(`/interviewer/interview/${record.id}`)}
            >
              Xem lại
            </Button>
          ) : (
            <Button
              type="primary"
              size="small"
              onClick={() => navigate(`/interviewer/interview/${record.id}`)}
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
      item.candidate.toLowerCase().includes(searchText.toLowerCase()) ||
      item.position.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalInterviews = history.length;
  const completedInterviews = history.filter((i) => i.status === 'COMPLETED').length;
  const avgScore =
    history.filter((i) => i.graded).length > 0
      ? Math.round(
          history
            .filter((i) => i.graded)
            .reduce((sum, i) => sum + i.score, 0) /
            history.filter((i) => i.graded).length
        )
      : 0;

  return (
    <div className="interview-history-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Lịch Sử Phỏng Vấn</Title>
          <Text type="secondary">Xem lại các buổi phỏng vấn đã thực hiện</Text>
        </div>
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
              suffix={`/ 50`}
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
