import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Table,
  Button,
  Space,
  Modal,
  Descriptions,
  Avatar,
  Input,
  Row,
  Col,
  Statistic,
  message,
  Alert,
} from 'antd';
import {
  CheckCircleOutlined,
  EyeOutlined,
  SearchOutlined,
  UserOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { dashboardAPI, applicationAPI, cvAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import '../Dashboard.css';

// Thông báo lỗi từ BE (ErrorObjectCommon) — hiện đúng câu BE trả về, ví dụ 403 khi
// DM bấm duyệt hồ sơ thuộc vị trí người khác phụ trách.
const apiMessage = (error, fallback) =>
  error?.response?.data?.userMsg || error?.response?.data?.UserMsg || fallback;

const { Title, Text } = Typography;
const { TextArea } = Input;

const MATCHA_GREEN = '#5D8C3E';

/**
 * Duyệt ứng viên vào vòng phỏng vấn — cửa của Trưởng bộ phận (docs 5.8, chốt 15/08/2026).
 *
 * Bộ phận nhân sự sàng lọc hồ sơ và giữ cột Sàng lọc, nhưng CHỌN ai đáng gặp là chuyên môn
 * của trưởng bộ phận; nhân sự chỉ xếp lịch cho người đã duyệt. Vì vậy màn này chỉ có 2 nút:
 * "Duyệt vào phỏng vấn" (SCREENING→INTERVIEW) và "Loại".
 */
const ScreeningApproval = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [appDetail, setAppDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cvLoading, setCvLoading] = useState(false);

  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [approveNote, setApproveNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [searchText, setSearchText] = useState('');

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      // Cột SÀNG LỌC của Kanban. BE (DashboardRepo) đã thu hẹp về đúng vị trí DM đang đăng nhập
      // phụ trách — FE không lọc lại, tránh 2 nơi giữ cùng một luật.
      const res = await dashboardAPI.getKanban();
      const screeningColumn = res.data.columns.find((c) => c.state === 'SCREENING');

      setCandidates(
        (screeningColumn?.cards || []).map((c) => ({
          id: c.applicationId,
          candidateName: c.candidateName,
          candidateEmail: c.candidateEmail,
          position: c.jobTitle,
          department: c.department || 'Chưa gán phòng ban',
          appliedDate: c.appliedAt,
          candidateId: c.candidateId,
          jobId: c.jobId,
        }))
      );
    } catch (error) {
      console.error('Lỗi khi tải danh sách hồ sơ chờ duyệt:', error);
      message.error(apiMessage(error, 'Không thể tải danh sách hồ sơ chờ duyệt'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  // Nhân sự có thể vừa đẩy thêm hồ sơ sang Sàng lọc ở tab khác — quay lại tab này là thấy ngay.
  useRefreshOnFocus(() => fetchCandidates());

  const openDetail = async (record) => {
    setSelectedRecord(record);
    setDetailModalOpen(true);
    setAppDetail(null);
    setDetailLoading(true);
    try {
      const res = await applicationAPI.getById(record.id);
      setAppDetail(res.data || null);
    } catch (error) {
      console.error(error);
      message.error(apiMessage(error, 'Không tải được chi tiết hồ sơ'));
    } finally {
      setDetailLoading(false);
    }
  };

  // CV gốc nằm trên MinIO — BE trả URL presigned (~1h), mở tab mới để xem PDF.
  const openCv = async () => {
    if (!appDetail?.cvId) return;
    try {
      setCvLoading(true);
      const res = await cvAPI.getCvFileUrl(appDetail.cvId);
      const url = res.data?.url;
      if (!url) {
        message.warning('Hồ sơ này không có file CV gốc.');
        return;
      }
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      console.error(error);
      message.error(apiMessage(error, 'Không mở được file CV'));
    } finally {
      setCvLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      await applicationAPI.transition(selectedRecord.id, 'INTERVIEW');
      if (approveNote) {
        await applicationAPI.addNote(
          selectedRecord.id,
          `[DUYỆT VÀO PHỎNG VẤN] ${approveNote}`
        );
      }
      message.success(
        `Đã duyệt ${selectedRecord.candidateName} vào vòng phỏng vấn — bộ phận nhân sự sẽ xếp lịch.`
      );
      setApproveModalOpen(false);
      setApproveNote('');
      fetchCandidates();
    } catch (error) {
      console.error(error);
      message.error(apiMessage(error, 'Lỗi khi duyệt ứng viên vào vòng phỏng vấn'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      setActionLoading(true);
      // Endpoint reject riêng — reason tùy chọn, ghi vào reject_reason nếu có nhập.
      await applicationAPI.reject(selectedRecord.id, rejectReason);
      message.success(`Đã loại hồ sơ ${selectedRecord.candidateName}`);
      setRejectModalOpen(false);
      setRejectReason('');
      fetchCandidates();
    } catch (error) {
      console.error(error);
      message.error(apiMessage(error, 'Lỗi khi loại hồ sơ'));
    } finally {
      setActionLoading(false);
    }
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
    { title: 'Vị trí', dataIndex: 'position', key: 'position', width: 170 },
    { title: 'Phòng ban', dataIndex: 'department', key: 'department', width: 160 },
    {
      title: 'Ngày ứng tuyển',
      dataIndex: 'appliedDate',
      key: 'appliedDate',
      width: 130,
      render: (date) => (date ? dayjs(date).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: 250,
      render: (_, record) => (
        <Space size={4}>
          <Button type="text" icon={<EyeOutlined />} onClick={() => openDetail(record)} />
          <Button
            type="primary"
            size="small"
            style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
            onClick={() => {
              setSelectedRecord(record);
              setApproveModalOpen(true);
            }}
          >
            Duyệt vào phỏng vấn
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
        </Space>
      ),
    },
  ];

  const filteredData = candidates.filter(
    (item) =>
      !searchText ||
      item.candidateName.toLowerCase().includes(searchText.toLowerCase()) ||
      (item.position || '').toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="dept-screening-approval-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Duyệt Ứng Viên Vào Phỏng Vấn</Title>
          <Text type="secondary">
            Hồ sơ đã qua sàng lọc của bộ phận nhân sự — bạn chọn ai được vào vòng phỏng vấn
          </Text>
        </div>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Duyệt xong là xong việc của bạn"
        description="Ứng viên được duyệt sẽ hiện ở màn Lịch Phỏng Vấn của bộ phận nhân sự để họ xếp lịch và mời. Bạn không cần đặt lịch."
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Chờ bạn duyệt"
              value={candidates.length}
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
          </div>
          <Text type="secondary">{filteredData.length} hồ sơ</Text>
        </div>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1000 }}
          locale={{ emptyText: 'Chưa có hồ sơ nào chờ bạn duyệt' }}
        />
      </Card>

      {/* Chi tiết hồ sơ — căn cứ để duyệt là CV + thông tin liên hệ, chưa có phiếu chấm nào ở bước này */}
      <Modal
        title="Chi Tiết Hồ Sơ"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>Đóng</Button>,
          <Button
            key="reject"
            danger
            onClick={() => {
              setDetailModalOpen(false);
              setRejectModalOpen(true);
            }}
          >
            Loại
          </Button>,
          <Button
            key="approve"
            type="primary"
            style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
            onClick={() => {
              setDetailModalOpen(false);
              setApproveModalOpen(true);
            }}
          >
            Duyệt vào phỏng vấn
          </Button>,
        ]}
        width={640}
      >
        {selectedRecord && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              <Avatar size={64} style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />
              <div>
                <Title level={4} style={{ margin: 0 }}>{selectedRecord.candidateName}</Title>
                <Text type="secondary">{selectedRecord.candidateEmail}</Text>
              </div>
            </div>

            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Vị trí ứng tuyển" span={2}>
                <Text strong>{selectedRecord.position}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Phòng ban">{selectedRecord.department}</Descriptions.Item>
              <Descriptions.Item label="Ngày ứng tuyển">
                {selectedRecord.appliedDate
                  ? dayjs(selectedRecord.appliedDate).format('DD/MM/YYYY')
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Điện thoại" span={2}>
                {appDetail?.candidatePhone || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="CV ứng viên" span={2}>
                <Space>
                  <Button
                    icon={<FileTextOutlined />}
                    onClick={openCv}
                    loading={cvLoading}
                    disabled={detailLoading || !appDetail?.cvId}
                  >
                    Xem CV gốc
                  </Button>
                  {appDetail?.cvFileName && (
                    <Text type="secondary" style={{ fontSize: 12 }}>{appDetail.cvFileName}</Text>
                  )}
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>

      {/* Duyệt */}
      <Modal
        title="Duyệt Vào Vòng Phỏng Vấn"
        open={approveModalOpen}
        onOk={handleApprove}
        confirmLoading={actionLoading}
        onCancel={() => setApproveModalOpen(false)}
        okText="Duyệt"
        cancelText="Hủy"
        okButtonProps={{
          icon: <CheckCircleOutlined />,
          style: { background: MATCHA_GREEN, borderColor: MATCHA_GREEN },
        }}
      >
        <p>
          Đưa <strong>{selectedRecord?.candidateName}</strong> vào vòng phỏng vấn? Bộ phận nhân sự
          sẽ nhận được hồ sơ này để xếp lịch.
        </p>
        <div style={{ marginTop: 16 }}>
          <Text strong>Ghi chú cho bộ phận nhân sự:</Text>
          <TextArea
            rows={3}
            placeholder="Ví dụ: cần hỏi kỹ kinh nghiệm quản lý ca..."
            value={approveNote}
            onChange={(e) => setApproveNote(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>

      {/* Loại */}
      <Modal
        title="Loại Hồ Sơ"
        open={rejectModalOpen}
        onOk={handleReject}
        confirmLoading={actionLoading}
        onCancel={() => setRejectModalOpen(false)}
        okText="Loại"
        okType="danger"
        cancelText="Hủy"
      >
        <p>Loại hồ sơ <strong>{selectedRecord?.candidateName}</strong>?</p>
        <div style={{ marginTop: 16 }}>
          <Text strong>Lý do (không bắt buộc):</Text>
          <TextArea
            rows={3}
            placeholder="Ví dụ: chưa đủ kinh nghiệm mảng bếp nóng..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default ScreeningApproval;
