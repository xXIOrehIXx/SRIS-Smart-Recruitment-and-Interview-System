import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Row,
  Col,
  Statistic,
  Modal,
  Descriptions,
  Avatar,
  message,
  Popconfirm,
} from 'antd';
import {
  FileTextOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { recruitmentRequestAPI } from '../../services/api';
import { useAuth, ROLES } from '../../contexts/AuthContext';
import '../Dashboard.css';

const { Title, Text } = Typography;
const { Option } = Select;

const MATCHA_GREEN = '#5D8C3E';

const DeptRecruitmentRequests = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [detailModal, setDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const { user } = useAuth();
  const isRecruiter = user?.role === ROLES.RECRUITER || user?.role === ROLES.ADMIN;
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const PRIORITY_LABEL = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await recruitmentRequestAPI.getAll();
      // RecruitmentRequestDto -> view model cua trang
      setRequests((response.data || []).map((r) => ({
        id: r.requestId,
        title: r.title,
        department: r.department || 'N/A',
        positions: r.quantity,
        priority: PRIORITY_LABEL[r.priority] || r.priority,
        submittedDate: r.createdAt,
        status: r.status,
        submittedBy: r.createdByName || 'N/A',
        employmentType: r.employmentType,
        experienceLevel: r.experienceLevel || 'N/A',
        description: r.description,
        requirements: r.requirements,
        benefits: r.benefits,
        salaryMin: r.salaryMin,
        salaryMax: r.salaryMax,
        expectedStartDate: r.expectedStartDate,
        reviewNote: r.reviewNote,
        reviewedByName: r.reviewedByName,
        jobId: r.jobId,
      })));
    } catch (error) {
      console.error('Error fetching requests:', error);
      message.error(error?.response?.data?.userMsg || 'Khong the tai danh sach yeu cau tuyen dung');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recruiter duyet / tu choi (tu choi bat buoc ly do)
  const handleReview = async (record, approve) => {
    if (!approve) {
      let note = '';
      Modal.confirm({
        title: `Tu choi yeu cau "${record.title}"?`,
        content: (
          <Input.TextArea rows={3} placeholder="Ly do tu choi (bat buoc)..."
            onChange={(e) => { note = e.target.value; }} />
        ),
        okText: 'Tu choi',
        okButtonProps: { danger: true },
        cancelText: 'Huy',
        onOk: async () => {
          if (!note.trim()) {
            message.error('Vui long nhap ly do tu choi');
            return Promise.reject();
          }
          try {
            await recruitmentRequestAPI.review(record.id, false, note.trim());
            message.success('Da tu choi yeu cau');
            fetchRequests();
          } catch (err) {
            message.error(err?.response?.data?.userMsg || 'Khong the tu choi yeu cau');
            return Promise.reject();
          }
        },
      });
      return;
    }
    try {
      await recruitmentRequestAPI.review(record.id, true);
      message.success('Da phe duyet yeu cau — co the tao tin tuyen dung tu yeu cau nay.');
      fetchRequests();
    } catch (error) {
      message.error(error?.response?.data?.userMsg || 'Khong the phe duyet yeu cau');
    }
  };

  // DM huy yeu cau cua minh (chi khi PENDING)
  const handleCancel = async (record) => {
    try {
      await recruitmentRequestAPI.cancel(record.id);
      message.success('Da huy yeu cau');
      fetchRequests();
    } catch (error) {
      message.error(error?.response?.data?.userMsg || 'Khong the huy yeu cau');
    }
  };

  const getStatusConfig = (status) => {
    const configs = {
      PENDING: { color: 'warning', label: 'Chờ duyệt', icon: <ClockCircleOutlined /> },
      APPROVED: { color: 'success', label: 'Đã duyệt', icon: <CheckCircleOutlined /> },
      REJECTED: { color: 'error', label: 'Từ chối', icon: <CloseCircleOutlined /> },
      CONVERTED: { color: 'processing', label: 'Đã tạo tin', icon: <FileTextOutlined /> },
      CANCELLED: { color: 'default', label: 'Đã hủy', icon: <CloseCircleOutlined /> },
    };
    return configs[status] || { color: 'default', label: status };
  };

  const getPriorityColor = (priority) => {
    const colors = { High: 'error', Medium: 'warning', Low: 'success' };
    return colors[priority] || 'default';
  };

  const columns = [
    {
      title: 'Vị trí',
      key: 'title',
      fixed: 'left',
      width: 220,
      render: (_, record) => (
        <div>
          <Text strong>{record.title}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.department}</Text>
        </div>
      ),
    },
    {
      title: 'Số lượng',
      dataIndex: 'positions',
      key: 'positions',
      width: 90,
      render: (val) => <Tag color="blue">{val} vị trí</Tag>,
    },
    {
      title: 'Mức ưu tiên',
      dataIndex: 'priority',
      key: 'priority',
      width: 110,
      render: (val) => <Tag color={getPriorityColor(val)}>{val}</Tag>,
    },
    {
      title: 'Cấp bậc',
      dataIndex: 'experienceLevel',
      key: 'experienceLevel',
      width: 100,
    },
    {
      title: 'Người gửi',
      dataIndex: 'submittedBy',
      key: 'submittedBy',
      width: 150,
      render: (text) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar size={24} style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />
          <Text style={{ fontSize: 13 }}>{text}</Text>
        </div>
      ),
    },
    {
      title: 'Ngày gửi',
      dataIndex: 'submittedDate',
      key: 'submittedDate',
      width: 110,
      render: (date) => dayjs(date).format('DD/MM/YYYY'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status) => {
        const config = getStatusConfig(status);
        return <Tag color={config.color} icon={config.icon}>{config.label}</Tag>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedRequest(record);
              setDetailModal(true);
            }}
          />
          {/* Recruiter/Admin: duyệt / từ chối khi PENDING; tạo tin khi đã duyệt */}
          {isRecruiter && record.status === 'PENDING' && (
            <>
              <Popconfirm
                title="Phê duyệt yêu cầu này?"
                onConfirm={() => handleReview(record, true)}
                okText="Duyệt"
                cancelText="Hủy"
              >
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
                />
              </Popconfirm>
              <Button
                type="text"
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleReview(record, false)}
              />
            </>
          )}
          {isRecruiter && record.status === 'APPROVED' && (
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
              onClick={() => navigate(`/recruiter/jobs/create?requestId=${record.id}`)}
            >
              Tạo tin
            </Button>
          )}
          {/* DM: hủy yêu cầu của mình khi còn PENDING */}
          {!isRecruiter && record.status === 'PENDING' && (
            <Popconfirm
              title="Hủy yêu cầu này?"
              onConfirm={() => handleCancel(record)}
              okText="Hủy yêu cầu"
              cancelText="Không"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const filteredData = requests.filter((item) => {
    const matchesSearch =
      !searchText ||
      item.title.toLowerCase().includes(searchText.toLowerCase()) ||
      item.department.toLowerCase().includes(searchText.toLowerCase()) ||
      item.submittedBy.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const approvedCount = requests.filter((r) => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter((r) => r.status === 'REJECTED').length;

  return (
    <div className="dept-requests-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Yêu Cầu Tuyển Dụng</Title>
          <Text type="secondary">Quản lý yêu cầu tuyển dụng từ các phòng ban</Text>
        </div>
        {!isRecruiter && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/dept/create-request')}
            style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
          >
            Tạo Yêu Cầu Mới
          </Button>
        )}
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bordered={false}>
            <Statistic title="Tổng yêu cầu" value={requests.length} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Chờ duyệt"
              value={pendingCount}
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Đã duyệt"
              value={approvedCount}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Từ chối"
              value={rejectedCount}
              valueStyle={{ color: '#f5222d' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card className="main-card" bordered={false}>
        <div className="table-toolbar">
          <div className="toolbar-left">
            <Input
              placeholder="Tìm kiếm..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 240 }}
              allowClear
            />
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 150 }}>
              <Option value="all">Tất cả trạng thái</Option>
              <Option value="PENDING">Chờ duyệt</Option>
              <Option value="APPROVED">Đã duyệt</Option>
              <Option value="REJECTED">Từ chối</Option>
              <Option value="DRAFT">Nháp</Option>
            </Select>
            <Select value={priorityFilter} onChange={setPriorityFilter} style={{ width: 130 }}>
              <Option value="all">Tất cả</Option>
              <Option value="High">Cao</Option>
              <Option value="Medium">Trung bình</Option>
              <Option value="Low">Thấp</Option>
            </Select>
          </div>
          <Text type="secondary">{filteredData.length} yêu cầu</Text>
        </div>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} yêu cầu`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextOutlined style={{ color: MATCHA_GREEN }} />
            <span>Chi tiết yêu cầu tuyển dụng</span>
          </div>
        }
        open={detailModal}
        onCancel={() => {
          setDetailModal(false);
          setSelectedRequest(null);
        }}
        footer={
          selectedRequest?.status === 'PENDING' ? (
            <Space>
              <Button onClick={() => setDetailModal(false)}>Đóng</Button>
              <Button danger icon={<CloseCircleOutlined />}>Từ chối</Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
              >
                Phê duyệt
              </Button>
            </Space>
          ) : (
            <Button onClick={() => setDetailModal(false)}>Đóng</Button>
          )
        }
        width={700}
      >
        {selectedRequest && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Title level={4}>{selectedRequest.title}</Title>
              <Space>
                <Tag color={getPriorityColor(selectedRequest.priority)}>{selectedRequest.priority}</Tag>
                {(() => { const c = getStatusConfig(selectedRequest.status); return <Tag color={c.color} icon={c.icon}>{c.label}</Tag>; })()}
              </Space>
            </div>

            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Phòng ban">{selectedRequest.department}</Descriptions.Item>
              <Descriptions.Item label="Số lượng">{selectedRequest.positions} vị trí</Descriptions.Item>
              <Descriptions.Item label="Cấp bậc">{selectedRequest.experienceLevel}</Descriptions.Item>
              <Descriptions.Item label="Hình thức">{selectedRequest.employmentType}</Descriptions.Item>
              <Descriptions.Item label="Người gửi" span={2}>{selectedRequest.submittedBy}</Descriptions.Item>
              <Descriptions.Item label="Ngày gửi" span={2}>{dayjs(selectedRequest.submittedDate).format('DD/MM/YYYY')}</Descriptions.Item>
            </Descriptions>

            <Descriptions title="Mô tả công việc" column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item>{selectedRequest.description}</Descriptions.Item>
            </Descriptions>

            <Descriptions title="Yêu cầu ứng viên" column={1} bordered size="small">
              <Descriptions.Item>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>{selectedRequest.requirements}</pre>
              </Descriptions.Item>
            </Descriptions>

            {selectedRequest.reviewNote && (
              <Descriptions title="Ghi chú của người duyệt" column={1} bordered size="small" style={{ marginTop: 16 }}>
                <Descriptions.Item>
                  {selectedRequest.reviewNote}
                  {selectedRequest.reviewedByName && (
                    <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
                      — {selectedRequest.reviewedByName}
                    </Text>
                  )}
                </Descriptions.Item>
              </Descriptions>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DeptRecruitmentRequests;
