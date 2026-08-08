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
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  dashboardAPI,
  applicationAPI,
  interviewAPI,
  cvAPI,
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import '../Dashboard.css';

// Thông báo lỗi từ BE (ErrorObjectCommon) — hiện đúng câu BE trả về, ví dụ 403 khi
// DM bấm duyệt hồ sơ thuộc phòng ban khác.
const apiMessage = (error, fallback) =>
  error?.response?.data?.userMsg || error?.response?.data?.UserMsg || fallback;

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const MATCHA_GREEN = '#5D8C3E';

const HiringDecision = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);
  
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  // Chi tiết để DM quyết: KẾT LUẬN của người phỏng vấn (nên tuyển hay không + vì sao)
  // kèm note theo tiêu chí và ghi chú nội bộ. KHÔNG có điểm số — người quyết đọc nhận
  // xét rồi chốt, chứ không phải tự dịch một con số trung bình ra ý người chấm.
  const [detailLoading, setDetailLoading] = useState(false);
  const [brief, setBrief] = useState(null);
  const [appDetail, setAppDetail] = useState(null);
  const [cvLoading, setCvLoading] = useState(false);
  
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
      // Lấy danh sách từ Kanban, đặc biệt là cột INTERVIEW (chờ duyệt)
      const res = await dashboardAPI.getKanban();
      
      const interviewColumn = res.data.columns.find(c => c.state === 'INTERVIEW');
      
      if (interviewColumn) {
        // V023: BE (DashboardRepo) đã thu hẹp về đúng phòng ban của DM đang đăng nhập —
        // FE không lọc lại, tránh 2 nơi giữ cùng một luật.
        
        // Chỉ hiện hồ sơ ĐÃ CÓ phiếu phỏng vấn nộp — chưa ai chấm thì không có gì để quyết.
        const rawCandidates = interviewColumn.cards;
        const briefs = await Promise.all(
          rawCandidates.map(c => interviewAPI.getDecisionBrief(c.applicationId).catch(() => ({ data: null })))
        );

        const formattedData = rawCandidates
          .map((c, index) => ({ card: c, brief: briefs[index].data }))
          .filter(({ brief: b }) => (b?.totalSubmitted || 0) > 0)
          .map(({ card: c, brief: b }) => ({
            id: c.applicationId,
            candidateName: c.candidateName,
            candidateEmail: c.candidateEmail,
            position: c.jobTitle,
            department: c.department || 'Chưa gán phòng ban',
            requestTitle: c.jobTitle,
            appliedDate: c.appliedAt,
            status: 'PENDING',
            avatar: null,
            candidateId: c.candidateId,
            jobId: c.jobId,
            hireCount: b.hireCount,
            considerCount: b.considerCount,
            noHireCount: b.noHireCount,
            totalSubmitted: b.totalSubmitted,
          }));

        setCandidates(formattedData);
      } else {
        setCandidates([]);
      }
    } catch (error) {
      console.error('Lỗi khi tải danh sách ứng viên:', error);
      message.error(apiMessage(error, 'Không thể tải danh sách quyết định tuyển dụng'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  // Human Resource/DM gửi offer ở màn khác -> hồ sơ rơi vào cột OFFER; quay lại tab này là thấy ngay.
  useRefreshOnFocus(() => fetchCandidates());

  const getStatusTag = (status) => {
    const config = {
      PENDING: { color: 'warning', label: 'Chờ duyệt (Phỏng vấn)', icon: <ClockCircleOutlined /> },
      APPROVED: { color: 'success', label: 'Đã duyệt', icon: <CheckCircleOutlined /> },
      REJECTED: { color: 'error', label: 'Từ chối', icon: <CloseCircleOutlined /> },
    };
    const c = config[status] || { color: 'default', label: status };
    return <Tag color={c.color} icon={c.icon}>{c.label}</Tag>;
  };

  // Kết luận của người phỏng vấn — 4 mức, cùng bộ nhãn với phiếu chấm bên Interviewer.
  const recommendationTag = (value) => {
    const map = {
      STRONG_HIRE: { color: 'success', label: 'Rất nên tuyển' },
      HIRE: { color: 'success', label: 'Nên tuyển' },
      CONSIDER: { color: 'warning', label: 'Cân nhắc' },
      NO_HIRE: { color: 'error', label: 'Không nên tuyển' },
    };
    const c = map[value];
    if (!c) return <Tag>Chưa ghi kết luận</Tag>;
    return <Tag color={c.color}>{c.label}</Tag>;
  };

  /// Tóm tắt 1 dòng: "2/3 nên tuyển" — đủ để lướt bảng, chi tiết xem trong modal.
  const verdictSummary = (record) => {
    if (!record.totalSubmitted) return <Text type="secondary">—</Text>;
    const color = record.noHireCount > 0 ? 'warning' : 'success';
    return (
      <Space size={4} wrap>
        <Tag color={color}>{record.hireCount}/{record.totalSubmitted} nên tuyển</Tag>
        {record.noHireCount > 0 && <Tag color="error">{record.noHireCount} phản đối</Tag>}
      </Space>
    );
  };

  const openDetail = async (record) => {
    setSelectedRecord(record);
    setDetailModalOpen(true);
    setBrief(null);
    setAppDetail(null);
    setDetailLoading(true);
    try {
      const [briefRes, appRes] = await Promise.all([
        interviewAPI.getDecisionBrief(record.id),
        applicationAPI.getById(record.id),
      ]);
      setBrief(briefRes.data || null);
      setAppDetail(appRes.data || null);
    } catch (error) {
      console.error(error);
      message.error(apiMessage(error, 'Không tải được chi tiết ứng viên'));
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
      // Điểm CV/AI là công cụ sàng lọc của Human Resource — DM quyết theo tiêu chí phỏng vấn,
      // xem trong modal chi tiết. Ở bảng chỉ cần biết hồ sơ thuộc phòng nào.
      title: 'Phòng ban',
      dataIndex: 'department',
      key: 'department',
      width: 160,
    },
    {
      title: 'Phỏng vấn kết luận',
      key: 'verdict',
      width: 190,
      render: (_, record) => verdictSummary(record),
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
          <Button type="text" icon={<EyeOutlined />} onClick={() => openDetail(record)} />
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
      await applicationAPI.transition(selectedRecord.id, 'OFFER');
      if (approveNote) {
        await applicationAPI.addNote(selectedRecord.id, `[QUYẾT ĐỊNH TUYỂN DỤNG] Đồng ý tuyển: ${approveNote}`);
      }
      message.success(`Đã duyệt tuyển dụng cho ứng viên ${selectedRecord.candidateName}`);
      setApproveModalOpen(false);
      setApproveNote('');
      fetchCandidates();
    } catch (error) {
      console.error(error);
      message.error(apiMessage(error, 'Lỗi khi duyệt ứng viên'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      setActionLoading(true);
      // Endpoint reject riêng — reason tùy chọn, ghi vào reject_reason nếu có nhập.
      await applicationAPI.reject(selectedRecord.id, rejectReason);

      message.success(`Đã từ chối ứng viên ${selectedRecord.candidateName}`);
      setRejectModalOpen(false);
      setRejectReason('');
      fetchCandidates();
    } catch (error) {
      console.error(error);
      message.error(apiMessage(error, 'Lỗi khi từ chối ứng viên'));
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
          <Text type="secondary">Xét duyệt các ứng viên đã qua vòng phỏng vấn (Cột INTERVIEW)</Text>
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
              <Descriptions.Item label="Phòng ban">{selectedRecord.department}</Descriptions.Item>
              <Descriptions.Item label="Ngày ứng tuyển">
                {dayjs(selectedRecord.appliedDate).format('DD/MM/YYYY')}
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

            {/* Căn cứ để DM chốt: người phỏng vấn kết luận gì và VÌ SAO (docs 5.14).
                Cố tình không bày điểm — điểm là công cụ của người chấm, không phải của người quyết. */}
            <Title level={5} style={{ marginTop: 24 }}>Kết luận của hội đồng phỏng vấn</Title>

            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
            ) : !brief || brief.totalSubmitted === 0 ? (
              <Text type="secondary">
                Chưa có phiếu phỏng vấn nào được nộp — chưa có căn cứ để quyết (blind review).
              </Text>
            ) : (
              <>
                <Space size={8} wrap style={{ marginBottom: 16 }}>
                  <Tag color={brief.hireCount > 0 ? 'success' : 'default'} style={{ fontSize: 13, padding: '4px 10px' }}>
                    {brief.hireCount}/{brief.totalSubmitted} nên tuyển
                  </Tag>
                  {brief.considerCount > 0 && (
                    <Tag color="warning" style={{ fontSize: 13, padding: '4px 10px' }}>
                      {brief.considerCount} cân nhắc
                    </Tag>
                  )}
                  {brief.noHireCount > 0 && (
                    <Tag color="error" style={{ fontSize: 13, padding: '4px 10px' }}>
                      {brief.noHireCount} không nên tuyển
                    </Tag>
                  )}
                </Space>

                {brief.rounds.map((round) => (
                  <div key={round.scheduleId} style={{ marginBottom: 16 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Vòng {round.roundNumber}
                      {round.scheduledAt ? ` · ${dayjs(round.scheduledAt).format('DD/MM/YYYY HH:mm')}` : ''}
                    </Text>

                    {round.verdicts.length === 0 ? (
                      <div style={{ marginTop: 6 }}>
                        <Text type="secondary">Chưa ai nộp phiếu ở vòng này.</Text>
                      </div>
                    ) : (
                      round.verdicts.map((v) => (
                        <Card
                          key={v.interviewerId}
                          size="small"
                          style={{ marginTop: 8 }}
                          title={
                            <Space wrap>
                              <Text strong>{v.interviewerName || `#${v.interviewerId}`}</Text>
                              {recommendationTag(v.recommendation)}
                            </Space>
                          }
                        >
                          {v.summary ? (
                            <Text style={{ whiteSpace: 'pre-wrap' }}>{v.summary}</Text>
                          ) : (
                            <Text type="secondary">Không ghi nhận xét tổng.</Text>
                          )}

                          {v.notes.length > 0 && (
                            <div style={{ marginTop: 10 }}>
                              {v.notes.map((n, i) => (
                                <div key={i} style={{ marginBottom: 4 }}>
                                  <Text type="secondary" style={{ fontSize: 12 }}>{n.criteriaName}: </Text>
                                  <Text style={{ fontSize: 13 }}>“{n.note}”</Text>
                                </div>
                              ))}
                            </div>
                          )}
                        </Card>
                      ))
                    )}
                  </div>
                ))}

                {brief.internalNotes.length > 0 && (
                  <>
                    <Title level={5} style={{ marginTop: 20 }}>Ghi chú nội bộ</Title>
                    {brief.internalNotes.map((n, i) => (
                      <div key={i} style={{ marginBottom: 8 }}>
                        <Text style={{ fontSize: 13 }}>{n.content}</Text>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {n.authorName || 'Không rõ'}
                            {n.createdAt ? ` · ${dayjs(n.createdAt).format('DD/MM/YYYY HH:mm')}` : ''}
                          </Text>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
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
            placeholder="Nhập lý do từ chối (không bắt buộc)..."
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
