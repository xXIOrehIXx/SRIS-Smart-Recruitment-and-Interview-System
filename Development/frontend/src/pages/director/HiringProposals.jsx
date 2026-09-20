import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Table, Tag, Button, Space, Modal, Descriptions, Avatar, Input,
  InputNumber, Row, Col, Statistic, message, Spin, Segmented, Alert,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, SearchOutlined,
  UserOutlined, ClockCircleOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  hiringProposalAPI, interviewAPI, applicationAPI, cvAPI,
} from '../../services/api';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import PanelSummaryCard from '../../components/PanelSummaryCard';
import '../Dashboard.css';

const apiMessage = (error, fallback) =>
  error?.response?.data?.userMsg || error?.response?.data?.UserMsg || fallback;

const { Title, Text } = Typography;
const { TextArea } = Input;

const MATCHA_GREEN = '#5D8C3E';

const vnd = (v) => `${Number(v).toLocaleString('vi-VN')} ₫`;

/**
 * Đối chiếu mức lương sắp chốt với khung lương của vị trí.
 *
 * HAI NGUỒN, theo thứ tự:
 *   1. `job`     — khung ĐĂNG TRÊN TIN (Job.salary_min/max). Đây là con số đã hứa CÔNG KHAI:
 *                  ứng viên đọc được trước khi nộp hồ sơ.
 *   2. `request` — khung trong YÊU CẦU TUYỂN DỤNG đã sinh ra tin (V056). Chỉ dùng khi tin đăng
 *                  "lương thỏa thuận": công ty cố ý không công khai lương, nhưng bên trong DM
 *                  vẫn ghi ngân sách và chính Giám đốc đã duyệt con số đó lúc duyệt yêu cầu.
 *                  Khung NỘI BỘ — vượt nó là chuyện ngân sách, không phải chuyện thất hứa.
 *   3. không có gì -> status 'none'. VẪN trả về một object (không trả null) để màn duyệt NÓI RA
 *      rằng vị trí này thỏa thuận: im lặng thì Giám đốc không phân biệt được "tin thỏa thuận"
 *      với "màn hình lỗi, chưa tải được khung".
 *
 * Luôn chỉ CẢNH BÁO, không chặn: quyền chốt lương là của Giám đốc (V057) và có lý do chính đáng
 * để ra ngoài khung. Nhưng chốt ra ngoài mà KHÔNG BIẾT thì đến lúc nhân sự gửi thư mời mới vỡ.
 */
const checkSalaryBand = (proposal, salary) => {
  if (!proposal) return null;

  let min = proposal.jobSalaryMin;
  let max = proposal.jobSalaryMax;
  let source = 'job';

  if (min == null && max == null) {
    min = proposal.requestSalaryMin;
    max = proposal.requestSalaryMax;
    source = 'request';
  }
  // Tin thỏa thuận VÀ yêu cầu tuyển dụng cũng bỏ trống -> không có gì để so.
  if (min == null && max == null) return { status: 'none', source: 'none' };

  const label = min != null && max != null
    ? `${vnd(min)} – ${vnd(max)}`
    : min != null ? `từ ${vnd(min)}` : `tối đa ${vnd(max)}`;

  const base = { label, min, max, source };
  if (!(salary > 0)) return { ...base, status: 'unknown' };
  if (min != null && salary < min) return { ...base, status: 'below', gap: min - salary };
  if (max != null && salary > max) return { ...base, status: 'above', gap: salary - max };
  return { ...base, status: 'inside' };
};

/** Khung này ở đâu ra — dùng chung cho nhãn Alert và câu hỏi lại. */
const BAND_SOURCE_LABEL = {
  job: 'Khung lương đăng trên tin',
  request: 'Khung lương trong Yêu cầu tuyển dụng (tin đăng thỏa thuận)',
};

const STATUS_TAG = {
  PENDING: { color: 'warning', label: 'Chờ bạn duyệt', icon: <ClockCircleOutlined /> },
  APPROVED: { color: 'success', label: 'Đã duyệt tuyển', icon: <CheckCircleOutlined /> },
  REJECTED: { color: 'error', label: 'Chưa duyệt', icon: <CloseCircleOutlined /> },
};

