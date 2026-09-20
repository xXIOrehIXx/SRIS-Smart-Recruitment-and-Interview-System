import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Typography, Table, Tag, Button, Space, Modal, Descriptions, Avatar, Input,
  Row, Col, Statistic, Select, Segmented, Timeline, Spin, message,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, EyeOutlined,
  SearchOutlined, UserOutlined, TrophyOutlined, ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { hiringProposalAPI } from '../../services/api';
import { useAuth, ROLES } from '../../contexts/AuthContext';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import ApplicationStateTag from '../../components/ApplicationStateTag';
import '../Dashboard.css';

const { Title, Text } = Typography;

const MATCHA_GREEN = '#5D8C3E';

const apiMessage = (error, fallback) =>
  error?.response?.data?.userMsg || error?.response?.data?.UserMsg || fallback;

const money = (v) => (v == null ? '—' : `${Number(v).toLocaleString('vi-VN')} ₫`);

/**
 * Mức lương CUỐI CÙNG của một phiếu đã duyệt.
 *
 * Giám đốc chốt lương ngay lúc duyệt (V057) nên `approvedSalary` là con số thư mời dùng. Phiếu
 * duyệt từ thời V053 (trước 15/09/2026) không có cột đó — lúc ấy duyệt nghĩa là gật đúng mức
 * trưởng bộ phận đề xuất, nên rơi về `proposedSalary` thay vì hiện "—" cho cả một quãng lịch sử.
 */
const finalSalary = (p) => p.approvedSalary ?? p.proposedSalary;

const STATUS_TAG = {
  PENDING: { color: 'processing', label: 'Chờ Giám đốc duyệt', icon: <ClockCircleOutlined /> },
  APPROVED: { color: 'success', label: 'Đã duyệt tuyển', icon: <CheckCircleOutlined /> },
  REJECTED: { color: 'error', label: 'Chưa duyệt', icon: <CloseCircleOutlined /> },
};

const statusTag = (s) => {
  const c = STATUS_TAG[s] || { color: 'default', label: s };
  return <Tag color={c.color} icon={c.icon}>{c.label}</Tag>;
};

/**
 * LỊCH SỬ ĐỀ XUẤT TUYỂN — màn ĐỌC, dùng chung cho Giám đốc và Trưởng bộ phận.
 *
 * Vì sao tách khỏi hai màn đang có: cả hai màn kia là bàn làm việc của việc ĐANG CHỜ, và cái gì
 * đã xong thì rơi khỏi tầm mắt.
 *   - Màn "Duyệt Đề Xuất Tuyển" của Giám đốc mở ở tab Chờ duyệt, cột bày ra là mức ĐỀ XUẤT —
 *     đúng cho lúc quyết, nhưng xem lại thì thứ cần đọc là mức mình đã CHỐT, chốt hôm nào,
 *     và rốt cuộc người đó có vào làm không.
 *   - Màn "Đề Xuất Tuyển" của Trưởng bộ phận lấy dữ liệu từ cột Phỏng vấn của Kanban: phiếu vừa
 *     được duyệt là hồ sơ sang bước Quyết định và BIẾN MẤT khỏi bảng — đúng người mình vừa tuyển
 *     được lại là người không tra lại được.
 *
 * Nguồn: GET /api/hiring-proposals (không kèm status = cả lịch sử). Backend đã thu hẹp cho
 * Trưởng bộ phận về vị trí họ phụ trách + phiếu họ viết, nên FE KHÔNG lọc lại theo phòng ban
 * (hai nơi giữ cùng một luật thì sớm muộn lệch nhau).
 *
 * Mỗi lần đề xuất là MỘT DÒNG, kể cả các lần bị trả về của cùng một hồ sơ: đó chính là lịch sử.
 */
