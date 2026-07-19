import React, { useState, useEffect } from 'react';
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
  Spin,
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
import { dashboardAPI, applicationAPI } from '../../services/api';
import '../Dashboard.css';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const MATCHA_GREEN = '#5D8C3E';

const HiringDecision = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);
  
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchText, setSearchText] = useState('');

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      // Lấy danh sách từ Kanban, đặc biệt là cột OFFER
      const res = await dashboardAPI.getKanban();
      
      const offerColumn = res.data.columns.find(c => c.state === 'OFFER');
      
      if (offerColumn) {
        const formattedData = offerColumn.cards.map(c => ({
          id: c.applicationId,
          candidateName: c.candidateName,
          candidateEmail: c.candidateEmail,
          position: c.jobTitle,
          department: 'N/A',
          requestTitle: c.jobTitle,
          appliedDate: c.appliedAt,
          interviewScore: c.aiMatchScore, // Sử dụng tạm AiMatchScore hoặc fetch chi tiết
          status: 'PENDING',
          avatar: null,
          candidateId: c.candidateId,
          jobId: c.jobId,
        }));
        
        setCandidates(formattedData);
      } else {
        setCandidates([]);
      }
    } catch (error) {
      console.error('Lỗi khi tải danh sách ứng viên:', error);
      message.error('Không thể tải danh sách quyết định tuyển dụng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const getStatusTag = (status) => {
    const config = {
      PENDING: { color: 'warning', label: 'Chờ duyệt (OFFER)', icon: <ClockCircleOutlined /> },
      APPROVED: { color: 'success', label: 'Đã duyệt', icon: <CheckCircleOutlined /> },
      REJECTED: { color: 'error', label: 'Từ chối', icon: <CloseCircleOutlined /> },
    };
    const c = config[status] || { color: 'default', label: status };
    return <Tag color={c.color} icon={c.icon}>{c.label}</Tag>;
  };

  const getScoreColor = (score) => {
    if (!score) return '#999';
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
      title: 'Vị trí',
      dataIndex: 'position',
      key: 'position',
      width: 150,
    },
    {
      title: 'Điểm',
      key: 'score',
      width: 100,
      render: (_, record) => (
        <Text strong style={{ color: getScoreColor(record.interviewScore) }}>
          {record.interviewScore ? `${record.interviewScore}` : 'N/A'}
        </Text>
      ),
    },
    {
      title: 'Ngày ứng tuyển',
      dataIndex: 'appliedDate',
      key: 'appliedDate',
      width: 120,
      render: (date) => dayjs(date).format('DD/MM/YYYY'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
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
          />
          {record.status === 'PENDING' && (
            <>
              <Button
                type="primary"
                size="small"
                style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
                onClick={() => {
                  setSelectedRecord(record);
                  setApproveModalOpen(true);
                }}
              >
                Duyệt
              </Button>
              <Button
                danger
                size="small"
                onClick={() => {
                  setSelectedRecord(record);
                  setRejectModalOpen(true);
                }}
              >
                Loại
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      await applicationAPI.transition(selectedRecord.id, 'HIRED');
      if (approveNote) {
        await applicationAPI.addNote(selectedRecord.id, `[QUYẾT ĐỊNH TUYỂN DỤNG] Đồng ý tuyển: ${approveNote}`);
      }
      message.success(`Đã duyệt tuyển dụng cho ứng viên ${selectedRecord.candidateName}`);
      setApproveModalOpen(false);
      setApproveNote('');
      fetchCandidates();
    } catch (error) {
      console.error(error);
      message.error('Lỗi khi duyệt ứng viên');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason) {
      message.error('Vui lòng nhập lý do từ chối');
      return;
    }
    
    try {
      setActionLoading(true);
      // Endpoint reject riêng — reason bắt buộc, được ghi vào reject_reason
      // (transition REJECTED không kèm reason sẽ bị backend từ chối).
      await applicationAPI.reject(selectedRecord.id, rejectReason);

      message.success(`Đã từ chối ứng viên ${selectedRecord.candidateName}`);
      setRejectModalOpen(false);
      setRejectReason('');
      fetchCandidates();
    } catch (error) {
      console.error(error);
      message.error('Lỗi khi từ chối ứng viên');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredData = candidates.filter((item) => {
    const matchesSearch =
      !searchText ||
      item.candidateName.toLowerCase().includes(searchText.toLowerCase()) ||
      item.position.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = candidates.filter((i) => i.status === 'PENDING').length;

  return (
    <div className="dept-hiring-decision-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Quyết Định Tuyển Dụng</Title>
          <Text type="secondary">Xét duyệt các ứng viên đã qua vòng phỏng vấn (Cột OFFER)</Text>
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Chờ duyệt"
              value={pendingCount}
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card className="main-card" bordered={false}>
        <div className="table-toolbar">
          <div className="toolbar-left">
            <Input
              placeholder="Tìm theo tên, vị trí..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 240 }}
              allowClear
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 150 }}
            >
              <Option value="all">Tất cả trạng thái</Option>
              <Option value="PENDING">Chờ duyệt</Option>
            </Select>
          </div>
          <Text type="secondary">{filteredData.length} ứng viên</Text>
        </div>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Chi Tiết Ứng Viên"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            Đóng
          </Button>,
          selectedRecord?.status === 'PENDING' && (
            <Button
              key="reject"
              danger
              onClick={() => {
                setDetailModalOpen(false);
                setRejectModalOpen(true);
              }}
            >
              Từ chối
            </Button>
          ),
          selectedRecord?.status === 'PENDING' && (
            <Button
              key="approve"
              type="primary"
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
              onClick={() => {
                setDetailModalOpen(false);
                setApproveModalOpen(true);
              }}
            >
              Duyệt Tuyển
            </Button>
          ),
        ]}
        width={700}
      >
        {selectedRecord && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              <Avatar size={64} style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />
              <div>
                <Title level={4} style={{ margin: 0 }}>{selectedRecord.candidateName}</Title>
                <Text type="secondary">{selectedRecord.candidateEmail}</Text>
                <div style={{ marginTop: 8 }}>{getStatusTag(selectedRecord.status)}</div>
              </div>
            </div>

            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Vị trí ứng tuyển" span={2}>
                <Text strong>{selectedRecord.position}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày ứng tuyển">
                {dayjs(selectedRecord.appliedDate).format('DD/MM/YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Điểm CV (AiMatch)">
                <Text strong style={{ color: getScoreColor(selectedRecord.interviewScore) }}>
                  {selectedRecord.interviewScore ? `${selectedRecord.interviewScore}` : 'N/A'}
                </Text>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>

      {/* Approve Modal */}
      <Modal
        title="Xác Nhận Tuyển Dụng"
        open={approveModalOpen}
        onOk={handleApprove}
        confirmLoading={actionLoading}
        onCancel={() => setApproveModalOpen(false)}
        okText="Duyệt"
        cancelText="Hủy"
        okButtonProps={{ style: { background: MATCHA_GREEN, borderColor: MATCHA_GREEN } }}
      >
        <p>Bạn có chắc chắn muốn duyệt tuyển dụng ứng viên <strong>{selectedRecord?.candidateName}</strong>?</p>
        <div style={{ marginTop: 16 }}>
          <Text strong>Ghi chú quyết định:</Text>
          <TextArea
            rows={3}
            placeholder="Nhập ghi chú cho bộ phận HR..."
            value={approveNote}
            onChange={(e) => setApproveNote(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        title="Từ Chối Tuyển Dụng"
        open={rejectModalOpen}
        onOk={handleReject}
        confirmLoading={actionLoading}
        onCancel={() => setRejectModalOpen(false)}
        okText="Từ chối"
        okType="danger"
        cancelText="Hủy"
      >
        <p>Từ chối ứng viên <strong>{selectedRecord?.candidateName}</strong>?</p>
        <div style={{ marginTop: 16 }}>
          <Text strong>Lý do từ chối <span style={{ color: 'red' }}>*</span>:</Text>
          <TextArea
            rows={3}
            placeholder="Nhập lý do từ chối (bắt buộc)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default HiringDecision;
