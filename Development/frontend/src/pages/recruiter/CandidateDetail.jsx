import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Row, Col, Card, Typography, Avatar, Tag, Button, Tabs, Timeline,
  Space, Divider, Spin, message, Table, Tooltip, Statistic, Empty, Alert
} from 'antd';
import {
  ArrowLeftOutlined,
  MailOutlined,
  PhoneOutlined,
  CalendarOutlined,
  FileTextOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LinkOutlined,
  ThunderboltOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { applicationAPI, criteriaAPI, cvScoringAPI } from '../../services/api';
import './css/CandidateDetail.css';

const { Title, Text } = Typography;

const MATCHA_GREEN = '#5D8C3E';

const STAGE_LABELS = {
  NEW: 'Hồ Sơ Mới', SCREENING: 'Sàng Lọc', INTERVIEW: 'Phỏng Vấn',
  OFFER: 'Offer', HIRED: 'Đã Tuyển', REJECTED: 'Từ Chối',
};
const STAGE_COLORS = {
  NEW: 'blue', SCREENING: 'purple', INTERVIEW: 'orange',
  OFFER: 'green', HIRED: 'success', REJECTED: 'red',
};

/**
 * Chi tiết 1 hồ sơ (ApplicationDetailDto) — màn sàng lọc của Recruiter:
 * điểm cả-CV + điểm theo tiêu chí, bảng khớp/thiếu TỪNG tiêu chí kèm câu bằng chứng
 * (docs 5.18 — không ném cả JD↔CV lấy 1 con số), lịch sử audit, ghi chú nội bộ.
 */
const CandidateDetail = () => {
  const { id: applicationId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [history, setHistory] = useState([]);
  const [notes, setNotes] = useState([]);
  const [matches, setMatches] = useState([]);
  const [rescoring, setRescoring] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);

  const fetchApplicationDetails = useCallback(async () => {
    try {
      setLoading(true);
      const [appRes, historyRes, notesRes, matchesRes] = await Promise.allSettled([
        applicationAPI.getById(applicationId),
        applicationAPI.getHistory(applicationId),
        applicationAPI.getNotes(applicationId),
        criteriaAPI.getCriteriaMatches(applicationId),
      ]);

      if (appRes.status === 'fulfilled') setApplication(appRes.value.data);
      else message.error('Không thể tải thông tin ứng viên');
      setHistory(historyRes.status === 'fulfilled' ? historyRes.value.data || [] : []);
      setNotes(notesRes.status === 'fulfilled' ? notesRes.value.data || [] : []);
      setMatches(matchesRes.status === 'fulfilled' ? matchesRes.value.data || [] : []);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    if (applicationId) fetchApplicationDetails();
  }, [applicationId, fetchApplicationDetails]);

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
      const response = await cvScoringAPI.getCvFileUrl(application.cvId);
      const url = response.data?.url;
      if (url) window.open(url, '_blank', 'noopener');
      else message.error('CV không có file gốc');
    } catch (error) {
      console.error('Error opening CV:', error);
      message.error('Không thể mở file CV');
    }
  };

  // Chấm lại theo bộ tiêu chí hiện tại (sau khi duyệt/sửa tiêu chí của job)
  const handleRescore = async () => {
    setRescoring(true);
    try {
      const response = await criteriaAPI.rescoreCriteria(applicationId);
      setMatches(response.data || []);
      message.success('Đã chấm lại theo bộ tiêu chí hiện tại.');
      // criteriaScore tổng thay đổi -> nạp lại hồ sơ
      const appRes = await applicationAPI.getById(applicationId);
      setApplication(appRes.data);
    } catch (error) {
      console.error('Error rescoring:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể chấm lại (job có thể chưa có tiêu chí đã duyệt).');
    } finally {
      setRescoring(false);
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

  const matchColumns = [
    {
      title: 'Tiêu chí',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space size={6}>
          <Text strong>{name}</Text>
          {record.type === 'HARD'
            ? <Tag color="volcano" style={{ fontSize: 11 }}>HARD</Tag>
            : <Tag color="geekblue" style={{ fontSize: 11 }}>SOFT</Tag>}
        </Space>
      ),
    },
    {
      title: 'Kết quả',
      dataIndex: 'matched',
      key: 'matched',
      width: 110,
      render: (matched) => matched
        ? <Tag icon={<CheckCircleOutlined />} color="success">Khớp</Tag>
        : <Tag icon={<CloseCircleOutlined />} color="error">Thiếu</Tag>,
      filters: [{ text: 'Khớp', value: true }, { text: 'Thiếu', value: false }],
      onFilter: (value, record) => record.matched === value,
    },
    {
      title: 'Độ tương đồng',
      dataIndex: 'similarity',
      key: 'similarity',
      width: 130,
      render: (sim, record) => record.type === 'HARD'
        ? <Text type="secondary">— (lọc rule)</Text>
        : (sim != null ? <Text strong>{Math.round(sim * 100)}%</Text> : <Text type="secondary">—</Text>),
    },
    { title: 'Trọng số', dataIndex: 'weight', key: 'weight', width: 90 },
    {
      title: 'Bằng chứng trong CV',
      dataIndex: 'evidence',
      key: 'evidence',
      render: (evidence) => evidence
        ? <Text italic style={{ fontSize: 13 }}>"{evidence}"</Text>
        : <Text type="secondary">—</Text>,
    },
  ];

  const tabItems = [
    {
      key: 'criteria',
      label: <span><RobotOutlined /> Đánh giá theo tiêu chí</span>,
      children: (
        <Card className="info-card" bordered={false}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <Space size={24}>
              <Statistic
                title="Điểm cả CV (AI)"
                value={application?.aiMatchScore != null ? Math.round(application.aiMatchScore) : '—'}
                suffix={application?.aiMatchScore != null ? '%' : ''}
                valueStyle={{ color: MATCHA_GREEN, fontSize: 24 }}
              />
              <Statistic
                title="Điểm theo tiêu chí"
                value={application?.criteriaScore != null ? Math.round(application.criteriaScore) : '—'}
                suffix={application?.criteriaScore != null ? '%' : ''}
                valueStyle={{ fontSize: 24 }}
              />
            </Space>
            <Tooltip title="Chấm lại hồ sơ này theo bộ tiêu chí hiện tại của job (dùng sau khi duyệt/sửa tiêu chí)">
              <Button icon={<ThunderboltOutlined />} onClick={handleRescore} loading={rescoring}>
                Chấm lại theo tiêu chí
              </Button>
            </Tooltip>
          </div>

          {matches.length > 0 ? (
            <Table
              columns={matchColumns}
              dataSource={matches}
              rowKey="criteriaId"
              pagination={false}
              size="small"
            />
          ) : (
            <Empty
              description={
                <div>
                  <Text type="secondary">Chưa có kết quả chấm theo tiêu chí</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Job cần có bộ tiêu chí ĐÃ DUYỆT (trang Tiêu Chí Đánh Giá), sau đó bấm "Chấm lại theo tiêu chí"
                  </Text>
                </div>
              }
            />
          )}
        </Card>
      ),
    },
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
                        <Tag>{STAGE_LABELS[log.fromState] || log.fromState} → {STAGE_LABELS[log.toState] || log.toState}</Tag>
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
                <Tag color={STAGE_COLORS[application?.currentState] || 'default'}>
                  {STAGE_LABELS[application?.currentState] || application?.currentState || 'N/A'}
                </Tag>
                {application?.aiMatchScore != null && (
                  <Tag color={application.aiMatchScore >= 80 ? 'success' : 'warning'}>
                    AI: {Math.round(application.aiMatchScore)}%
                  </Tag>
                )}
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
              <Tooltip title="Phát magic link STATUS — ứng viên tự xem trạng thái hồ sơ, không cần tài khoản">
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
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card className="content-card" bordered={false}>
            <Tabs items={tabItems} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CandidateDetail;