const ProposalHistory = () => {
  const { user } = useAuth();
  const isDirector = user?.role === ROLES.DIRECTOR;

  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [searchText, setSearchText] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [appHistory, setAppHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const res = await hiringProposalAPI.getList();
      setProposals(res.data || []);
    } catch (error) {
      console.error(error);
      message.error(apiMessage(error, 'Không tải được lịch sử đề xuất tuyển'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vừa duyệt một phiếu ở tab khác -> quay lại tab này là thấy ngay dòng mới.
  useRefreshOnFocus(() => fetchProposals());

  /** Các lần đề xuất TRƯỚC của cùng hồ sơ — trả về rồi đề xuất lại là chuyện thường. */
  const openDetail = async (record) => {
    setSelected(record);
    setDetailOpen(true);
    setAppHistory([]);
    setHistoryLoading(true);
    try {
      const res = await hiringProposalAPI.getByApplication(record.applicationId);
      setAppHistory(res.data || []);
    } catch (error) {
      console.error(error);
      // Không chặn: phần chính của modal là phiếu đang mở, nó đã có sẵn trong record.
      setAppHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const departments = useMemo(() => {
    const set = new Set(proposals.map((p) => p.department).filter(Boolean));
    return Array.from(set).sort();
  }, [proposals]);

  const filtered = useMemo(() => proposals.filter((p) => {
    if (statusFilter === 'HIRED') {
      // "Đã vào làm" KHÁC "đã duyệt": duyệt xong ứng viên vẫn có thể từ chối thư mời.
      if (p.applicationState !== 'HIRED') return false;
    } else if (statusFilter !== 'ALL' && p.status !== statusFilter) {
      return false;
    }
    if (departmentFilter !== 'ALL' && (p.department || '') !== departmentFilter) return false;
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (p.candidateName || '').toLowerCase().includes(q)
      || (p.candidateEmail || '').toLowerCase().includes(q)
      || (p.jobTitle || '').toLowerCase().includes(q);
  }), [proposals, statusFilter, departmentFilter, searchText]);

  const stats = useMemo(() => ({
    hired: proposals.filter((p) => p.status === 'APPROVED' && p.applicationState === 'HIRED').length,
    approved: proposals.filter((p) => p.status === 'APPROVED').length,
    rejected: proposals.filter((p) => p.status === 'REJECTED').length,
    pending: proposals.filter((p) => p.status === 'PENDING').length,
  }), [proposals]);

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
      width: 140,
      render: (d) => d || <Text type="secondary">—</Text>,
    },
    {
      title: 'Người đề xuất',
      dataIndex: 'createdByName',
      key: 'createdByName',
      width: 150,
      render: (n) => n || <Text type="secondary">—</Text>,
    },
    {
      title: 'Lương đề xuất',
      dataIndex: 'proposedSalary',
      key: 'proposedSalary',
      width: 140,
      sorter: (a, b) => (a.proposedSalary || 0) - (b.proposedSalary || 0),
      render: money,
    },
    {
      // Con số thư mời thực sự dùng. Lệch mức đề xuất thì nói ra — đó là chỗ Giám đốc đã sửa.
      title: 'Lương Giám đốc chốt',
      key: 'approvedSalary',
      width: 180,
      sorter: (a, b) => (finalSalary(a) || 0) - (finalSalary(b) || 0),
      render: (_, r) => {
        if (r.status !== 'APPROVED') return <Text type="secondary">—</Text>;
        const changed = r.approvedSalary != null && r.approvedSalary !== r.proposedSalary;
        return (
          <Space size={4} wrap>
            <Text strong>{money(finalSalary(r))}</Text>
            {changed && <Tag color="gold">đã sửa</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Ngày đề xuất',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 130,
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
      render: (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'Ngày quyết định',
      dataIndex: 'decidedAt',
      key: 'decidedAt',
      width: 145,
      sorter: (a, b) => dayjs(a.decidedAt || 0).valueOf() - dayjs(b.decidedAt || 0).valueOf(),
      render: (d, r) => (d
        ? (
          <div>
            <div>{dayjs(d).format('DD/MM/YYYY')}</div>
            {r.decidedByName && (
              <Text type="secondary" style={{ fontSize: 12 }}>{r.decidedByName}</Text>
            )}
          </div>
        )
        : <Text type="secondary">Chưa quyết</Text>),
    },
    {
      title: 'Quyết định',
      dataIndex: 'status',
      key: 'status',
      width: 175,
      render: statusTag,
    },
    {
      // Duyệt tuyển chưa phải là xong: ứng viên còn có thể từ chối thư mời.
      title: 'Hồ sơ hiện tại',
      dataIndex: 'applicationState',
      key: 'applicationState',
      width: 170,
      render: (s) => <ApplicationStateTag state={s} />,
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 60,
      render: (_, r) => (
        <Button type="text" icon={<EyeOutlined />} onClick={() => openDetail(r)} />
      ),
    },
  ];

  return (
    <div className="proposal-history-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">
            {isDirector ? 'Lịch Sử Quyết Định Tuyển' : 'Lịch Sử Đề Xuất Tuyển'}
          </Title>
          <Text type="secondary">
            {isDirector
              ? 'Mọi phiếu đề xuất đã đi qua bàn của bạn — ai được tuyển, mức lương bạn chốt là bao nhiêu'
              : 'Các đề xuất bạn đã gửi và kết quả Giám đốc trả lời — gồm cả phiếu đã xong nên không còn nằm ở màn Đề Xuất Tuyển'}
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchProposals} loading={loading}>
          Tải lại
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Đã vào làm"
              value={stats.hired}
              valueStyle={{ color: MATCHA_GREEN }}
              prefix={<TrophyOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Đã duyệt tuyển"
              value={stats.approved}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Chưa duyệt"
              value={stats.rejected}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Đang chờ quyết"
              value={stats.pending}
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card className="main-card" bordered={false}>
        <div
          className="table-toolbar"
          style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <Input
            placeholder="Tìm theo tên ứng viên, email, vị trí..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Segmented
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: 'Tất cả', value: 'ALL' },
              { label: 'Đã vào làm', value: 'HIRED' },
              { label: 'Đã duyệt tuyển', value: 'APPROVED' },
              { label: 'Chưa duyệt', value: 'REJECTED' },
              { label: 'Đang chờ', value: 'PENDING' },
            ]}
          />
          {/* Lọc phòng ban chỉ có nghĩa khi dữ liệu trải nhiều phòng — Giám đốc nhìn toàn công ty. */}
          {departments.length > 1 && (
            <Select
              value={departmentFilter}
              onChange={setDepartmentFilter}
              style={{ width: 200 }}
              options={[
                { label: 'Tất cả phòng ban', value: 'ALL' },
                ...departments.map((d) => ({ label: d, value: d })),
              ]}
            />
          )}
          <Text type="secondary" style={{ marginLeft: 'auto' }}>{filtered.length} phiếu</Text>
        </div>

        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="proposalId"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1600 }}
          locale={{
            emptyText: proposals.length
              ? 'Không có phiếu nào khớp bộ lọc'
              : 'Chưa có đề xuất tuyển nào',
          }}
        />
      </Card>

      <Modal
        title="Chi Tiết Phiếu Đề Xuất"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        width={720}
        footer={[<Button key="close" onClick={() => setDetailOpen(false)}>Đóng</Button>]}
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
              <Descriptions.Item label="Lý do đề xuất" span={2}>
                {selected.proposalNote || <Text type="secondary">Không ghi</Text>}
              </Descriptions.Item>

              <Descriptions.Item label="Quyết định" span={2}>
                <Space size={8} wrap>
                  {statusTag(selected.status)}
                  {selected.decidedByName && <Text>{selected.decidedByName}</Text>}
                  {selected.decidedAt && (
                    <Text type="secondary">
                      {dayjs(selected.decidedAt).format('DD/MM/YYYY HH:mm')}
                    </Text>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Lương đề xuất">{money(selected.proposedSalary)}</Descriptions.Item>
              <Descriptions.Item label="Lương Giám đốc chốt">
                {selected.status === 'APPROVED'
                  ? (
                    <Space size={4} wrap>
                      <Text strong>{money(finalSalary(selected))}</Text>
                      {selected.approvedSalary != null
                        && selected.approvedSalary !== selected.proposedSalary && (
                        <Tag color="gold">sửa so với mức đề xuất</Tag>
                      )}
                    </Space>
                  )
                  : <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Ghi chú quyết định" span={2}>
                {selected.decisionNote || <Text type="secondary">Không ghi</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Hồ sơ hiện tại" span={2}>
                <ApplicationStateTag state={selected.applicationState} />
              </Descriptions.Item>
            </Descriptions>

            {/* Trả về rồi đề xuất lại là chuyện thường — gom đủ các lần của cùng hồ sơ thì mới
                đọc ra được vì sao lần cuối mới được duyệt. */}
            <Title level={5} style={{ marginTop: 24 }}>Các lần đề xuất của hồ sơ này</Title>
            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: 16 }}><Spin /></div>
            ) : appHistory.length <= 1 ? (
              <Text type="secondary">Hồ sơ này chỉ có một lần đề xuất.</Text>
            ) : (
              <Timeline
                style={{ marginTop: 12 }}
                items={appHistory.map((p) => ({
                  color: p.status === 'APPROVED' ? 'green' : p.status === 'REJECTED' ? 'red' : 'blue',
                  children: (
                    <div>
                      <Space size={8} wrap>
                        {statusTag(p.status)}
                        <Text type="secondary">
                          đề xuất {p.createdAt ? dayjs(p.createdAt).format('DD/MM/YYYY') : '—'}
                          {p.createdByName ? ` · ${p.createdByName}` : ''}
                        </Text>
                        {p.proposalId === selected.proposalId && <Tag>phiếu đang xem</Tag>}
                      </Space>
                      <div style={{ marginTop: 4 }}>
                        <Text>
                          Đề xuất {money(p.proposedSalary)}
                          {p.status === 'APPROVED' ? ` · chốt ${money(finalSalary(p))}` : ''}
                        </Text>
                      </div>
                      {p.decisionNote && (
                        <Text type="secondary" style={{ whiteSpace: 'pre-wrap' }}>
                          {p.decisionNote}
                        </Text>
                      )}
                    </div>
                  ),
                }))}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProposalHistory;
