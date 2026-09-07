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
  InputNumber,
  Select,
  Row,
  Col,
  Statistic,
  message,
  Popconfirm,
  Spin,
  Alert,
  Tooltip,
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
  hiringProposalAPI,
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import PanelSummaryCard from '../../components/PanelSummaryCard';
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
  // kèm note theo tiêu chí và ghi chú nội bộ; điểm trung bình đi kèm ở dạng % để đối chiếu,
  // nhưng đứng SAU kết luận — người quyết đọc nhận xét rồi chốt, không tự dịch một con số ra ý người chấm.
  const [detailLoading, setDetailLoading] = useState(false);
  const [brief, setBrief] = useState(null);
  const [appDetail, setAppDetail] = useState(null);
  // Điểm theo từng vòng: [{ scheduleId, panelWeightedPercent, interviewerTotals: [...] }]
  const [aggregates, setAggregates] = useState([]);
  const [cvLoading, setCvLoading] = useState(false);
  
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveNote, setApproveNote] = useState('');
  // Điều khoản ĐỀ XUẤT (Giám đốc có quyền chốt khác) — tùy chọn.
  const [proposedSalary, setProposedSalary] = useState(null);
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
        const [briefs, proposalRes] = await Promise.all([
          Promise.all(rawCandidates.map(c =>
            interviewAPI.getDecisionBrief(c.applicationId).catch(() => ({ data: null })))),
          // Đề xuất đã gửi (mọi trạng thái) — để biết hồ sơ nào đang chờ Giám đốc duyệt,
          // hồ sơ nào Giám đốc chưa duyệt và mình cần bổ sung căn cứ rồi đề xuất lại.
          hiringProposalAPI.getList().catch(() => ({ data: [] })),
        ]);

        // Đề xuất MỚI NHẤT của mỗi hồ sơ (BE trả mới nhất trước).
        const latestProposal = new Map();
        (proposalRes.data || []).forEach((p) => {
          if (!latestProposal.has(p.applicationId)) latestProposal.set(p.applicationId, p);
        });

        const formattedData = rawCandidates
          .map((c, index) => ({ card: c, brief: briefs[index].data }))
          .filter(({ brief: b }) => (b?.totalSubmitted || 0) > 0)
          .map(({ card: c, brief: b }) => {
            const proposal = latestProposal.get(c.applicationId) || null;
            return {
              id: c.applicationId,
              candidateName: c.candidateName,
              candidateEmail: c.candidateEmail,
              position: c.jobTitle,
              department: c.department || 'Chưa gán phòng ban',
              requestTitle: c.jobTitle,
              appliedDate: c.appliedAt,
              // Trạng thái ở màn này là trạng thái ĐỀ XUẤT của mình, không phải quyết định:
              // NOT_PROPOSED (chưa gửi) · PENDING (chờ Giám đốc) · REJECTED (Giám đốc chưa duyệt).
              status: proposal ? proposal.status : 'NOT_PROPOSED',
              proposal,
              avatar: null,
              candidateId: c.candidateId,
              jobId: c.jobId,
              hireCount: b.hireCount,
              considerCount: b.considerCount,
              noHireCount: b.noHireCount,
              totalSubmitted: b.totalSubmitted,
            };
          });

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

  // Trạng thái ĐỀ XUẤT của trưởng bộ phận (quyết định cuối là của Giám đốc — V043).
  const getStatusTag = (status) => {
    const config = {
      NOT_PROPOSED: { color: 'default', label: 'Chưa đề xuất', icon: <ClockCircleOutlined /> },
      PENDING: { color: 'processing', label: 'Chờ Giám đốc duyệt', icon: <ClockCircleOutlined /> },
      APPROVED: { color: 'success', label: 'Giám đốc đã duyệt', icon: <CheckCircleOutlined /> },
      REJECTED: { color: 'error', label: 'Giám đốc chưa duyệt', icon: <CloseCircleOutlined /> },
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

  const money = (v) => (v == null ? '—' : `${Number(v).toLocaleString('vi-VN')} ₫`);

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
    setAggregates([]);
    setDetailLoading(true);
    try {
      // decision-brief KHÔNG kèm điểm; điểm nằm ở interview-aggregate (trung bình có trọng số
      // của cả hội đồng + của từng người chấm). Điểm hỏng thì vẫn phải quyết được -> catch riêng.
      const [briefRes, appRes, aggRes] = await Promise.all([
        interviewAPI.getDecisionBrief(record.id),
        applicationAPI.getById(record.id),
        interviewAPI.getApplicationAggregate(record.id).catch(() => ({ data: [] })),
      ]);
      setBrief(briefRes.data || null);
      setAppDetail(appRes.data || null);
      setAggregates(aggRes.data || []);
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
      // Phiếu bị trả về: hiện luôn lời Giám đốc khi rê chuột — người dùng thấy tag đỏ là muốn
      // biết NGAY vì sao, không phải mở modal mới đọc được.
      render: (status, record) => (record.proposal?.decisionNote
        ? (
          <Tooltip title={record.proposal.decisionNote}>
            <span>{getStatusTag(status)}</span>
          </Tooltip>
        )
        : getStatusTag(status)),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space size={4}>
          <Button type="text" icon={<EyeOutlined />} onClick={() => openDetail(record)} />
          {/* Đề xuất được khi CHƯA gửi, hoặc khi Giám đốc chưa duyệt lần trước (gửi lại
              sau khi bổ sung căn cứ). Đang chờ Giám đốc thì không gửi chồng. */}
          {(record.status === 'NOT_PROPOSED' || record.status === 'REJECTED') && (
            <Button
              type="primary"
              size="small"
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
              onClick={() => openProposeModal(record)}
            >
              {record.status === 'REJECTED' ? 'Đề xuất lại' : 'Đề xuất tuyển'}
            </Button>
          )}
          {record.status !== 'APPROVED' && (
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
          )}
        </Space>
      ),
    },
  ];

  const openProposeModal = (record) => {
    setSelectedRecord(record);
    // Đề xuất LẠI thì điền sẵn phiếu cũ (V053): Giám đốc trả phiếu về thường chỉ vì một con số —
    // bắt gõ lại toàn bộ căn cứ chỉ để sửa mức lương là ép người ta viết lại từ đầu.
    setApproveNote(record?.status === 'REJECTED' ? (record.proposal?.proposalNote || '') : '');
    setProposedSalary(record?.status === 'REJECTED' ? (record.proposal?.proposedSalary ?? null) : null);
    setApproveModalOpen(true);
  };

  /**
   * Gửi ĐỀ XUẤT lên Giám đốc (V043) — trưởng bộ phận không tự chuyển hồ sơ sang bước Quyết
   * định được nữa. Giám đốc duyệt đề xuất thì hệ thống mới đẩy hồ sơ sang OFFER.
   */
  const handlePropose = async () => {
    // Mức lương BẮT BUỘC (V053): Giám đốc chỉ duyệt hoặc trả phiếu về chứ không tự điền mức —
    // phiếu trống thì chẳng có gì để duyệt, và thư mời lại rơi về cảnh nhân sự tự quyết lương.
    if (!(proposedSalary > 0)) {
      message.warning('Nhập mức lương đề xuất — đó là con số Giám đốc duyệt và thư mời sẽ dùng.');
      return;
    }
    try {
      setActionLoading(true);
      await hiringProposalAPI.create(selectedRecord.id, {
        note: approveNote || null,
        proposedSalary,
      });
      message.success(`Đã gửi đề xuất tuyển ${selectedRecord.candidateName} lên Giám đốc.`);
      setApproveModalOpen(false);
      setApproveNote('');
      fetchCandidates();
    } catch (error) {
      console.error(error);
      message.error(apiMessage(error, 'Không gửi được đề xuất tuyển'));
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

  const notProposedCount = candidates.filter((i) => i.status === 'NOT_PROPOSED').length;
  const waitingDirectorCount = candidates.filter((i) => i.status === 'PENDING').length;

  return (
    <div className="dept-hiring-decision-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Đề Xuất Tuyển</Title>
          <Text type="secondary">
            Ứng viên đã phỏng vấn xong — bạn đề xuất, Giám đốc quyết tuyển
          </Text>
        </div>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Bạn đề xuất, Giám đốc quyết"
        description="Gửi đề xuất kèm lý do (và mức lương, ngày vào làm nếu có ý kiến) để Giám đốc duyệt. Giám đốc duyệt thì hồ sơ tự sang bước Quyết định và bộ phận nhân sự soạn thư mời."
        />

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Chờ bạn đề xuất"
              value={notProposedCount}
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Chờ Giám đốc duyệt"
              value={waitingDirectorCount}
              valueStyle={{ color: '#1890ff' }}
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
              <Option value="NOT_PROPOSED">Chưa đề xuất</Option>
              <Option value="PENDING">Chờ Giám đốc duyệt</Option>
              <Option value="APPROVED">Giám đốc đã duyệt</Option>
              <Option value="REJECTED">Giám đốc chưa duyệt</Option>
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
          selectedRecord?.status !== 'APPROVED' && (
            <Button
              key="reject"
              danger
              onClick={() => {
                setDetailModalOpen(false);
                setRejectModalOpen(true);
              }}
            >
              Loại
            </Button>
          ),
          (selectedRecord?.status === 'NOT_PROPOSED' || selectedRecord?.status === 'REJECTED') && (
            <Button
              key="propose"
              type="primary"
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
              onClick={() => {
                setDetailModalOpen(false);
                openProposeModal(selectedRecord);
              }}
            >
              {selectedRecord?.status === 'REJECTED' ? 'Đề xuất lại' : 'Đề xuất tuyển'}
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

            {/* Phiếu đã gửi: hiện nguyên văn lời Giám đốc. Trước V053 màn này chỉ hiện cái tag
                "Giám đốc chưa duyệt" mà không nói vì sao — mà giờ đó là kênh DUY NHẤT Giám đốc
                báo mức lương họ muốn, nên giấu đi là bắt trưởng bộ phận đi hỏi miệng. */}
            {selectedRecord.proposal && (
              <Alert
                type={selectedRecord.status === 'REJECTED' ? 'warning'
                  : selectedRecord.status === 'APPROVED' ? 'success' : 'info'}
                showIcon
                style={{ marginBottom: 16 }}
                message={
                  selectedRecord.status === 'REJECTED'
                    ? `Giám đốc chưa duyệt${selectedRecord.proposal.decidedByName ? ` — ${selectedRecord.proposal.decidedByName}` : ''}`
                    : selectedRecord.status === 'APPROVED'
                      ? `Giám đốc đã duyệt mức ${money(selectedRecord.proposal.proposedSalary)}`
                      : `Đang chờ Giám đốc duyệt mức ${money(selectedRecord.proposal.proposedSalary)}`
                }
                description={
                  <>
                    {selectedRecord.proposal.decisionNote && (
                      <div style={{ whiteSpace: 'pre-wrap', marginBottom: 6 }}>
                        {selectedRecord.proposal.decisionNote}
                      </div>
                    )}
                    {selectedRecord.status === 'REJECTED' && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Ứng viên chưa bị loại — sửa mức lương / bổ sung căn cứ rồi bấm "Đề xuất lại".
                        {!selectedRecord.proposal.decisionNote && ' (Giám đốc không ghi lý do — hỏi lại trực tiếp.)'}
                      </Text>
                    )}
                  </>
                }
              />
            )}

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

            {/* Căn cứ để DM chốt: người phỏng vấn kết luận gì và VÌ SAO (docs 5.14) — kết luận
                đứng trước, điểm chỉ là phần bổ trợ. Điểm hiện gọn: % trung bình có trọng số của
                cả hội đồng + của từng người chấm; bảng điểm từng tiêu chí ở link bên cạnh. */}
            <Title level={5} style={{ marginTop: 24 }}>Kết luận của hội đồng phỏng vấn</Title>

            {/* Bản đọc nhanh do AI gom các phiếu (V047) — đứng TRƯỚC phiếu gốc vì nó là mục lục,
                không phải kết luận. Nó không nói nên tuyển hay không; phiếu gốc bên dưới mới là
                căn cứ chính thức. */}
            {!detailLoading && brief && brief.totalSubmitted > 0 && (
              <PanelSummaryCard applicationId={selectedRecord?.id} />
            )}

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

                {brief.rounds.map((round) => {
                  const agg = aggregates.find((a) => a.scheduleId === round.scheduleId);
                  return (
                  <div key={round.scheduleId} style={{ marginBottom: 16 }}>
                    <Space size={8} wrap>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Vòng {round.roundNumber}
                        {round.scheduledAt ? ` · ${dayjs(round.scheduledAt).format('DD/MM/YYYY HH:mm')}` : ''}
                      </Text>
                      {/* Điểm trung bình CẢ hội đồng, quy về % có trọng số — cùng công thức với
                          phiếu chấm và trang tổng hợp, nên ba nơi luôn ra một con số. */}
                      {agg && agg.submittedInterviewers > 0 && (
                        <Tag color={MATCHA_GREEN} style={{ fontSize: 12 }}>
                          Điểm hội đồng: {Math.round(agg.panelWeightedPercent)}%
                          {agg.submittedInterviewers > 1 ? ` (TB ${agg.submittedInterviewers} người chấm)` : ''}
                        </Tag>
                      )}
                      {/* Điểm không bày ở đây (xem chú thích trên), nhưng phải có đường ĐẾN nó:
                          bảng điểm từng tiêu chí + độ lệch chuẩn nằm ở trang chi tiết buổi
                          phỏng vấn, trước giờ chỉ vào được bằng cách đi vòng qua menu Lịch. */}
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0, fontSize: 12 }}
                        onClick={() => navigate(`/dept/interview/${round.scheduleId}`)}
                      >
                        Xem bảng điểm chi tiết
                      </Button>
                    </Space>

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
                              {(() => {
                                const total = agg?.interviewerTotals?.find(
                                  (t) => t.interviewerId === v.interviewerId
                                );
                                return total ? (
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {Math.round(total.weightedPercent)}%
                                  </Text>
                                ) : null;
                              })()}
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
                  );
                })}

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

      {/* Gửi đề xuất lên Giám đốc */}
      <Modal
        title="Đề Xuất Tuyển Ứng Viên"
        open={approveModalOpen}
        onOk={handlePropose}
        confirmLoading={actionLoading}
        onCancel={() => setApproveModalOpen(false)}
        okText="Gửi đề xuất"
        cancelText="Hủy"
        okButtonProps={{ style: { background: MATCHA_GREEN, borderColor: MATCHA_GREEN } }}
      >
        <p>
          Đề xuất tuyển <strong>{selectedRecord?.candidateName}</strong> cho vị trí{' '}
          <strong>{selectedRecord?.position}</strong>. Giám đốc sẽ đọc đề xuất này rồi quyết.
        </p>

        {/* Đề xuất LẠI: đặt lời nhắn của Giám đốc ngay trên ô nhập, vì đó chính là thứ phải sửa
            (V053 — Giám đốc không tự đổi mức lương nữa mà trả phiếu về kèm con số họ muốn). */}
        {selectedRecord?.status === 'REJECTED' && selectedRecord?.proposal?.decisionNote && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={`Giám đốc chưa duyệt lần trước${selectedRecord.proposal.decidedByName ? ` — ${selectedRecord.proposal.decidedByName}` : ''}`}
            description={
              <Text style={{ whiteSpace: 'pre-wrap' }}>{selectedRecord.proposal.decisionNote}</Text>
            }
          />
        )}

        <div style={{ marginTop: 16 }}>
          <Text strong>Vì sao nên tuyển người này:</Text>
          <TextArea
            rows={3}
            placeholder="VD: tay nghề chắc, từng quản lý ca 8 người, sẵn sàng đi làm ngay."
            value={approveNote}
            onChange={(e) => setApproveNote(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <Text strong>Mức lương đề xuất <span style={{ color: 'red' }}>*</span>:</Text>
          <InputNumber
            style={{ width: '100%', marginTop: 6 }}
            value={proposedSalary}
            onChange={setProposedSalary}
            min={0}
            step={1000000}
            placeholder="VD: 15000000"
            formatter={(v) => (v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '')}
            parser={(v) => (v || '').replace(/,/g, '')}
            addonAfter="₫"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Giám đốc duyệt ĐÚNG con số này (thư mời lấy y nguyên) hoặc trả phiếu về kèm mức họ
            muốn — lúc đó bạn sửa ở đây rồi gửi lại.
          </Text>
        </div>

        {/* Ngày vào làm đã BỎ khỏi phiếu đề xuất (24/08/2026): Giám đốc quyết TIỀN, không quyết
            NGÀY. Ngày onboard là kết quả cuộc gọi giữa nhân sự và ứng viên (ứng viên còn phải báo
            trước cho chỗ cũ), nên nó được nhập ở thư mời. Đoán trước cả tuần thì luôn phải sửa,
            mà đề xuất duyệt muộn vài ngày là ngày đó rơi vào quá khứ và hệ thống chặn duyệt. */}
      </Modal>

      {/* Reject Modal */}
      <Modal
        title="Loại Ứng Viên"
        open={rejectModalOpen}
        onOk={handleReject}
        confirmLoading={actionLoading}
        onCancel={() => setRejectModalOpen(false)}
        okText="Từ chối"
        okType="danger"
        cancelText="Hủy"
      >
        <p>Loại hồ sơ <strong>{selectedRecord?.candidateName}</strong>?</p>
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