/**
 * Duyệt đề xuất tuyển — màn của GIÁM ĐỐC (docs 5.14, V043 — chốt 15/08/2026).
 *
 * Trưởng bộ phận đọc kết luận hội đồng phỏng vấn rồi đề xuất "nên tuyển người này" KÈM mức
 * lương; Giám đốc là người quyết. Duyệt ở đây = hồ sơ sang bước Quyết định với mức lương
 * Giám đốc CHỐT — bộ phận nhân sự lấy con số đó soạn thư mời, không phải hỏi lại.
 *
 * V057 (15/09/2026, đảo V053): ô "lương chốt" quay lại, điền sẵn mức trưởng bộ phận đề xuất.
 * Giám đốc ưng thì bấm duyệt luôn, không ưng thì sửa số rồi duyệt — không phải trả phiếu về
 * chờ trưởng bộ phận gõ hộ đúng con số mình đã biết.
 */
const HiringProposals = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [searchText, setSearchText] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [brief, setBrief] = useState(null);
  const [appDetail, setAppDetail] = useState(null);
  const [cvLoading, setCvLoading] = useState(false);

  const [decisionOpen, setDecisionOpen] = useState(false);
  const [approving, setApproving] = useState(true);
  const [decisionNote, setDecisionNote] = useState('');
  const [salary, setSalary] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchProposals = async (status = statusFilter) => {
    try {
      setLoading(true);
      const res = await hiringProposalAPI.getList(status === 'ALL' ? undefined : status);
      setProposals(res.data || []);
    } catch (error) {
      console.error(error);
      message.error(apiMessage(error, 'Không tải được danh sách đề xuất tuyển'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // Trưởng bộ phận vừa gửi đề xuất ở tab khác — quay lại tab này là thấy ngay.
  useRefreshOnFocus(() => fetchProposals(statusFilter));

  const openDetail = async (record) => {
    setSelected(record);
    setDetailOpen(true);
    setBrief(null);
    setAppDetail(null);
    setDetailLoading(true);
    try {
      // Căn cứ để quyết: kết luận của hội đồng phỏng vấn (không kèm điểm — 5.7) + hồ sơ gốc.
      const [briefRes, appRes] = await Promise.all([
        interviewAPI.getDecisionBrief(record.applicationId).catch(() => ({ data: null })),
        applicationAPI.getById(record.applicationId).catch(() => ({ data: null })),
      ]);
      setBrief(briefRes.data || null);
      setAppDetail(appRes.data || null);
    } finally {
      setDetailLoading(false);
    }
  };

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

  const openDecision = (record, approve) => {
    setSelected(record);
    setApproving(approve);
    setDecisionNote('');
    // Điền sẵn mức trưởng bộ phận đề xuất — Giám đốc gật đầu hoặc sửa ngay tại chỗ (V057).
    setSalary(record.proposedSalary ?? null);
    setDecisionOpen(true);
  };

  const submitDecision = async () => {
    // Chưa duyệt thì PHẢI nói vì sao: phiếu quay về bàn trưởng bộ phận và ghi chú này là thứ
    // duy nhất họ đọc được để biết phải bổ sung gì.
    if (!approving && !decisionNote.trim()) {
      message.warning('Ghi rõ vì sao chưa duyệt để trưởng bộ phận biết phải bổ sung gì.');
      return;
    }
    if (approving && !(salary > 0)) {
      message.warning('Nhập mức lương chốt — đó là con số thư mời sẽ dùng.');
      return;
    }

    // Lệch khung lương đã đăng trên tin -> HỎI LẠI một lần. Không chặn (Giám đốc có quyền chốt
    // ngoài khung), nhưng cũng không để lọt im lặng: thư mời gửi đi rồi mới phát hiện thì đã muộn.
    const band = approving ? checkSalaryBand(selected, salary) : null;
    if (band && (band.status === 'above' || band.status === 'below')) {
      const fromRequest = band.source === 'request';
      Modal.confirm({
        title: fromRequest
          ? 'Mức lương chốt vượt ngân sách của yêu cầu tuyển dụng'
          : 'Mức lương chốt nằm ngoài khung đăng trên tin',
        okText: 'Vẫn duyệt mức này',
        cancelText: 'Để tôi sửa lại',
        okButtonProps: { style: { background: MATCHA_GREEN, borderColor: MATCHA_GREEN } },
        content: (
          <div>
            <p style={{ marginBottom: 8 }}>
              {fromRequest ? (
                <>
                  Tin <strong>{selected?.jobTitle}</strong> đăng <strong>lương thỏa thuận</strong>,
                  nhưng Yêu cầu tuyển dụng ghi ngân sách <strong>{band.label}</strong>.
                </>
              ) : (
                <>
                  Tin tuyển dụng <strong>{selected?.jobTitle}</strong> ghi khung lương{' '}
                  <strong>{band.label}</strong>.
                </>
              )}
            </p>
            <p style={{ marginBottom: 8 }}>
              Bạn đang chốt <strong>{vnd(salary)}</strong> —{' '}
              {band.status === 'above' ? 'cao hơn trần' : 'thấp hơn sàn'}{' '}
              <strong>{vnd(band.gap)}</strong>.
            </p>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {fromRequest
                // Tin thỏa thuận -> ứng viên chưa đọc con số nào, chỉ là chuyện ngân sách nội bộ.
                ? 'Ứng viên chưa biết con số nào (tin đăng thỏa thuận) nên không có chuyện lệch so với lời hứa — chỉ là mức này ra ngoài ngân sách bộ phận đã trình. Nên ghi lý do ở ô ghi chú.'
                : band.status === 'above'
                  ? 'Duyệt được, nhưng mức này vượt khung đã đăng cho vị trí — cân nhắc ghi lý do ở ô ghi chú để bộ phận nhân sự nắm.'
                  : 'Duyệt được, nhưng đây là mức thấp hơn con số đã đăng công khai — ứng viên có thể đã đọc khung lương đó trước khi ứng tuyển.'}
            </Text>
          </div>
        ),
        onOk: () => sendDecision(),
      });
      return;
    }

    await sendDecision();
  };

  const sendDecision = async () => {
    try {
      setActionLoading(true);
      await hiringProposalAPI.decide(selected.proposalId, {
        approve: approving,
        note: decisionNote.trim() || null,
        approvedSalary: approving ? salary : null,
      });
      message.success(approving
        ? `Đã duyệt tuyển ${selected.candidateName} — bộ phận nhân sự sẽ soạn thư mời.`
        : `Đã ghi nhận: chưa duyệt đề xuất cho ${selected.candidateName}.`);
      setDecisionOpen(false);
      fetchProposals(statusFilter);
    } catch (error) {
      console.error(error);
      message.error(apiMessage(error, 'Không ghi được quyết định'));
    } finally {
      setActionLoading(false);
    }
  };

  const money = (v) => (v == null ? '—' : `${Number(v).toLocaleString('vi-VN')} ₫`);

  const columns = [
    {
      title: 'Ứng viên',
      key: 'candidate',
      fixed: 'left',
      width: 220,
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />
          <div>
            <Text strong>{r.candidateName}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{r.candidateEmail}</Text>
          </div>
        </div>
      ),
    },
    { title: 'Vị trí', dataIndex: 'jobTitle', key: 'jobTitle', width: 170 },
    {
      title: 'Phòng ban',
      dataIndex: 'department',
      key: 'department',
      width: 150,
      render: (d) => d || <Text type="secondary">—</Text>,
    },
    {
      title: 'Người đề xuất',
      dataIndex: 'createdByName',
      key: 'createdByName',
      width: 160,
      render: (n) => n || <Text type="secondary">—</Text>,
    },
    {
      title: 'Lương đề xuất',
      dataIndex: 'proposedSalary',
      key: 'proposedSalary',
      width: 150,
      render: money,
    },
    {
      title: 'Ngày đề xuất',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (s) => {
        const c = STATUS_TAG[s] || { color: 'default', label: s };
        return <Tag color={c.color} icon={c.icon}>{c.label}</Tag>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: 230,
      render: (_, r) => (
        <Space size={4}>
          <Button type="text" icon={<EyeOutlined />} onClick={() => openDetail(r)} />
          {r.status === 'PENDING' && (
            <>
              <Button
                type="primary"
                size="small"
                style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
                onClick={() => openDecision(r, true)}
              >
                Duyệt tuyển
              </Button>
              <Button danger size="small" onClick={() => openDecision(r, false)}>
                Chưa duyệt
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const filtered = proposals.filter((p) =>
    !searchText ||
    p.candidateName.toLowerCase().includes(searchText.toLowerCase()) ||
    (p.jobTitle || '').toLowerCase().includes(searchText.toLowerCase()));

  const pendingCount = proposals.filter((p) => p.status === 'PENDING').length;

  return (
    <div className="director-proposals-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Duyệt Đề Xuất Tuyển</Title>
          <Text type="secondary">
            Trưởng bộ phận đề xuất kèm mức lương — bạn quyết tuyển và chốt mức lương
          </Text>
        </div>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Duyệt là chốt tuyển — và chốt luôn mức lương"
        description="Lúc duyệt, ô lương điền sẵn mức trưởng bộ phận đề xuất: giữ nguyên hoặc sửa thành mức bạn muốn rồi duyệt. Bộ phận nhân sự soạn thư mời theo ĐÚNG mức bạn chốt (họ chỉ điền thêm ngày vào làm sau khi gọi ứng viên). Chưa muốn tuyển thì bấm 'Chưa duyệt': ứng viên KHÔNG bị loại, trưởng bộ phận bổ sung căn cứ rồi đề xuất lại."
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Chờ bạn duyệt"
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
            <Segmented
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: 'Chờ duyệt', value: 'PENDING' },
                { label: 'Đã duyệt', value: 'APPROVED' },
                { label: 'Chưa duyệt', value: 'REJECTED' },
                { label: 'Tất cả', value: 'ALL' },
              ]}
            />
          </div>
          <Text type="secondary">{filtered.length} đề xuất</Text>
        </div>

        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="proposalId"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
          locale={{ emptyText: 'Không có đề xuất nào ở mục này' }}
        />
      </Card>

      {/* Chi tiết: căn cứ để quyết — đề xuất của trưởng bộ phận + kết luận hội đồng phỏng vấn */}
      <Modal
        title="Chi Tiết Đề Xuất"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        width={720}
        footer={[
          <Button key="close" onClick={() => setDetailOpen(false)}>Đóng</Button>,
          selected?.status === 'PENDING' && (
            <Button key="reject" danger onClick={() => { setDetailOpen(false); openDecision(selected, false); }}>
              Chưa duyệt
            </Button>
          ),
          selected?.status === 'PENDING' && (
            <Button
              key="approve"
              type="primary"
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
              onClick={() => { setDetailOpen(false); openDecision(selected, true); }}
            >
              Duyệt tuyển
            </Button>
          ),
        ]}
      >
        {selected && (
          <div style={{ marginTop: 16 }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Ứng viên" span={2}>
                <Text strong>{selected.candidateName}</Text>{' '}
                <Text type="secondary">({selected.candidateEmail})</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Vị trí">{selected.jobTitle}</Descriptions.Item>
              <Descriptions.Item label="Phòng ban">{selected.department || '—'}</Descriptions.Item>
              <Descriptions.Item label="Người đề xuất">{selected.createdByName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Ngày đề xuất">
                {selected.createdAt ? dayjs(selected.createdAt).format('DD/MM/YYYY HH:mm') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Lương đề xuất">{money(selected.proposedSalary)}</Descriptions.Item>
              {/* Khung đăng trên tin — để so ngay với mức trưởng bộ phận đề xuất, không phải mở
                  tin tuyển dụng ra tra. */}
              <Descriptions.Item label="Khung lương của vị trí">
                {(() => {
                  const band = checkSalaryBand(selected, selected.proposedSalary);
                  if (!band || band.status === 'none') {
                    return <Text type="secondary">Thỏa thuận — không có khung để đối chiếu</Text>;
                  }
                  return (
                    <Space size={6} wrap>
                      <Text>{band.label}</Text>
                      {band.source === 'request' && (
                        <Tag>theo yêu cầu tuyển dụng — tin đăng thỏa thuận</Tag>
                      )}
                      {band.status === 'above' && <Tag color="warning">đề xuất vượt trần</Tag>}
                      {band.status === 'below' && <Tag color="warning">đề xuất dưới sàn</Tag>}
                    </Space>
                  );
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="Lý do đề xuất" span={2}>
                {selected.proposalNote || <Text type="secondary">Không ghi</Text>}
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

            {selected.status !== 'PENDING' && (
              <Descriptions column={2} bordered size="small" style={{ marginTop: 16 }}>
                <Descriptions.Item label="Quyết định" span={2}>
                  <Tag color={STATUS_TAG[selected.status]?.color}>
                    {STATUS_TAG[selected.status]?.label}
                  </Tag>
                  {selected.decidedByName ? ` · ${selected.decidedByName}` : ''}
                  {selected.decidedAt ? ` · ${dayjs(selected.decidedAt).format('DD/MM/YYYY HH:mm')}` : ''}
                </Descriptions.Item>
                {selected.status === 'APPROVED' && (
                  <Descriptions.Item label="Lương chốt">
                    {money(selected.approvedSalary ?? selected.proposedSalary)}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Ghi chú quyết định" span={2}>
                  {selected.decisionNote || <Text type="secondary">Không ghi</Text>}
                </Descriptions.Item>
              </Descriptions>
            )}

            <Title level={5} style={{ marginTop: 24 }}>Kết luận của hội đồng phỏng vấn</Title>

            {/* Bản đọc nhanh do AI gom các phiếu (V047). Không kết luận tuyển/không tuyển —
                Giám đốc vẫn đọc phiếu gốc bên dưới rồi mới duyệt. */}
            {!detailLoading && brief && brief.totalSubmitted > 0 && (
              <PanelSummaryCard applicationId={selected?.applicationId} />
            )}
            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
            ) : !brief || brief.totalSubmitted === 0 ? (
              <Text type="secondary">Chưa có phiếu phỏng vấn nào được nộp.</Text>
            ) : (
              <>
                <Space size={8} wrap style={{ marginBottom: 12 }}>
                  <Tag color={brief.hireCount > 0 ? 'success' : 'default'}>
                    {brief.hireCount}/{brief.totalSubmitted} nên tuyển
                  </Tag>
                  {brief.considerCount > 0 && <Tag color="warning">{brief.considerCount} cân nhắc</Tag>}
                  {brief.noHireCount > 0 && <Tag color="error">{brief.noHireCount} không nên tuyển</Tag>}
                </Space>

                {brief.rounds.map((round) => (
                  <div key={round.scheduleId} style={{ marginBottom: 12 }}>
                    <Space size={8} wrap>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Vòng {round.roundNumber}
                        {round.scheduledAt ? ` · ${dayjs(round.scheduledAt).format('DD/MM/YYYY HH:mm')}` : ''}
                      </Text>
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0, fontSize: 12 }}
                        onClick={() => navigate(`/director/interview/${round.scheduleId}`)}
                      >
                        Xem bảng điểm chi tiết
                      </Button>
                    </Space>
                    {round.verdicts.map((v) => (
                      <Card key={v.interviewerId} size="small" style={{ marginTop: 8 }}>
                        <Space wrap style={{ marginBottom: 6 }}>
                          <Text strong>{v.interviewerName || `#${v.interviewerId}`}</Text>
                          <Tag>{v.recommendation || 'Chưa ghi kết luận'}</Tag>
                        </Space>
                        <div>
                          {v.summary
                            ? <Text style={{ whiteSpace: 'pre-wrap' }}>{v.summary}</Text>
                            : <Text type="secondary">Không ghi nhận xét tổng.</Text>}
                        </div>
                      </Card>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Quyết định */}
      <Modal
        title={approving ? 'Duyệt tuyển ứng viên' : 'Chưa duyệt đề xuất'}
        open={decisionOpen}
        onOk={submitDecision}
        confirmLoading={actionLoading}
        onCancel={() => setDecisionOpen(false)}
        okText={approving ? 'Duyệt tuyển' : 'Ghi nhận'}
        okType={approving ? 'primary' : 'danger'}
        cancelText="Hủy"
        okButtonProps={approving
          ? { style: { background: MATCHA_GREEN, borderColor: MATCHA_GREEN } }
          : undefined}
      >
        <p>
          {approving ? 'Duyệt tuyển ' : 'Chưa duyệt đề xuất cho '}
          <strong>{selected?.candidateName}</strong>
          {approving ? ' cho vị trí ' : ' — vị trí '}
          <strong>{selected?.jobTitle}</strong>?
        </p>

        {/* Ô lương chốt (V057): điền sẵn mức đề xuất, Giám đốc sửa được ngay. Mức đề xuất vẫn giữ
            trên phiếu nên trưởng bộ phận thấy cả hai con số. Không có ô ngày vào làm (24/08/2026):
            nhân sự gọi ứng viên hỏi ngày rồi điền vào thư mời. */}
        {approving ? (
          <div style={{ marginTop: 12 }}>
            <Text strong>Mức lương chốt <span style={{ color: 'red' }}>*</span>:</Text>
            <InputNumber
              style={{ width: '100%', marginTop: 6 }}
              value={salary}
              onChange={setSalary}
              min={0}
              step={1000000}
              placeholder="VD: 15000000"
              formatter={(v) => (v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '')}
              parser={(v) => (v || '').replace(/,/g, '')}
              addonAfter="₫"
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Trưởng bộ phận đề xuất {money(selected?.proposedSalary)}. Giữ nguyên hoặc sửa thành mức
              bạn muốn — đây là con số thư mời sẽ dùng, bộ phận nhân sự không sửa được.
            </Text>

            {/* Đối chiếu với khung lương ĐÃ ĐĂNG TRÊN TIN: đó là con số ứng viên đọc được trước
                khi nộp hồ sơ. Hiện thường trực (không đợi lệch mới báo) để Giám đốc biết mình
                đang chốt ở đâu trong khoảng đó. Tin không ghi lương -> bỏ hẳn khối này. */}
            {(() => {
              const band = checkSalaryBand(selected, salary);
              if (!band) return null;

              // Vị trí đăng lương thỏa thuận và yêu cầu tuyển dụng cũng không ghi ngân sách:
              // nói thẳng là không có gì để đối chiếu, thay vì im lặng.
              if (band.status === 'none') {
                return (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 12 }}
                    message="Vị trí này đăng lương thỏa thuận"
                    description={`Tin tuyển dụng không ghi khung lương và Yêu cầu tuyển dụng cũng để trống, nên không có khoảng nào để đối chiếu. Căn cứ duy nhất là mức trưởng bộ phận đề xuất (${money(selected?.proposedSalary)}) — mức bạn chốt ở đây sẽ là con số chính thức đầu tiên của vị trí này.`}
                  />
                );
              }

              const tone = band.status === 'inside' ? 'success'
                : band.status === 'unknown' ? 'info' : 'warning';
              const isRequest = band.source === 'request';
              const insideText = isRequest
                ? 'Mức bạn đang chốt nằm trong ngân sách của yêu cầu tuyển dụng. Tin đăng thỏa thuận nên ứng viên chưa biết con số nào.'
                : 'Mức bạn đang chốt nằm trong khung — khớp với con số đã đăng cho ứng viên.';
              const outText = (dir) =>
                `Mức bạn đang chốt ${dir === 'above' ? 'cao hơn trần' : 'thấp hơn sàn'} ${vnd(band.gap)}. `
                + 'Vẫn duyệt được, nhưng sẽ hỏi lại một lần trước khi ghi.';

              return (
                <Alert
                  type={tone}
                  showIcon
                  style={{ marginTop: 12 }}
                  message={`${BAND_SOURCE_LABEL[band.source]}: ${band.label}`}
                  description={
                    band.status === 'inside' ? insideText
                      : band.status === 'above' ? outText('above')
                        : band.status === 'below' ? outText('below')
                          : 'Nhập mức lương chốt để đối chiếu với khung này.'
                  }
                />
              );
            })()}
          </div>
        ) : (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 12 }}
            message={`Trả phiếu về cho ${selected?.createdByName || 'trưởng bộ phận'}`}
            description="Ứng viên KHÔNG bị loại — hồ sơ ở lại bước Phỏng vấn, trưởng bộ phận bổ sung căn cứ rồi đề xuất lại. Chỉ vướng mức lương thì không cần trả về: bấm 'Duyệt tuyển' và sửa mức lương ở đó."
          />
        )}

        <div style={{ marginTop: 16 }}>
          <Text strong>
            Ghi chú {approving ? 'cho bộ phận nhân sự' : 'cho trưởng bộ phận'}
            {!approving && <span style={{ color: 'red' }}> *</span>}:
          </Text>
          <TextArea
            rows={3}
            placeholder={approving
              ? 'VD: gửi thư mời trong hôm nay, nhấn mạnh chế độ đào tạo.'
              : 'VD: chờ so với ứng viên phỏng vấn tuần sau rồi quyết.'}
            value={decisionNote}
            onChange={(e) => setDecisionNote(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default HiringProposals;
