import React, { useState } from 'react';
import {
  Card,
  Typography,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Descriptions,
  Avatar,
  Input,
  Select,
  Row,
  Col,
  Statistic,
  message,
  Popconfirm,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  SearchOutlined,
  FilterOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import '../Dashboard.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

const MATCHA_GREEN = '#5D8C3E';

const HiringDecision = () => {
  const navigate = useNavigate();
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchText, setSearchText] = useState('');

  const hiringData = [
    {
      id: 1,
      candidateName: 'Nguyễn Văn Minh',
      candidateEmail: 'minhnv@email.com',
      position: 'Senior Frontend Developer',
      department: 'Engineering',
      requestTitle: 'Senior Frontend Developer',
      appliedDate: '2026-06-15',
      interviewDate: '2026-06-28',
      interviewScore: 85,
      interviewerFeedback: 'Ứng viên có kinh nghiệm tốt với React, TypeScript. Kỹ năng giao tiếp tốt.',
      status: 'PENDING',
      avatar: null,
    },
    {
      id: 2,
      candidateName: 'Trần Thị Lan',
      candidateEmail: 'lantt@email.com',
      position: 'UI/UX Designer',
      department: 'Design',
      requestTitle: 'UI/UX Designer',
      appliedDate: '2026-06-10',
      interviewDate: '2026-06-25',
      interviewScore: 78,
      interviewerFeedback: 'Kỹ năng thiết kế tốt, hiểu biết về UX research. Cần cải thiện về hệ thống design.',
      status: 'PENDING',
      avatar: null,
    },
    {
      id: 3,
      candidateName: 'Lê Hoàng Nam',
      candidateEmail: 'namlh@email.com',
      position: 'Backend Developer',
      department: 'Engineering',
      requestTitle: 'Senior Frontend Developer',
      appliedDate: '2026-06-08',
      interviewDate: '2026-06-22',
      interviewScore: 45,
      interviewerFeedback: 'Kỹ năng kỹ thuật chưa đạt yêu cầu. Thiếu kinh nghiệm với hệ thống lớn.',
      status: 'PENDING',
      avatar: null,
    },
    {
      id: 4,
      candidateName: 'Phạm Thu Hà',
      candidateEmail: 'hapt@email.com',
      position: 'DevOps Engineer',
      department: 'Infrastructure',
      requestTitle: 'DevOps Engineer',
      appliedDate: '2026-06-01',
      interviewDate: '2026-06-20',
      interviewScore: 72,
      interviewerFeedback: 'Có kinh nghiệm với CI/CD, Docker, Kubernetes. Giao tiếp tốt.',
      status: 'APPROVED',
      avatar: null,
    },
    {
      id: 5,
      candidateName: 'Hoàng Đức Anh',
      candidateEmail: 'anhhd@email.com',
      position: 'Product Manager',
      department: 'Product',
      requestTitle: 'Product Manager',
      appliedDate: '2026-05-28',
      interviewDate: '2026-06-15',
      interviewScore: 55,
      interviewerFeedback: 'Kinh nghiệm quản lý sản phẩm còn hạn chế. Cần thêm thời gian phát triển.',
      status: 'REJECTED',
      avatar: null,
    },
  ];

  const getStatusTag = (status) => {
    const config = {
      PENDING: { color: 'warning', label: 'Chờ duyệt', icon: <ClockCircleOutlined /> },
      APPROVED: { color: 'success', label: 'Đã duyệt', icon: <CheckCircleOutlined /> },
      REJECTED: { color: 'error', label: 'Từ chối', icon: <CloseCircleOutlined /> },
    };
    const c = config[status] || { color: 'default', label: status };
    return <Tag color={c.color} icon={c.icon}>{c.label}</Tag>;
  };

  const getScoreColor = (score) => {
    if (score >= 70) return '#52c41a';
    if (score >= 50) return '#faad14';
    return '#f5222d';
  };

  const columns = [
    {
      title: 'Ứng viên',
      key: 'candidate',
      fixed: 'left',
      width: 220,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />
          <div>
            <Text strong>{record.candidateName}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{record.candidateEmail}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Vị trí ứng tuyển',
      dataIndex: 'position',
      key: 'position',
      width: 180,
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.department}</Text>
        </div>
      ),
    },
    {
      title: 'Yêu cầu tuyển dụng',
      dataIndex: 'requestTitle',
      key: 'requestTitle',
      width: 180,
      render: (text) => <Text>{text || '-'}</Text>,
    },
    {
      title: 'Ngày ứng tuyển',
      dataIndex: 'appliedDate',
      key: 'appliedDate',
      width: 130,
      render: (date) => (
        <span>
          <CalendarOutlined style={{ marginRight: 4 }} />
          {dayjs(date).format('DD/MM/YYYY')}
        </span>
      ),
    },
    {
      title: 'Điểm phỏng vấn',
      dataIndex: 'interviewScore',
      key: 'interviewScore',
      width: 140,
      render: (score) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Statistic
            value={score}
            suffix="/ 100"
            valueStyle={{ fontSize: 16, color: getScoreColor(score) }}
          />
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status) => getStatusTag(status),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedRecord(record);
              setDetailModalOpen(true);
            }}
          >
            Chi tiết
          </Button>
          {record.status === 'PENDING' && (
            <>
              <Popconfirm
                title="Phê duyệt ứng viên này?"
                description="Hành động này sẽ chuyển ứng viên sang bước tiếp theo."
                onConfirm={() => handleApprove(record.id)}
                okText="Duyệt"
                cancelText="Hủy"
              >
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
                >
                  Duyệt
                </Button>
              </Popconfirm>
              <Popconfirm
                title="Từ chối ứng viên này?"
                description="Hành động này sẽ từ chối ứng viên."
                onConfirm={() => {
                  setSelectedRecord(record);
                  setRejectModalOpen(true);
                }}
                okText="Từ chối"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                >
                  Từ chối
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  const filteredData = hiringData.filter((item) => {
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesSearch =
      !searchText ||
      item.candidateName.toLowerCase().includes(searchText.toLowerCase()) ||
      item.position.toLowerCase().includes(searchText.toLowerCase()) ||
      item.department.toLowerCase().includes(searchText.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleApprove = (id) => {
    message.success('Đã phê duyệt ứng viên thành công!');
    setApproveModalOpen(false);
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      message.error('Vui lòng nhập lý do từ chối');
      return;
    }
    message.success('Đã từ chối ứng viên');
    setRejectModalOpen(false);
    setRejectReason('');
  };

  const statusStats = [
    { label: 'Chờ duyệt', value: hiringData.filter((d) => d.status === 'PENDING').length, color: '#faad14' },
    { label: 'Đã duyệt', value: hiringData.filter((d) => d.status === 'APPROVED').length, color: '#52c41a' },
    { label: 'Từ chối', value: hiringData.filter((d) => d.status === 'REJECTED').length, color: '#f5222d' },
  ];

  return (
    <div className="hiring-decision-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Quyết Định Tuyển Dụng</Title>
          <Text type="secondary">Xem xét và phê duyệt ứng viên từ các vòng phỏng vấn</Text>
        </div>
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={() => navigate('/dept/create-request')}
          style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
        >
          Tạo Yêu Cầu Tuyển Dụng
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statusStats.map((stat, idx) => (
          <Col xs={12} sm={8} key={idx}>
            <Card className="stat-card" bordered={false}>
              <Statistic
                title={stat.label}
                value={stat.value}
                valueStyle={{ color: stat.color, fontSize: 28, fontWeight: 700 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="main-card" bordered={false}>
        <div className="table-toolbar">
          <div className="toolbar-left">
            <Input
              placeholder="Tìm kiếm ứng viên..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 280 }}
              allowClear
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 160 }}
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'PENDING', label: 'Chờ duyệt' },
                { value: 'APPROVED', label: 'Đã duyệt' },
                { value: 'REJECTED', label: 'Từ chối' },
              ]}
            />
          </div>
          <Text type="secondary">
            {filteredData.length} ứng viên
          </Text>
        </div>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} ứng viên`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />
            <span>Chi tiết ứng viên</span>
          </div>
        }
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedRecord(null);
        }}
        footer={
          selectedRecord?.status === 'PENDING' ? (
            <Space>
              <Button onClick={() => setDetailModalOpen(false)}>Đóng</Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => {
                  setDetailModalOpen(false);
                  setRejectModalOpen(true);
                }}
              >
                Từ chối
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
                onClick={() => {
                  handleApprove(selectedRecord.id);
                  setDetailModalOpen(false);
                }}
              >
                Phê duyệt
              </Button>
            </Space>
          ) : (
            <Button onClick={() => setDetailModalOpen(false)}>Đóng</Button>
          )
        }
        width={680}
      >
        {selectedRecord && (
          <div>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Họ tên" span={2}>
                <Text strong>{selectedRecord.candidateName}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {selectedRecord.candidateEmail}
              </Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">
                {selectedRecord.candidateEmail?.split('@')[0] || 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Vị trí ứng tuyển">
                {selectedRecord.position}
              </Descriptions.Item>
              <Descriptions.Item label="Phòng ban">
                {selectedRecord.department}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày ứng tuyển">
                {dayjs(selectedRecord.appliedDate).format('DD/MM/YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày phỏng vấn">
                {dayjs(selectedRecord.interviewDate).format('DD/MM/YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái" span={2}>
                {getStatusTag(selectedRecord.status)}
              </Descriptions.Item>
            </Descriptions>

            <Card title="Điểm Phỏng Vấn" size="small" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Statistic
                  title="Điểm tổng"
                  value={selectedRecord.interviewScore}
                  suffix="/ 100"
                  valueStyle={{
                    color: getScoreColor(selectedRecord.interviewScore),
                    fontSize: 32,
                    fontWeight: 700,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      height: 8,
                      background: '#f0f0f0',
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${selectedRecord.interviewScore}%`,
                        height: '100%',
                        background: getScoreColor(selectedRecord.interviewScore),
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Phản hồi từ Người phỏng vấn" size="small">
              <Text>{selectedRecord.interviewerFeedback}</Text>
            </Card>
          </div>
        )}
      </Modal>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CloseCircleOutlined style={{ color: '#f5222d' }} />
            <span>Từ chối ứng viên</span>
          </div>
        }
        open={rejectModalOpen}
        onCancel={() => {
          setRejectModalOpen(false);
          setRejectReason('');
        }}
        onOk={handleReject}
        okText="Xác nhận từ chối"
        okButtonProps={{ danger: true }}
      >
        {selectedRecord && (
          <div>
            <Text>
              Bạn đang từ chối ứng viên <strong>{selectedRecord.candidateName}</strong> cho vị trí{' '}
              <strong>{selectedRecord.position}</strong>.
            </Text>
            <div style={{ marginTop: 16 }}>
              <Text strong>Lý do từ chối *</Text>
              <TextArea
                rows={4}
                placeholder="Nhập lý do từ chối ứng viên..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{ marginTop: 8 }}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircleOutlined style={{ color: MATCHA_GREEN }} />
            <span>Phê duyệt ứng viên</span>
          </div>
        }
        open={approveModalOpen}
        onCancel={() => {
          setApproveModalOpen(false);
          setApproveNote('');
        }}
        onOk={handleApprove}
        okText="Xác nhận phê duyệt"
        okButtonProps={{ style: { background: MATCHA_GREEN, borderColor: MATCHA_GREEN } }}
      >
        {selectedRecord && (
          <div>
            <Text>
              Bạn đồng ý phê duyệt ứng viên <strong>{selectedRecord.candidateName}</strong> cho vị trí{' '}
              <strong>{selectedRecord.position}</strong>.
            </Text>
            <div style={{ marginTop: 16 }}>
              <Text strong>Ghi chú (tùy chọn)</Text>
              <TextArea
                rows={4}
                placeholder="Nhập ghi chú nếu có..."
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                style={{ marginTop: 8 }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default HiringDecision;
