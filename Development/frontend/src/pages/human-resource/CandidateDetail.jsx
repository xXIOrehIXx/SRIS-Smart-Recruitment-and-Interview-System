import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Row, Col, Card, Typography, Avatar, Tag, Button, Tabs, Timeline,
  Space, Divider, Spin, message, Tooltip, Alert, Table,
  Modal, Input
} from 'antd';
import {
  ArrowLeftOutlined,
  MailOutlined,
  PhoneOutlined,
  CalendarOutlined,
  FileTextOutlined,
  ReloadOutlined,
  CloseCircleOutlined,
  LinkOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  MinusCircleOutlined
} from '@ant-design/icons';
import { applicationAPI, cvAPI, interviewAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { canRejectAtState, rejectOwnerLabel } from '../../utils/decisionRights';
import ApplicationStateTag, { stateLabel } from '../../components/ApplicationStateTag';
import ConsensusTag from '../../components/ConsensusTag';
import { actionLabel, formatActivityDetail } from '../../services/activityLog';
import './css/CandidateDetail.css';

const { Title, Text } = Typography;

const MATCHA_GREEN = '#5D8C3E';

// Đề xuất của người phỏng vấn (InterviewFeedback.recommendation) — cùng bộ chữ với
// phiếu chấm và màn Quyết định tuyển dụng.
const RECOMMENDATION_LABELS = {
  STRONG_HIRE: 'Rất nên tuyển',
  HIRE: 'Nên tuyển',
  CONSIDER: 'Cần xem xét',
  NO_HIRE: 'Không nên tuyển',
};
const RECOMMENDATION_COLORS = {
  STRONG_HIRE: 'success',
  HIRE: 'success',
  CONSIDER: 'warning',
  NO_HIRE: 'error',
};

// Đề xuất của AI sau khi đối chiếu CV với tin tuyển dụng (CvScreeningResultDto.decision).
// Nhãn cố ý viết dưới dạng LỜI KHUYÊN chứ không phải phán quyết ("Nên mời phỏng vấn", không
// phải "Đạt"): đây là gợi ý của máy, người tuyển dụng mới là người quyết.
const SCREENING_DECISIONS = {
  PROCEED: { label: 'Nên mời phỏng vấn', color: 'success' },
  CONSIDER: { label: 'Cần xem thêm', color: 'warning' },
  REJECT: { label: 'Chưa phù hợp', color: 'error' },
};

// Nhãn + màu trạng thái dùng chung toàn app: components/ApplicationStateTag.jsx

/**
 * Chi tiết 1 hồ sơ (ApplicationDetailDto): thông tin ứng viên, file CV gốc, bản phân tích
 * CV↔JD do AI sinh, lịch sử audit, ghi chú nội bộ.
 *
 * Bản phân tích là THAM KHẢO: không có màn hình nào xếp hạng ứng viên theo điểm phù hợp, và
 * backend không tự đổi trạng thái hồ sơ theo đề xuất của AI.
 */
const CandidateDetail = () => {
  const { id: applicationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [history, setHistory] = useState([]);
  const [notes, setNotes] = useState([]);
  const [sendingLink, setSendingLink] = useState(false);
  // Kết quả phỏng vấn: điểm (interview-aggregate) + kết luận/nhận xét (decision-brief).
  // Blind review do BE giữ: chỉ phiếu ĐÃ NỘP mới có trong hai nguồn này.
  const [aggregates, setAggregates] = useState([]);
  const [brief, setBrief] = useState(null);
  // Lượt AI đối chiếu CV với JD (CvScreeningStatusDto). null = chưa tải xong lần đầu.
  const [screening, setScreening] = useState(null);
  const [requestingScreening, setRequestingScreening] = useState(false);

  const fetchApplicationDetails = useCallback(async () => {
    try {
      setLoading(true);
      const [appRes, historyRes, notesRes, aggRes, briefRes, screenRes] = await Promise.allSettled([
        applicationAPI.getById(applicationId),
        applicationAPI.getHistory(applicationId),
        applicationAPI.getNotes(applicationId),
        interviewAPI.getApplicationAggregate(applicationId),
        interviewAPI.getDecisionBrief(applicationId),
        cvAPI.getScreening(applicationId),
      ]);

      if (appRes.status === 'fulfilled') setApplication(appRes.value.data);
      else message.error('Không thể tải thông tin ứng viên');
      setHistory(historyRes.status === 'fulfilled' ? historyRes.value.data || [] : []);
      setNotes(notesRes.status === 'fulfilled' ? notesRes.value.data || [] : []);
      // Hồ sơ chưa phỏng vấn thì hai API này trả rỗng/lỗi — tab Phỏng vấn tự hiện dòng trống,
      // không chặn phần còn lại của trang.
      setAggregates(aggRes.status === 'fulfilled' ? aggRes.value.data || [] : []);
      setBrief(briefRes.status === 'fulfilled' ? briefRes.value.data || null : null);
      setScreening(screenRes.status === 'fulfilled' ? screenRes.value.data || null : null);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    if (applicationId) fetchApplicationDetails();
  }, [applicationId, fetchApplicationDetails]);

  // Hỏi lại trạng thái lượt phân tích cho tới khi worker chạy xong. Chỉ phụ thuộc CỜ running
  // (không phải cả object screening) để mỗi lần hỏi không dựng lại interval — nếu không, nhịp
  // hỏi bị reset liên tục và có thể không bao giờ tới hạn.
  const isScreeningRunning = !!screening?.running;
  useEffect(() => {
    if (!isScreeningRunning) return undefined;

    const timer = setInterval(async () => {
      try {
        const res = await cvAPI.getScreening(applicationId);
        setScreening(res.data);
      } catch {
        // Mạng chập chờn giữa chừng: bỏ qua lượt hỏi này, lượt sau hỏi lại.
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [isScreeningRunning, applicationId]);

  // Bắt đầu (hoặc chạy lại) một lượt phân tích. Backend trả 202 ngay, worker nền mới gọi AI.
  const handleRequestScreening = async () => {
    setRequestingScreening(true);
    try {
      const res = await cvAPI.requestScreening(applicationId);
      setScreening(res.data);
    } catch (error) {
      console.error('Error requesting CV screening:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể bắt đầu phân tích CV');
    } finally {
      setRequestingScreening(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('vi-VN');
  };

  const handleOpenCv = async () => {
    try {
      const response = await cvAPI.getCvFileUrl(application.cvId);
      const url = response.data?.url;
      if (url) window.open(url, '_blank', 'noopener');
      else message.error('CV không có file gốc');
    } catch (error) {
      console.error('Error opening CV:', error);
      message.error('Không thể mở file CV');
    }
  };

  // Phát magic link STATUS — backend tự gửi email cho ứng viên (best-effort)
  const handleSendStatusLink = async () => {
    setSendingLink(true);
    try {
      await applicationAPI.createMagicLink(applicationId, 'STATUS');
      message.success('Đã phát link theo dõi trạng thái — email tự gửi đến ứng viên (nếu SMTP đã cấu hình).');
    } catch (error) {
      console.error('Error issuing magic link:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể phát magic link');
    } finally {
      setSendingLink(false);
    }
  };

  // Từ chối hồ sơ — modal hỏi lý do (tùy chọn) rồi gọi applicationAPI.reject.
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const handleReject = async () => {
    setRejecting(true);
    try {
      await applicationAPI.reject(applicationId, rejectReason.trim());
      message.success('Đã từ chối hồ sơ — email thông báo (nếu có template REJECTED) sẽ tự gửi.');
      setRejectModalOpen(false);
      setRejectReason('');
      fetchApplicationDetails();
    } catch (error) {
      console.error('Error rejecting:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể từ chối hồ sơ');
    } finally {
      setRejecting(false);
    }
  };

  // ----- Bản phân tích CV ↔ JD do AI sinh (tab CV) -----
  const screeningResult = screening?.result;
  const decisionMeta = SCREENING_DECISIONS[screeningResult?.decision] || null;

  const renderScreening = () => {
    if (!application?.cvId) return null;

    return (
      <div className="cv-screening">
        <Divider />

        <Space align="center" wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space>
            <RobotOutlined style={{ color: MATCHA_GREEN }} />
            <Text strong>Đối chiếu CV với tin tuyển dụng</Text>
          </Space>
          <Button
            icon={<RobotOutlined />}
            onClick={handleRequestScreening}
            loading={requestingScreening || isScreeningRunning}
            disabled={isScreeningRunning}
          >
            {screeningResult ? 'Phân tích lại' : 'Phân tích bằng AI'}
          </Button>
        </Space>

        {isScreeningRunning && (
          <Alert
            style={{ marginTop: 12 }}
            type="info"
            showIcon
            icon={<Spin size="small" />}
            message="AI đang đọc CV và đối chiếu với tin tuyển dụng…"
            description="Việc này thường mất 30-90 giây. Bạn có thể rời trang và quay lại sau — kết quả được lưu lại."
          />
        )}

        {screening?.status === 'FAILED' && (
          <Alert
            style={{ marginTop: 12 }}
            type="warning"
            showIcon
            message="Chưa phân tích được CV này"
            description={screening.errorMessage || 'Vui lòng thử lại sau.'}
          />
        )}

        {!isScreeningRunning && !screeningResult && screening?.status !== 'FAILED' && (
          <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
            Chưa phân tích. Bấm nút trên để AI tóm tắt CV và chỉ ra ứng viên đạt / thiếu những
            yêu cầu nào của vị trí này.
          </Text>
        )}

        {screeningResult && (
          <div style={{ marginTop: 16 }}>
            <Space size={8} wrap style={{ marginBottom: 12 }}>
              {decisionMeta && <Tag color={decisionMeta.color}>{decisionMeta.label}</Tag>}
              {/* Điểm phù hợp: chỉ hiện ở ĐÂY, trong hồ sơ của một người. Cố ý không đưa lên
                  danh sách/Kanban để không ai xếp hạng ứng viên bằng con số máy chấm. */}
              <Tooltip title="Mức đáp ứng yêu cầu của tin tuyển dụng theo đánh giá của AI — con số tham khảo, không dùng để xếp hạng ứng viên">
                <Tag color={MATCHA_GREEN}>Mức phù hợp: {screeningResult.fitScore}/100</Tag>
              </Tooltip>
              {screening?.finishedAt && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Phân tích lúc {formatDateTime(screening.finishedAt)}
                </Text>
              )}
            </Space>

            <Text strong style={{ display: 'block' }}>Tóm tắt hồ sơ</Text>
            <Text style={{ whiteSpace: 'pre-wrap' }}>{screeningResult.summary}</Text>

            {screeningResult.decisionReason && (
              <div style={{ marginTop: 10 }}>
                <Text strong style={{ display: 'block' }}>Nhận định</Text>
                <Text style={{ whiteSpace: 'pre-wrap' }}>{screeningResult.decisionReason}</Text>
              </div>
            )}

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} md={12}>
                <Text strong>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} /> Đáp ứng
                  {` (${screeningResult.matched?.length || 0})`}
                </Text>
                {screeningResult.matched?.length ? (
                  screeningResult.matched.map((m, i) => (
                    <div key={`${m.requirement}-${i}`} style={{ marginTop: 8 }}>
                      <Text>{m.requirement}</Text>
                      {/* Câu trích từ CV — dây neo chống bịa. Người đọc kiểm chứng ngay tại
                          đây, không phải mở lại file PDF. Đừng bỏ đi cho gọn. */}
                      <div>
                        <Text type="secondary" italic style={{ fontSize: 12 }}>“{m.evidence}”</Text>
                      </div>
                    </div>
                  ))
                ) : (
                  <div><Text type="secondary">Không có yêu cầu nào đối chiếu được với CV.</Text></div>
                )}
              </Col>

              <Col xs={24} md={12}>
                <Text strong>
                  <MinusCircleOutlined style={{ color: '#faad14' }} /> Chưa thấy trong CV
                  {` (${screeningResult.missing?.length || 0})`}
                </Text>
                {screeningResult.missing?.length ? (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                    {screeningResult.missing.map((m, i) => (
                      <li key={`${m}-${i}`}><Text>{m}</Text></li>
                    ))}
                  </ul>
                ) : (
                  <div><Text type="secondary">CV đề cập tới mọi yêu cầu của tin tuyển dụng.</Text></div>
                )}
              </Col>
            </Row>

            <Alert
              style={{ marginTop: 16 }}
              type="info"
              showIcon
              message="Đây là gợi ý của AI, không phải quyết định"
              description={
                'Hệ thống không tự loại và không tự chuyển hồ sơ theo kết quả này. AI có thể đọc ' +
                'sót hoặc hiểu sai CV — hãy mở CV gốc đối chiếu trước khi quyết định.'
              }
            />
          </div>
        )}
      </div>
    );
  };

  const tabItems = [
    {
      key: 'resume',
      label: 'CV',
      children: (
        <Card className="resume-card" bordered={false}>
          <div className="resume-preview">
            <FileTextOutlined style={{ fontSize: 48, color: application?.cvId ? MATCHA_GREEN : '#ccc' }} />
            <Title level={4}>{application?.cvFileName || 'CV'}</Title>
            {application?.cvParseStatus && (
              <Tag color={application.cvParseStatus === 'PARSED' ? 'success' : 'default'} style={{ marginBottom: 12 }}>
                {application.cvParseStatus}
              </Tag>
            )}
            {application?.cvId ? (
              <Button type="primary" icon={<FileTextOutlined />} onClick={handleOpenCv}>
                Mở CV (link tạm ~1h)
              </Button>
            ) : (
              <Text type="secondary">Chưa có CV</Text>
            )}
          </div>

          {renderScreening()}
        </Card>
      ),
    },
    {
      key: 'interview',
      label: 'Phỏng Vấn',
      children: (
        <Card className="interviews-card" bordered={false}>
          {aggregates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <Text type="secondary">
                Chưa có phiếu chấm nào được nộp — điểm chỉ hiện sau khi người phỏng vấn nộp phiếu (blind review).
              </Text>
            </div>
          ) : (
            aggregates.map((agg) => {
              const round = brief?.rounds?.find((r) => r.scheduleId === agg.scheduleId);
              return (
                <div key={agg.scheduleId} style={{ marginBottom: 24 }}>
                  <Space size={8} wrap style={{ marginBottom: 10 }}>
                    <Text strong>Vòng {agg.roundNumber ?? 1}</Text>
                    {agg.scheduledAt && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <CalendarOutlined /> {formatDateTime(agg.scheduledAt)}
                      </Text>
                    )}
                    {/* % có trọng số, cùng công thức với phiếu chấm và màn quyết định của
                        trưởng bộ phận -> ba nơi luôn ra một con số. */}
                    <Tag color={MATCHA_GREEN}>
                      Điểm hội đồng: {Math.round(agg.panelWeightedPercent)}%
                      {agg.submittedInterviewers > 1 ? ` (TB ${agg.submittedInterviewers} người chấm)` : ''}
                    </Tag>
                  </Space>

                  <Table
                    size="small"
                    pagination={false}
                    rowKey="criteriaId"
                    dataSource={agg.criteria || []}
                    columns={[
                      { title: 'Tiêu chí', dataIndex: 'name', key: 'name' },
                      {
                        title: 'Điểm TB',
                        key: 'average',
                        width: 110,
                        render: (_, r) => <Text strong>{r.average}/{r.maxScore}</Text>,
                      },
                      {
                        title: (
                          <Tooltip title="Tiêu chí quan trọng hơn thì trọng số cao hơn và tính nặng hơn khi ra điểm tổng">
                            <span>Trọng số</span>
                          </Tooltip>
                        ),
                        dataIndex: 'weight',
                        key: 'weight',
                        width: 90,
                      },
                      {
                        // Hội đồng lệch nhau nhiều ở tiêu chí nào thì đánh dấu tiêu chí đó (5.7).
                        title: 'Đồng thuận',
                        key: 'consensus',
                        width: 130,
                        render: (_, r) => (
                          <ConsensusTag
                            stdDev={r.stdDev}
                            needsDiscussion={r.needsDiscussion}
                            scoreCount={(r.scores || []).filter((s) => s.score !== null && s.score !== undefined).length}
                          />
                        ),
                      },
                    ]}
                  />

                  {(agg.interviewerTotals || []).map((t) => {
                    const verdict = round?.verdicts?.find((v) => v.interviewerId === t.interviewerId);
                    return (
                      <div key={t.interviewerId} style={{ marginTop: 10 }}>
                        <Space size={8} wrap>
                          <Text strong>{t.interviewerName || `#${t.interviewerId}`}</Text>
                          <Tag>{Math.round(t.weightedPercent)}%</Tag>
                          {verdict?.recommendation && (
                            <Tag color={RECOMMENDATION_COLORS[verdict.recommendation] || 'default'}>
                              {RECOMMENDATION_LABELS[verdict.recommendation] || verdict.recommendation}
                            </Tag>
                          )}
                        </Space>
                        {verdict?.summary && (
                          <div>
                            <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{verdict.summary}</Text>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </Card>
      ),
    },
    {
      key: 'history',
      label: 'Lịch Sử',
      children: (
        <Card className="interviews-card" bordered={false}>
          {history.length > 0 ? (
            <Timeline
              items={history.map((log) => ({
                color: log.action === 'STATE_CHANGE' ? 'green' : 'blue',
                children: (
                  <div className="timeline-item">
                    <div className="timeline-header">
                      <Text strong>{actionLabel(log.action)}</Text>
                      {log.fromState && log.toState && (
                        <Tag>{stateLabel(log.fromState)} → {stateLabel(log.toState)}</Tag>
                      )}
                    </div>
                    {log.detail && <Text style={{ fontSize: 13 }}>{formatActivityDetail(log.detail)}</Text>}
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <CalendarOutlined /> {formatDateTime(log.createdAt)}
                        {log.actorEmail ? ` — ${log.actorEmail}` : ' — hệ thống/ứng viên'}
                      </Text>
                    </div>
                  </div>
                ),
              }))}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Text type="secondary">Chưa có lịch sử</Text>
            </div>
          )}
        </Card>
      ),
    },
    {
      key: 'notes',
      label: 'Ghi Chú',
      children: (
        <Card className="notes-card" bordered={false}>
          {notes.length > 0 ? (
            notes.map((note) => (
              <div key={note.noteId} className="note-item">
                <div className="note-header">
                  <Avatar size={32} style={{ backgroundColor: MATCHA_GREEN }}>
                    {(note.authorEmail || 'N')[0].toUpperCase()}
                  </Avatar>
                  <div className="note-meta">
                    <span className="note-author">{note.authorEmail || 'N/A'}</span>
                    <span className="note-date">{formatDateTime(note.createdAt)}</span>
                  </div>
                </div>
                <p className="note-content">{note.content}</p>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Text type="secondary">Chưa có ghi chú</Text>
            </div>
          )}
        </Card>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="candidate-detail-page">
      <div className="page-header">
        <Button onClick={() => navigate(-1)} className="back-btn" icon={<ArrowLeftOutlined />}>
          Quay Lại
        </Button>
        <Button icon={<ReloadOutlined />} onClick={fetchApplicationDetails} loading={loading}>
          Làm Mới
        </Button>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={8}>
          <Card className="profile-card" bordered={false}>
            <div className="profile-header">
              <Avatar size={100} style={{ backgroundColor: MATCHA_GREEN, fontSize: 40 }}>
                {(application?.candidateName || 'N')[0]}
              </Avatar>
              <Title level={3} className="profile-name">{application?.candidateName || 'N/A'}</Title>
              <Text type="secondary">{application?.jobTitle || 'N/A'}</Text>

              <div className="profile-tags">
                <ApplicationStateTag state={application?.currentState} />
              </div>
            </div>

            {application?.currentState === 'REJECTED' && application?.rejectReason && (
              <Alert
                type="error"
                showIcon
                style={{ marginTop: 12 }}
                message="Lý do từ chối"
                description={application.rejectReason}
              />
            )}

            <Divider />

            <div className="profile-contact">
              <div className="contact-item">
                <MailOutlined />
                <span>{application?.candidateEmail || 'N/A'}</span>
              </div>
              {application?.candidatePhone && (
                <div className="contact-item">
                  <PhoneOutlined />
                  <span>{application.candidatePhone}</span>
                </div>
              )}
              <div className="contact-item">
                <CalendarOutlined />
                <span>Ứng tuyển: {formatDate(application?.appliedAt)}</span>
              </div>
              {application?.candidateSource && (
                <div className="contact-item">
                  <LinkOutlined />
                  <span>Nguồn: {application.candidateSource}</span>
                </div>
              )}
            </div>

            <Divider />

            <Space direction="vertical" style={{ width: '100%' }}>
              <Tooltip title="Gửi cho ứng viên đường dẫn tự tra cứu tình trạng hồ sơ — họ không cần tài khoản">
                <Button block icon={<LinkOutlined />} onClick={handleSendStatusLink} loading={sendingLink}>
                  Gửi link theo dõi trạng thái
                </Button>
              </Tooltip>
              <Button
                block
                icon={<CalendarOutlined />}
                type="primary"
                className="schedule-btn"
                // Mang theo job của chính hồ sơ này — không có nó thì trang lịch mở ở vị trí
                // ĐẦU DANH SÁCH, người dùng phải tự đi tìm lại đúng job vừa đứng.
                onClick={() =>
                  navigate(
                    application?.jobId
                      ? `/interviews/schedule?jobId=${application.jobId}`
                      : '/interviews/schedule'
                  )
                }
              >
                Lên Lịch Phỏng Vấn
              </Button>
              {/* Cửa loại có người gác riêng từng chặng (siết 17/08/2026): nhân sự loại được ở
                  bước Hồ sơ mới, Trưởng bộ phận ở bước Sàng lọc, Giám đốc từ Phỏng vấn trở đi.
                  Không đủ quyền thì vẫn hiện nút nhưng khoá + nói rõ phải hỏi ai. */}
              {canRejectAtState(role, application?.currentState) ? (
                <Button
                  block
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setRejectModalOpen(true)}
                >
                  Từ chối hồ sơ
                </Button>
              ) : rejectOwnerLabel(application?.currentState) ? (
                <Tooltip title={`Ở bước này, chỉ ${rejectOwnerLabel(application.currentState)} mới được loại ứng viên.`}>
                  <Button block danger disabled icon={<CloseCircleOutlined />}>
                    Từ chối hồ sơ
                  </Button>
                </Tooltip>
              ) : null}
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card className="content-card" bordered={false}>
            <Tabs items={tabItems} />
          </Card>
        </Col>
      </Row>

      <Modal
        title={<Space><CloseCircleOutlined style={{ color: '#ff4d4f' }} />Từ chối hồ sơ</Space>}
        open={rejectModalOpen}
        onCancel={() => { setRejectModalOpen(false); setRejectReason(''); }}
        onOk={handleReject}
        confirmLoading={rejecting}
        okText="Từ chối"
        okButtonProps={{ danger: true }}
        cancelText="Hủy"
      >
        <Typography.Paragraph type="secondary">
          Hồ sơ của <Text strong>{application?.candidateName}</Text> sẽ chuyển sang trạng thái
          <Tag color="red" style={{ marginLeft: 6 }}>Từ chối</Tag>
          và ứng viên sẽ nhận email thông báo (nếu có template REJECTED đang hoạt động).
        </Typography.Paragraph>
        <Typography.Paragraph>
          Lý do từ chối (không bắt buộc, hiển thị cho cả team và ứng viên):
        </Typography.Paragraph>
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="VD: Chưa đáp ứng yêu cầu Java Spring Boot ≥ 3 năm..."
          maxLength={500}
          showCount
        />
      </Modal>
    </div>
  );
};

export default CandidateDetail;
