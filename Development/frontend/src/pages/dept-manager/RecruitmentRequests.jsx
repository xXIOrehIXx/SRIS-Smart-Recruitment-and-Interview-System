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
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { recruitmentRequestAPI } from '../../services/api';
import {
  employmentLabel,
  experienceText,
  formatSalaryRange,
} from '../../services/recruitmentRequest';
import { useAuth, ROLES } from '../../contexts/AuthContext';
import '../Dashboard.css';

const { Title, Text } = Typography;
const { Option } = Select;

const MATCHA_GREEN = '#5D8C3E';

const DeptRecruitmentRequests = () => {
  const navigate = useNavigate();
  // ?requestId= — vào thẳng yêu cầu vừa bấm ở Dashboard, khỏi phải dò lại trong bảng.
  const [searchParams] = useSearchParams();
  const requestIdFromUrl = Number(searchParams.get('requestId')) || null;
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailModal, setDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const { user } = useAuth();
  // Admin là superuser (khớp AuthMiddleware: [WithRole] luôn cho Admin qua) nên đứng CẢ BA
  // vai của luồng 5.17: ra đề như DM, duyệt như Giám đốc, tạo tin như nhân sự. Trước đây Admin
  // chỉ được gộp vào isRecruiter, mà các nút phía DM lại gác bằng `!isRecruiter` -> công ty 1
  // tài khoản Admin không có chỗ nào bấm "Tạo Yêu Cầu Mới".
  const isAdmin = user?.role === ROLES.ADMIN;
  // V047: NGƯỜI DUYỆT là Giám đốc, không còn là nhân sự. Nhân sự chỉ tạo tin từ yêu cầu ĐÃ duyệt
  // (backend cũng chặn — đây chỉ để ẩn nút).
  const isApprover = user?.role === ROLES.DIRECTOR || isAdmin;
  const isRecruiter = user?.role === ROLES.HUMAN_RESOURCE || isAdmin;
  const isRequester = user?.role === ROLES.DEPARTMENT_MANAGER || isAdmin;
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

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
        submittedDate: r.createdAt,
        status: r.status,
        submittedBy: r.createdByName || 'N/A',
        employmentType: r.employmentType,
        experienceLevel: r.experienceLevel,
        experienceYearsMin: r.experienceYearsMin,
        description: r.description,
        requirements: r.requirements,
        benefits: r.benefits,
        salaryMin: r.salaryMin,
        salaryMax: r.salaryMax,
        expectedStartDate: r.expectedStartDate,
        location: r.location,
        deadline: r.deadline,
        reviewNote: r.reviewNote,
        reviewedByName: r.reviewedByName,
        jobId: r.jobId,
      })));
    } catch (error) {
      console.error('Error fetching requests:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể tải danh sách yêu cầu tuyển dụng');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mở sẵn modal chi tiết khi có ?requestId — chờ danh sách tải xong mới có dữ liệu để hiện.
  // Id không nằm trong danh sách (đã xoá / khác phòng ban) thì im lặng bỏ qua, vẫn thấy bảng.
  useEffect(() => {
    if (!requestIdFromUrl || requests.length === 0) return;
    const found = requests.find((r) => r.id === requestIdFromUrl);
    if (found) {
      setSelectedRequest(found);
      setDetailModal(true);
    }
  }, [requestIdFromUrl, requests]);

  // Giám đốc duyệt / từ chối (lý do từ chối tùy chọn)
  const handleReview = async (record, approve) => {
    if (!approve) {
      let note = '';
      Modal.confirm({
        title: `Từ chối yêu cầu "${record.title}"?`,
        content: (
          <Input.TextArea rows={3} placeholder="Lý do từ chối (không bắt buộc)..."
            onChange={(e) => { note = e.target.value; }} />
        ),
        okText: 'Từ chối',
        okButtonProps: { danger: true },
        cancelText: 'Hủy',
        onOk: async () => {
          try {
            await recruitmentRequestAPI.review(record.id, false, note.trim());
            message.success('Đã từ chối yêu cầu');
            fetchRequests();
          } catch (err) {
            message.error(err?.response?.data?.userMsg || 'Không thể từ chối yêu cầu');
            return Promise.reject();
          }
        },
      });
      return;
    }
    try {
      await recruitmentRequestAPI.review(record.id, true);
      message.success('Đã phê duyệt yêu cầu — có thể tạo tin tuyển dụng từ yêu cầu này.');
      fetchRequests();
    } catch (error) {
      message.error(error?.response?.data?.userMsg || 'Không thể phê duyệt yêu cầu');
    }
  };

  // DM hủy yêu cầu của mình (chỉ khi PENDING)
  const handleCancel = async (record) => {
    try {
      await recruitmentRequestAPI.cancel(record.id);
      message.success('Đã hủy yêu cầu');
      fetchRequests();
    } catch (error) {
      message.error(error?.response?.data?.userMsg || 'Không thể hủy yêu cầu');
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
      title: 'Kinh nghiệm',
      key: 'experience',
      width: 170,
      render: (_, record) =>
        experienceText(record.experienceYearsMin, record.experienceLevel)
          || <Text type="secondary">—</Text>,
    },
    {
      title: 'Mức lương',
      key: 'salary',
      width: 190,
      render: (_, record) => {
        const range = formatSalaryRange(record.salaryMin, record.salaryMax);
        return range
          ? <Text style={{ fontSize: 13 }}>{range}</Text>
          : <Text type="secondary">Thỏa thuận</Text>;
      },
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
          {/* Giám đốc/Admin: duyệt / từ chối khi PENDING */}
          {isApprover && record.status === 'PENDING' && (
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
          {/* Nhân sự/Admin: tạo tin tuyển dụng từ yêu cầu ĐÃ được Giám đốc duyệt */}
          {isRecruiter && record.status === 'APPROVED' && (
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
              onClick={() => navigate(`/human-resource/jobs/create?requestId=${record.id}`)}
            >
              Tạo tin
            </Button>
          )}
          {/* DM (và Admin): sửa lại đề bài khi Giám đốc chưa duyệt (duyệt xong BE khóa để giữ audit) */}
          {isRequester && record.status === 'PENDING' && (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              title="Sửa yêu cầu"
              onClick={() => navigate(`/dept/edit-request/${record.id}`)}
            />
          )}
          {/* DM (và Admin): hủy yêu cầu khi còn PENDING */}
          {isRequester && record.status === 'PENDING' && (
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
    return matchesSearch && matchesStatus;
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
        {isRequester && (
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
              {/* Cộng dồn chứ không loại trừ nhau: Admin vừa sửa được đề bài vừa duyệt được. */}
              {isRequester && (
                <Button
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/dept/edit-request/${selectedRequest.id}`)}
                >
                  Sửa yêu cầu
                </Button>
              )}
              {isRecruiter && (
                <>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => {
                      const record = selectedRequest;
                      setDetailModal(false);
                      handleReview(record, false);
                    }}
                  >
                    Từ chối
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
                    onClick={() => {
                      const record = selectedRequest;
                      setDetailModal(false);
                      handleReview(record, true);
                    }}
                  >
                    Phê duyệt
                  </Button>
                </>
              )}
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
                {(() => { const c = getStatusConfig(selectedRequest.status); return <Tag color={c.color} icon={c.icon}>{c.label}</Tag>; })()}
              </Space>
            </div>

            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Phòng ban">{selectedRequest.department}</Descriptions.Item>
              <Descriptions.Item label="Số lượng">{selectedRequest.positions} vị trí</Descriptions.Item>
              <Descriptions.Item label="Kinh nghiệm">
                {experienceText(selectedRequest.experienceYearsMin, selectedRequest.experienceLevel)
                  || <Text type="secondary">Không yêu cầu cụ thể</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Hình thức">
                {employmentLabel(selectedRequest.employmentType) || <Text type="secondary">—</Text>}
              </Descriptions.Item>
              {/* Lương DM đề xuất — HR cần thấy để cân đối trước khi ra tin đăng. */}
              <Descriptions.Item label="Mức lương đề xuất" span={2}>
                {formatSalaryRange(selectedRequest.salaryMin, selectedRequest.salaryMax)
                  || <Text type="secondary">Thỏa thuận</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Địa điểm làm việc" span={2}>
                {selectedRequest.location || <Text type="secondary">Chưa ghi</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Hạn nộp đơn" span={2}>
                {selectedRequest.deadline
                  ? dayjs(selectedRequest.deadline).format('DD/MM/YYYY')
                  : <Text type="secondary">Chưa xác định</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày cần tuyển" span={2}>
                {selectedRequest.expectedStartDate
                  ? dayjs(selectedRequest.expectedStartDate).format('DD/MM/YYYY')
                  : <Text type="secondary">Chưa xác định</Text>}
              </Descriptions.Item>
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

            {/* DM nhập được quyền lợi nhưng trước đây không hiện ở đâu — HR cần để soạn tin đăng. */}
            {selectedRequest.benefits && (
              <Descriptions title="Quyền lợi" column={1} bordered size="small" style={{ marginTop: 16 }}>
                <Descriptions.Item>
                  <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>{selectedRequest.benefits}</pre>
                </Descriptions.Item>
              </Descriptions>
            )}

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
