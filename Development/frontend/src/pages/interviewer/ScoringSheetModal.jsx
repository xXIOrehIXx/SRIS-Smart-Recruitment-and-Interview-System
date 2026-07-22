import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Modal,
  Progress,
  Radio,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  SaveOutlined,
  SendOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { interviewAPI } from '../../services/api';

const { Text } = Typography;
const { TextArea } = Input;

const MATCHA_GREEN = '#5D8C3E';

const RECOMMENDATIONS = [
  { key: 'STRONG_HIRE', label: 'Trúng tuyển mạnh', color: '#52c41a' },
  { key: 'HIRE', label: 'Trúng tuyển', color: '#73d13d' },
  { key: 'CONSIDER', label: 'Cân nhắc', color: '#faad14' },
  { key: 'NO_HIRE', label: 'Không trúng tuyển', color: '#f5222d' },
];

const parseGeneralNote = (note) => {
  if (!note || typeof note !== 'string') return { feedback: '', recommendation: null };
  const m = note.match(/^\[Nhận xét chung\] ([\s\S]*?)(?: — \[Đề xuất\] (\w+))?$/);
  if (!m) return { feedback: note, recommendation: null };
  return { feedback: m[1] || '', recommendation: m[2] || null };
};

const buildGeneralNote = (feedback, recommendation) => {
  if (!feedback && !recommendation) return null;
  return `[Nhận xét chung] ${feedback || ''}${recommendation ? ` — [Đề xuất] ${recommendation}` : ''}`;
};

const BarChartOutlined = () => <span>📊</span>;

const RadarPanel = ({ myScores, criteria, aggregateRows }) => {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 40;
  const N = aggregateRows.length;
  if (N < 3) return null;

  const angleOf = (i) => (Math.PI * 2 * i) / N - Math.PI / 2;

  const pointFor = (label, value, max) => {
    const i = aggregateRows.findIndex((r) => r.criteriaId === label);
    if (i < 0) return null;
    const ratio = Math.max(0, Math.min(1, value / max));
    const a = angleOf(i);
    return {
      x: cx + radius * ratio * Math.cos(a),
      y: cy + radius * ratio * Math.sin(a),
    };
  };

  const myPath = aggregateRows
    .map((r, i) => {
      const v = myScores[r.criteriaId];
      const p = pointFor(r.criteriaId, typeof v === 'number' ? v : 0, r.max || 10);
      return `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    })
    .join(' ') + ' Z';

  const avgPath = aggregateRows
    .map((r, i) => {
      const p = pointFor(r.criteriaId, r.average || 0, r.max || 10);
      return `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    })
    .join(' ') + ' Z';

  return (
    <Card size="small" title="Biểu đồ radar — điểm bạn vs trung bình" bordered={false} style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg width={size} height={size}>
          {[0.25, 0.5, 0.75, 1].map((p, idx) => (
            <circle key={idx} cx={cx} cy={cy} r={radius * p} fill="none" stroke="#eee" />
          ))}
          {aggregateRows.map((r, i) => {
            const a = angleOf(i);
            const x2 = cx + radius * Math.cos(a);
            const y2 = cy + radius * Math.sin(a);
            const lx = cx + (radius + 18) * Math.cos(a);
            const ly = cy + (radius + 18) * Math.sin(a);
            return (
              <g key={r.criteriaId}>
                <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="#eee" />
                <text
                  x={lx}
                  y={ly}
                  fontSize="11"
                  textAnchor={lx > cx ? 'start' : lx < cx ? 'end' : 'middle'}
                  dominantBaseline="middle"
                  fill="#555"
                >
                  {r.name}
                </text>
              </g>
            );
          })}
          <path d={avgPath} fill="rgba(24, 144, 255, 0.15)" stroke="#1890ff" strokeWidth="2" />
          <path d={myPath} fill="rgba(93, 140, 62, 0.25)" stroke={MATCHA_GREEN} strokeWidth="2" />
        </svg>
      </div>
      <Space style={{ marginTop: 8, justifyContent: 'center', width: '100%' }}>
        <Tag color="green">Điểm của bạn</Tag>
        <Tag color="blue">Trung bình các interviewer</Tag>
      </Space>
    </Card>
  );
};

