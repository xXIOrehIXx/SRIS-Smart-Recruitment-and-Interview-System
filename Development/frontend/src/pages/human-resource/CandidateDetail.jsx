import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Row, Col, Card, Typography, Avatar, Tag, Button, Tabs, Timeline,
  Space, Divider, Spin, message, Tooltip, Alert,
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
  BulbOutlined
} from '@ant-design/icons';
import { applicationAPI, cvAPI } from '../../services/api';
import ApplicationStateTag, { stateLabel } from '../../components/ApplicationStateTag';
import './css/CandidateDetail.css';

const { Title, Text } = Typography;

const MATCHA_GREEN = '#5D8C3E';

// Nhãn + màu trạng thái dùng chung toàn app: components/ApplicationStateTag.jsx

/**
 * Chi tiết 1 hồ sơ (ApplicationDetailDto): thông tin ứng viên, CV kèm tóm tắt do AI sinh,
 * lịch sử audit, ghi chú nội bộ.
 *
 * KHÔNG có điểm số hay xếp hạng: hệ thống không chấm CV thay người tuyển dụng. Tóm tắt CV
 * chỉ rút gọn nội dung để đọc lướt — người dùng tự đối chiếu với JD và tự quyết.
 */
const CandidateDetail = () => {
  const { id: applicationId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [history, setHistory] = useState([]);
  const [notes, setNotes] = useState([]);
  const [sendingLink, setSendingLink] = useState(false);
  // Tóm tắt CV: đọc bản đã lưu lúc mở trang (không gọi AI), sinh mới khi người dùng bấm nút.
  const [cvSummary, setCvSummary] = useState(null);
  const [summarizing, setSummarizing] = useState(false);

  const fetchApplicationDetails = useCallback(async () => {
    try {
      setLoading(true);
      const [appRes, historyRes, notesRes] = await Promise.allSettled([
        applicationAPI.getById(applicationId),
        applicationAPI.getHistory(applicationId),
        applicationAPI.getNotes(applicationId),
      ]);

      if (appRes.status === 'fulfilled') setApplication(appRes.value.data);
      else message.error('Không thể tải thông tin ứng viên');
      setHistory(historyRes.status === 'fulfilled' ? historyRes.value.data || [] : []);
      setNotes(notesRes.status === 'fulfilled' ? notesRes.value.data || [] : []);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    if (applicationId) fetchApplicationDetails();
  }, [applicationId, fetchApplicationDetails]);

  // Tóm tắt là phần phụ: hỏng thì bỏ qua, phần còn lại của hồ sơ vẫn hiện bình thường.
  useEffect(() => {
    const cvId = application?.cvId;
    if (!cvId) return;
    let cancelled = false;
    cvAPI.getSummary(cvId)
      .then((res) => { if (!cancelled) setCvSummary(res.data || null); })
      .catch(() => { /* không có tóm tắt thì thôi */ });
    return () => { cancelled = true; };
  }, [application?.cvId]);

  const handleSummarizeCv = async () => {
    try {
      setSummarizing(true);
      const res = await cvAPI.generateSummary(application.cvId);
      setCvSummary(res.data || null);
    } catch (error) {
      console.error('Error summarizing CV:', error);
      message.error(error?.response?.data?.userMsg || 'Không tóm tắt được CV');
    } finally {
      setSummarizing(false);
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

          {/* Tóm tắt CV — rút gọn để đọc lướt, KHÔNG phải điểm số hay đánh giá.
              Người tuyển dụng tự đối chiếu với tin tuyển dụng và tự quyết. */}
          {application?.cvId && cvSummary?.canSummarize && (
            <div className="cv-summary">
              <Divider orientation="left" plain style={{ marginTop: 8 }}>
                Tóm tắt CV
              </Divider>

              {cvSummary.highlights?.length > 0 ? (
                <>
                  <ul style={{ paddingLeft: 20, marginBottom: 8 }}>
                    {cvSummary.highlights.map((line, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>{line}</li>
                    ))}
                  </ul>
                  <Space size="small" wrap>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      AI rút gọn nội dung CV — không phải đánh giá ứng viên, và có thể chép
                      sai chi tiết. Cần chắc chắn thì mở CV gốc.
                      {cvSummary.generatedAt && ` Tạo lúc ${formatDateTime(cvSummary.generatedAt)}.`}
                    </Text>
                    <Button
                      size="small"
                      type="link"
                      icon={<ReloadOutlined />}
                      loading={summarizing}
                      onClick={handleSummarizeCv}
                    >
                      Tóm tắt lại
                    </Button>
                  </Space>
                </>
              ) : (
                <Space direction="vertical" size="small">
                  <Text type="secondary">
                    Chưa có tóm tắt. Bấm để AI rút gọn CV thành vài ý chính, khỏi phải mở file.
                  </Text>
                  <Button
                    icon={<BulbOutlined />}
                    loading={summarizing}
                    onClick={handleSummarizeCv}
                  >
                    Tóm tắt bằng AI
                  </Button>
                </Space>
              )}
            </div>
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
                      <Text strong>{log.action}</Text>
                      {log.fromState && log.toState && (
                        <Tag>{stateLabel(log.fromState)} → {stateLabel(log.toState)}</Tag>
                      )}
                    </div>
                    {log.detail && <Text style={{ fontSize: 13 }}>{log.detail}</Text>}
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
                onClick={() => navigate('/interviews/schedule')}
              >
                Lên Lịch Phỏng Vấn
              </Button>
              {application?.currentState !== 'REJECTED' && application?.currentState !== 'HIRED' && (
                <Button
                  block
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setRejectModalOpen(true)}
                >
                  Từ chối hồ sơ
                </Button>
              )}
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
