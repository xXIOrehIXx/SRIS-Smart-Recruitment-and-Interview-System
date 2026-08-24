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

const STATUS_TAG = {
  PENDING: { color: 'warning', label: 'Chờ bạn duyệt', icon: <ClockCircleOutlined /> },
  APPROVED: { color: 'success', label: 'Đã duyệt tuyển', icon: <CheckCircleOutlined /> },
  REJECTED: { color: 'error', label: 'Chưa duyệt', icon: <CloseCircleOutlined /> },
};

/**
 * Duyệt đề xuất tuyển — màn của GIÁM ĐỐC (docs 5.14, V043 — chốt 15/08/2026).
 *
 * Trưởng bộ phận đọc kết luận hội đồng phỏng vấn rồi đề xuất "nên tuyển người này"; Giám đốc
 * là người quyết. Duyệt ở đây = hồ sơ sang bước Quyết định, kèm mức lương và ngày vào làm
 * Giám đốc chốt — bộ phận nhân sự lấy đúng hai con số đó soạn thư mời, không phải hỏi lại.
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
    // Điền sẵn mức Trưởng bộ phận đề xuất — Giám đốc gật đầu hoặc sửa lại.
    setSalary(record.proposedSalary ?? null);
    setDecisionOpen(true);
  };

  const submitDecision = async () => {
    try {
      setActionLoading(true);
      await hiringProposalAPI.decide(selected.proposalId, {
        approve: approving,
        note: decisionNote || null,
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
            Trưởng bộ phận đề xuất — bạn quyết tuyển và chốt mức lương, ngày vào làm
          </Text>
        </div>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Duyệt là chốt tuyển"
        description="Duyệt xong hồ sơ sang bước Quyết định và bộ phận nhân sự soạn thư mời theo đúng mức lương, ngày vào làm bạn chốt ở đây. Chưa duyệt thì ứng viên vẫn ở bước Phỏng vấn, trưởng bộ phận bổ sung căn cứ rồi đề xuất lại."
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
                <Descriptions.Item label="Lương chốt">{money(selected.approvedSalary)}</Descriptions.Item>
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

        {approving && (
          <>
            <div style={{ marginTop: 12 }}>
              <Text strong>Mức lương chốt:</Text>
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
                Bỏ trống thì giữ nguyên mức trưởng bộ phận đề xuất. Đây là con số thư mời sẽ dùng —
                bộ phận nhân sự không sửa được.
              </Text>
            </div>
            {/* Không có ô ngày vào làm (24/08/2026): Giám đốc chốt LƯƠNG, bộ phận nhân sự gọi
                ứng viên hỏi ngày họ đi làm được rồi điền vào thư mời. */}
          </>
        )}

        <div style={{ marginTop: 16 }}>
          <Text strong>Ghi chú {approving ? 'cho bộ phận nhân sự' : 'cho trưởng bộ phận'}:</Text>
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