const ScoringSheetModal = ({ schedule, open, onClose, onSubmitted }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [criteria, setCriteria] = useState([]);
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState({});
  const [feedback, setFeedback] = useState('');
  const [recommendation, setRecommendation] = useState(null);
  const [myStatus, setMyStatus] = useState('DRAFT');

  const [aggregate, setAggregate] = useState(null);
  const [aggregateLoading, setAggregateLoading] = useState(false);

  const saveTimer = useRef(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!open || !schedule?.id) return;
    fetchSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schedule?.id]);

  const fetchSheet = async () => {
    try {
      setLoading(true);
      const res = await interviewAPI.getMySheet(schedule.id);
      const data = res.data || {};
      const cs = Array.isArray(data.criteria) ? data.criteria : [];
      setCriteria(cs.map((c) => ({
        id: c.criteriaId,
        name: c.name || 'Tiêu chí',
        maxScore: c.maxScore || 10,
        weight: c.weight || 1,
      })));

      const scoreMap = {};
      const noteMap = {};
      cs.forEach((c) => {
        if (c.myScore !== undefined && c.myScore !== null) scoreMap[c.criteriaId] = c.myScore;
        if (c.myNote) noteMap[c.criteriaId] = c.myNote;
      });
      setScores(scoreMap);
      setNotes(noteMap);

      const firstNote = noteMap[cs[0]?.criteriaId] || '';
      const parsed = parseGeneralNote(firstNote);
      setFeedback(parsed.feedback);
      setRecommendation(parsed.recommendation);

      const status = data.myStatus || (data.isSubmitted || data.status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT');
      setMyStatus(status);

      if (status === 'SUBMITTED') fetchAggregate();
    } catch (err) {
      console.error('getMySheet error', err);
      message.error(err?.response?.data?.userMsg || 'Không tải được phiếu chấm');
    } finally {
      setLoading(false);
    }
  };

  const fetchAggregate = async () => {
    try {
      setAggregateLoading(true);
      const res = await interviewAPI.getAggregate(schedule.id);
      setAggregate(res.data || null);
    } catch (err) {
      console.error('getAggregate error', err);
      setAggregate(null);
    } finally {
      setAggregateLoading(false);
    }
  };

  const triggerAutoSave = (nextScores, nextNotes) => {
    if (myStatus === 'SUBMITTED') return;
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDraft(nextScores ?? scores, nextNotes ?? notes);
    }, 800);
  };

  const handleScoreChange = (cid, value) => {
    if (myStatus === 'SUBMITTED') return;
    const next = { ...scores, [cid]: value };
    setScores(next);
    triggerAutoSave(next, notes);
  };

  const handleNoteChange = (cid, value) => {
    if (myStatus === 'SUBMITTED') return;
    const next = { ...notes, [cid]: value };
    setNotes(next);
    triggerAutoSave(scores, next);
  };

  const handleFeedbackChange = (val) => {
    if (myStatus === 'SUBMITTED') return;
    setFeedback(val);
    triggerAutoSave(scores, notes);
  };

  const handleRecommendationChange = (val) => {
    if (myStatus === 'SUBMITTED') return;
    setRecommendation(val);
    triggerAutoSave(scores, notes);
  };

  const saveDraft = async (s, n) => {
    try {
      setSaving(true);
      const payload = {
        items: criteria
          .filter((c) => typeof c.id === 'number')
          .map((c, idx) => ({
            criteriaId: c.id,
            score: (s ?? scores)[c.id] ?? null,
            note: idx === 0
              ? (buildGeneralNote(feedback, recommendation) ?? (n ?? notes)[c.id] ?? null)
              : ((n ?? notes)[c.id] || null),
          })),
      };
      if (payload.items.length === 0) return;
      await interviewAPI.updateMySheet(schedule.id, payload);
      dirtyRef.current = false;
      message.success('Đã lưu nháp', 1);
    } catch (err) {
      console.error('saveDraft error', err);
      message.error(err?.response?.data?.userMsg || 'Lưu nháp thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    const missing = criteria.filter((c) => typeof c.id === 'number' && (scores[c.id] === undefined || scores[c.id] === null));
    if (missing.length > 0) {
      message.warning(`Vui lòng chấm đủ ${missing.length} tiêu chí trước khi nộp`);
      return;
    }
    try {
      setSubmitting(true);
      await interviewAPI.updateMySheet(schedule.id, {
        items: criteria
          .filter((c) => typeof c.id === 'number')
          .map((c, idx) => ({
            criteriaId: c.id,
            score: scores[c.id],
            note: idx === 0
              ? (buildGeneralNote(feedback, recommendation) ?? notes[c.id] ?? null)
              : (notes[c.id] || null),
          })),
      });
      await interviewAPI.submitMySheet(schedule.id);
      message.success('Đã nộp phiếu — hệ thống mở blind và tổng hợp điểm các interviewer.');
      setMyStatus('SUBMITTED');
      dirtyRef.current = false;
      await fetchAggregate();
      onSubmitted?.();
    } catch (err) {
      console.error('submit error', err);
      message.error(err?.response?.data?.userMsg || 'Nộp phiếu thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const filledCount = useMemo(
    () => criteria.filter((c) => typeof c.id === 'number' && scores[c.id] !== undefined && scores[c.id] !== null).length,
    [criteria, scores]
  );
  const totalCriteria = useMemo(() => criteria.filter((c) => typeof c.id === 'number').length, [criteria]);
  const weightedPct = useMemo(() => {
    let weightedSum = 0;
    let totalWeight = 0;
    criteria.forEach((c) => {
      const s = scores[c.id];
      if (typeof s === 'number') {
        weightedSum += s * (c.weight || 1);
        totalWeight += (c.weight || 1) * (c.maxScore || 10);
      }
    });
    return totalWeight > 0 ? ((weightedSum / totalWeight) * 100).toFixed(1) : 0;
  }, [criteria, scores]);

  const isLocked = myStatus === 'SUBMITTED';

  const aggregateRows = useMemo(() => {
    if (!aggregate?.criteriaAggregates) return [];
    return aggregate.criteriaAggregates.map((a) => ({
      ...a,
      spread: a.max !== undefined && a.min !== undefined ? +(a.max - a.min).toFixed(2) : 0,
    }));
  }, [aggregate]);

  const hotCriteria = useMemo(
    () => aggregateRows.filter((r) => r.spread >= 2).sort((a, b) => b.spread - a.spread),
    [aggregateRows]
  );

  return (
    <Modal
      open={open}
      onCancel={() => {
        if (dirtyRef.current && !isLocked) saveDraft();
        onClose();
      }}
      footer={null}
      width={920}
      destroyOnClose
      title={
        <Space>
          <Avatar style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />
          <div>
            <Text strong style={{ fontSize: 16 }}>Phiếu chấm phỏng vấn</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {schedule?.candidate} — {schedule?.position} • Vòng {schedule?.level}
            </Text>
          </div>
          {isLocked ? (
            <Tag color="success" icon={<CheckCircleOutlined />} style={{ marginLeft: 8 }}>Đã nộp</Tag>
          ) : (
            <Tag color="warning" icon={<EditOutlined />} style={{ marginLeft: 8 }}>Đang chấm</Tag>
          )}
        </Space>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
      ) : (
        <Tabs
          defaultActiveKey="scoring"
          items={[
            {
              key: 'scoring',
              label: <span><EditOutlined /> Chấm điểm</span>,
              children: (
                <>
                  {isLocked ? (
                    <Alert
                      type="success"
                      showIcon
                      icon={<CheckCircleOutlined />}
                      message="Phiếu đã nộp — bạn không thể chỉnh sửa. Xem tab Tổng hợp để thấy điểm các interviewer khác (blind đã mở)."
                      style={{ marginBottom: 16 }}
                    />
                  ) : (
                    <Alert
                      type="info"
                      showIcon
                      icon={<EyeInvisibleOutlined />}
                      message="Chấm mù — bạn sẽ không thấy điểm interviewer khác cho tới khi cả panel nộp phiếu."
                      style={{ marginBottom: 16 }}
                    />
                  )}

                  <Card size="small" bordered={false} style={{ marginBottom: 16, background: '#fafafa' }}>
                    <Row gutter={16} align="middle">
                      <Col flex="auto">
                        <Text type="secondary">Tiến độ chấm</Text>
                        <Progress
                          percent={totalCriteria > 0 ? Math.round((filledCount / totalCriteria) * 100) : 0}
                          strokeColor={MATCHA_GREEN}
                        />
                      </Col>
                      <Col>
                        <Statistic
                          title="Tổng điểm (quy đổi)"
                          value={weightedPct}
                          suffix="%"
                          valueStyle={{ color: MATCHA_GREEN, fontSize: 20 }}
                        />
                      </Col>
                      <Col>
                        <Statistic
                          title="Đã chấm"
                          value={`${filledCount}/${totalCriteria}`}
                          prefix={<CheckCircleOutlined />}
                          valueStyle={{ fontSize: 20 }}
                        />
                      </Col>
                    </Row>
                  </Card>

                  {criteria.length === 0 ? (
                    <Alert
                      type="warning"
                      message="Vị trí này chưa có bộ tiêu chí đã duyệt — không thể chấm."
                      showIcon
                    />
                  ) : (
                    <Form layout="vertical">
                      {criteria.map((c, idx) => {
                        const value = scores[c.id];
                        return (
                          <Card
                            key={c.id ?? idx}
                            size="small"
                            bordered
                            style={{ marginBottom: 12 }}
                            title={
                              <Space>
                                <Text strong>{c.name}</Text>
                                <Tag>Trọng số ×{c.weight}</Tag>
                                <Tag color="cyan">/{c.maxScore}</Tag>
                              </Space>
                            }
                            extra={
                              <Text strong style={{ color: MATCHA_GREEN, fontSize: 16 }}>
                                {typeof value === 'number' ? value : '—'}/{c.maxScore}
                              </Text>
                            }
                          >
                            <input
                              type="range"
                              min={0}
                              max={c.maxScore}
                              step={0.5}
                              value={typeof value === 'number' ? value : 0}
                              onChange={(e) => handleScoreChange(c.id, parseFloat(e.target.value))}
                              disabled={isLocked}
                              style={{ width: '100%' }}
                            />
                            {idx === 0 && (
                              <Row gutter={16} style={{ marginTop: 8 }}>
                                <Col xs={24} md={16}>
                                  <Text type="secondary">Nhận xét chung</Text>
                                  <TextArea
                                    rows={3}
                                    value={feedback}
                                    onChange={(e) => handleFeedbackChange(e.target.value)}
                                    placeholder="Ghi chú tổng quan về buổi phỏng vấn..."
                                    disabled={isLocked}
                                  />
                                </Col>
                                <Col xs={24} md={8}>
                                  <Text type="secondary">Đề xuất</Text>
                                  <Radio.Group
                                    value={recommendation}
                                    onChange={(e) => handleRecommendationChange(e.target.value)}
                                    disabled={isLocked}
                                    style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}
                                  >
                                    {RECOMMENDATIONS.map((r) => (
                                      <Radio key={r.key} value={r.key}>
                                        <Tag color={r.color} style={{ margin: 0 }}>{r.label}</Tag>
                                      </Radio>
                                    ))}
                                  </Radio.Group>
                                </Col>
                              </Row>
                            )}
                          </Card>
                        );
                      })}
                    </Form>
                  )}

                  <Divider />

                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <Button
                        icon={<SaveOutlined />}
                        onClick={() => saveDraft()}
                        loading={saving}
                        disabled={isLocked}
                      >
                        Lưu nháp
                      </Button>
                      {saving ? (
                        <Text type="secondary"><Spin size="small" /> Đang lưu...</Text>
                      ) : (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {isLocked ? 'Đã khóa' : 'Tự lưu nháp khi bạn gõ (sau 0.8s)'}
                        </Text>
                      )}
                    </Space>
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={handleSubmit}
                      loading={submitting}
                      disabled={isLocked || totalCriteria === 0}
                      style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
                    >
                      Nộp phiếu chấm
                    </Button>
                  </Space>
                </>
              ),
            },
            {
              key: 'aggregate',
              label: (
                <span>
                  <TrophyOutlined /> Tổng hợp
                  {isLocked ? null : <EyeInvisibleOutlined style={{ marginLeft: 4 }} />}
                </span>
              ),
              children: (
                <>
                  {!isLocked ? (
                    <Alert
                      type="info"
                      icon={<EyeInvisibleOutlined />}
                      message="Chấm mù đang bật — bạn sẽ thấy tổng hợp khi phiếu của bạn được nộp."
                      showIcon
                    />
                  ) : aggregateLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
                  ) : !aggregate ? (
                    <Alert
                      type="warning"
                      icon={<WarningOutlined />}
                      message="Chưa đủ dữ liệu tổng hợp — có thể chưa có interviewer khác nộp phiếu."
                      showIcon
                    />
                  ) : (
                    <>
                      <Row gutter={16} style={{ marginBottom: 16 }}>
                        <Col xs={12} md={6}>
                          <Card bordered={false} style={{ background: '#fafafa' }}>
                            <Statistic
                              title="Số interviewer đã nộp"
                              value={aggregate.submittedCount || 0}
                              suffix={`/ ${aggregate.totalInterviewers || 0}`}
                              prefix={<TeamOutlined />}
                            />
                          </Card>
                        </Col>
                        <Col xs={12} md={6}>
                          <Card bordered={false} style={{ background: '#fafafa' }}>
                            <Statistic
                              title="Điểm trung bình"
                              value={aggregate.averageScore || 0}
                              precision={1}
                              suffix="/ 10"
                              valueStyle={{ color: MATCHA_GREEN }}
                              prefix={<TrophyOutlined />}
                            />
                          </Card>
                        </Col>
                        <Col xs={12} md={6}>
                          <Card bordered={false} style={{ background: '#fafafa' }}>
                            <Statistic
                              title="Điểm cao nhất"
                              value={aggregate.maxScore || 0}
                              precision={1}
                              suffix="/ 10"
                              valueStyle={{ color: '#52c41a' }}
                            />
                          </Card>
                        </Col>
                        <Col xs={12} md={6}>
                          <Card bordered={false} style={{ background: '#fafafa' }}>
                            <Statistic
                              title="Điểm thấp nhất"
                              value={aggregate.minScore || 0}
                              precision={1}
                              suffix="/ 10"
                              valueStyle={{ color: '#f5222d' }}
                            />
                          </Card>
                        </Col>
                      </Row>

                      {hotCriteria.length > 0 && (
                        <Alert
                          type="warning"
                          showIcon
                          icon={<WarningOutlined />}
                          message={`${hotCriteria.length} tiêu chí các interviewer lệch nhau nhiều — nên bàn lại trong họp panel`}
                          description={
                            <Space wrap>
                              {hotCriteria.map((r) => (
                                <Tag key={r.criteriaId} color="orange">
                                  {r.name}: {r.min}–{r.max} (Δ {r.spread})
                                </Tag>
                              ))}
                            </Space>
                          }
                          style={{ marginBottom: 16 }}
                        />
                      )}

                      <Card size="small" title={<><BarChartOutlined /> Điểm theo tiêu chí</>} bordered={false}>
                        <Table
                          rowKey="criteriaId"
                          size="small"
                          pagination={false}
                          dataSource={aggregateRows}
                          columns={[
                            { title: 'Tiêu chí', dataIndex: 'name', key: 'name' },
                            {
                              title: 'Trung bình',
                              dataIndex: 'average',
                              key: 'average',
                              render: (v) => <Text strong style={{ color: MATCHA_GREEN }}>{Number(v || 0).toFixed(2)}</Text>,
                            },
                            { title: 'Cao', dataIndex: 'max', key: 'max' },
                            { title: 'Thấp', dataIndex: 'min', key: 'min' },
                            {
                              title: 'Độ lệch',
                              dataIndex: 'spread',
                              key: 'spread',
                              render: (v) => (
                                <Tag color={v >= 2 ? 'orange' : v >= 1 ? 'gold' : 'green'}>
                                  Δ {v}
                                </Tag>
                              ),
                            },
                            {
                              title: 'Các điểm',
                              dataIndex: 'scores',
                              key: 'scores',
                              render: (scores) => (
                                <Space size={4} wrap>
                                  {Array.isArray(scores) && scores.length > 0 ? (
                                    scores.map((s, i) => (
                                      <Tooltip key={i} title={`Interviewer #${s.interviewerId ?? i + 1}`}>
                                        <Tag>{Number(s.score).toFixed(1)}</Tag>
                                      </Tooltip>
                                    ))
                                  ) : (
                                    <Text type="secondary">—</Text>
                                  )}
                                </Space>
                              ),
                            },
                          ]}
                        />
                      </Card>

                      {aggregateRows.length >= 3 && (
                        <RadarPanel
                          myScores={scores}
                          criteria={criteria}
                          aggregateRows={aggregateRows}
                        />
                      )}
                    </>
                  )}
                </>
              ),
            },
          ]}
        />
      )}
    </Modal>
  );
};

export default ScoringSheetModal;
