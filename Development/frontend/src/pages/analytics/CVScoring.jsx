import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, Tag, Select, Upload, message, Progress, Row, Col, Statistic, Avatar, Space, Modal, Tabs, Spin, Empty, Input } from 'antd';
import {
  UploadOutlined, FileTextOutlined, TrophyOutlined, StarOutlined,
  ReloadOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined,
  InboxOutlined, UserOutlined, TeamOutlined
} from '@ant-design/icons';
import { cvScoringAPI, jobsAPI, criteriaAPI } from '../../services/api';
import './css/CVScoring.css';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const MATCHA_GREEN = '#5D8C3E';

const CVScoring = () => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [selectedCV, setSelectedCV] = useState(null);
  const [cvDetailOpen, setCvDetailOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (selectedJob) {
      fetchRanking(selectedJob);
    }
  }, [selectedJob]);

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      setJobs(response.data || []);
      if (response.data?.length > 0) {
        setSelectedJob(response.data[0].jobId);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const fetchRanking = async (jobId) => {
    try {
      setLoading(true);
      const response = await cvScoringAPI.getRanking(jobId);
      setRanking(response.data || []);
    } catch (error) {
      console.error('Error fetching ranking:', error);
      setRanking([]);
    } finally {
      setLoading(false);
    }
  };

  const resetUploadModal = () => {
    setUploadModalOpen(false);
    setFile(null);
    setCandidateName('');
    setCandidateEmail('');
    setCandidatePhone('');
  };

  const handleUploadCV = async () => {
    if (!file || !selectedJob) {
      message.error('Vui lòng chọn file CV và vị trí');
      return;
    }
    if (!candidateName.trim() || !candidateEmail.trim()) {
      message.error('Vui lòng nhập tên và email ứng viên');
      return;
    }
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('jobId', selectedJob);
      formData.append('candidateName', candidateName.trim());
      formData.append('candidateEmail', candidateEmail.trim());
      if (candidatePhone.trim()) formData.append('candidatePhone', candidatePhone.trim());
      await cvScoringAPI.uploadCV(formData);
      message.success('Đã nhận CV — hệ thống đang chấm điểm nền, bấm Làm mới để cập nhật.');
      resetUploadModal();
      fetchRanking(selectedJob);
    } catch (error) {
      console.error('Error uploading CV:', error);
      message.error(error?.response?.data?.error || 'Không thể upload CV. Vui lòng thử lại.');
    } finally {
      setUploading(false);
    }
  };

  // Mở file CV gốc (presigned URL ~1h) trong tab mới
  const handleOpenCvFile = async (cvId) => {
    try {
      const response = await cvScoringAPI.getCvFileUrl(cvId);
      const url = response.data?.url;
      if (url) window.open(url, '_blank', 'noopener');
      else message.error('CV không có file gốc');
    } catch (error) {
      console.error('Error fetching CV file url:', error);
      message.error('Không thể mở file CV');
    }
  };

  // Chi tiết = kết quả chấm theo TỪNG tiêu chí (khớp/thiếu + bằng chứng)
  const handleViewCV = async (record) => {
    try {
      const response = await criteriaAPI.getCriteriaMatches(record.applicationId);
      const matches = response.data || [];
      setSelectedCV({
        ...record,
        matchedSkills: matches.filter(m => m.matched).map(m => m.name),
        missingSkills: matches.filter(m => !m.matched).map(m => m.name),
        evaluation: matches.map(m => ({
          name: m.name,
          score: m.similarity != null ? Math.round(m.similarity * 100) : (m.matched ? 100 : 0),
          feedback: m.evidence,
        })),
      });
      setCvDetailOpen(true);
    } catch (error) {
      console.error('Error fetching criteria matches:', error);
      // Job chưa có tiêu chí — vẫn mở modal với điểm tổng
      setSelectedCV({ ...record, matchedSkills: [], missingSkills: [], evaluation: [] });
      setCvDetailOpen(true);
    }
  };

  const getScoreColor = (score) => {
    if (score === null || score === undefined) return '#d9d9d9';
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#faad14';
    return '#f5222d';
  };

  const getRankStyle = (index) => {
    if (index === 0) return { background: 'linear-gradient(135deg, #ffd700, #ffb800)', color: '#7a5500', fontWeight: 700 };
    if (index === 1) return { background: 'linear-gradient(135deg, #c0c0c0, #a8a8a8)', color: '#4a4a4a', fontWeight: 700 };
    if (index === 2) return { background: 'linear-gradient(135deg, #cd7f32, #b87333)', color: '#fff', fontWeight: 700 };
    return {};
  };

  const columns = [
    {
      title: 'Hạng',
      key: 'rank',
      width: 80,
      render: (_, __, index) => (
        <div style={{
          width: 32, height: 32, borderRadius: '50%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', ...getRankStyle(index)
        }}>
          {index + 1}
        </div>
      ),
    },
    {
      title: 'Ứng viên',
      key: 'candidate',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 600 }}>{record.candidateName || record.name || 'N/A'}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.email || ''}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Kỹ năng',
      key: 'skills',
      width: 240,
      render: (_, record) => {
        const matched = record.matchedSkills || record.skills?.matched || [];
        const missing = record.missingSkills || record.skills?.missing || [];
        return (
          <div>
            {matched.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                {matched.slice(0, 3).map((s, i) => (
                  <Tag key={i} color="green" style={{ marginBottom: 2 }}>{s}</Tag>
                ))}
                {matched.length > 3 && <Tag>+{matched.length - 3}</Tag>}
              </div>
            )}
            {missing.length > 0 && (
              <div>
                {missing.slice(0, 2).map((s, i) => (
                  <Tag key={i} color="red" style={{ marginBottom: 2 }}>{s}</Tag>
                ))}
                {missing.length > 2 && <Tag>+{missing.length - 2}</Tag>}
              </div>
            )}
            {matched.length === 0 && missing.length === 0 && <Text type="secondary">--</Text>}
          </div>
        );
      },
    },
    {
      title: 'Điểm AI',
      key: 'score',
      width: 140,
      render: (_, record) => {
        const score = record.aiScore || record.score || record.matchScore;
        const color = getScoreColor(score);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Progress
              type="circle"
              percent={score ?? 0}
              size={44}
              strokeColor={color}
              format={(p) => <span style={{ fontSize: 11, fontWeight: 700 }}>{p}</span>}
            />
          </div>
        );
      },
      sorter: (a, b) => (a.aiScore || a.score || 0) - (b.aiScore || b.score || 0),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 120,
      render: (_, record) => {
        const status = record.status || 'SCORED';
        const config = {
          SCORED: { color: 'green', label: 'Đã chấm' },
          PENDING: { color: 'warning', label: 'Đang chấm' },
          FAILED: { color: 'error', label: 'Thất bại' },
        };
        const c = config[status] || { color: 'default', label: status };
        return <Tag color={c.color} icon={c.color === 'green' ? <CheckCircleOutlined /> : null}>{c.label}</Tag>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleViewCV(record)}
          >
            Chi tiết
          </Button>
          <Button
            type="text"
            icon={<FileTextOutlined />}
            onClick={() => handleOpenCvFile(record.cvId)}
          >
            Mở CV
          </Button>
        </Space>
      ),
    },
  ];

  const topCandidates = ranking.slice(0, 3);

  return (
    <div className="cv-scoring-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Chấm Điểm CV</Title>
          <Text type="secondary">Sử dụng AI để chấm điểm và xếp hạng ứng viên theo mức độ phù hợp</Text>
        </div>
        <Space>
          <Select
            placeholder="Chọn vị trí"
            value={selectedJob}
            onChange={(val) => setSelectedJob(val)}
            style={{ width: 240 }}
            showSearch
            filterOption={(input, option) =>
              (option.label || '').toLowerCase().includes(input.toLowerCase())
            }
            options={jobs.map(job => ({ value: job.id, label: job.title }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchRanking(selectedJob)} loading={loading}>
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => setUploadModalOpen(true)}
            style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
          >
            Upload CV
          </Button>
        </Space>
      </div>

      {topCandidates.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {topCandidates.map((candidate, idx) => {
            const colors = ['#ffd700', '#c0c0c0', '#cd7f32'];
            const bgColors = ['rgba(255,215,0,0.12)', 'rgba(192,192,192,0.12)', 'rgba(205,127,50,0.12)'];
            return (
              <Col xs={24} sm={8} key={idx}>
                <Card className="top-card" bordered={false} style={{ background: bgColors[idx], border: `2px solid ${colors[idx]}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', background: colors[idx],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, color: '#fff', fontSize: 18, flexShrink: 0
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{candidate.candidateName || 'N/A'}</div>
                      <div style={{ fontSize: 12, color: '#8c8c8b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {candidate.email || ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <TrophyOutlined style={{ color: colors[idx], fontSize: 20 }} />
                      <div style={{ fontWeight: 800, fontSize: 18, color: getScoreColor(candidate.aiScore || candidate.score) }}>
                        {candidate.aiScore || candidate.score || 0}%
                      </div>
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <Card className="main-card" bordered={false}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}><Text type="secondary">Đang chấm điểm CV...</Text></div>
          </div>
        ) : ranking.length > 0 ? (
          <Table
            columns={columns}
            dataSource={ranking}
            rowKey="applicationId"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} ứng viên`,
            }}
            scroll={{ x: 900 }}
          />
        ) : (
          <Empty
            image={<InboxOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
            description={
              <div>
                <Text type="secondary">Chưa có dữ liệu xếp hạng</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>Upload CV hoặc chọn vị trí để xem xếp hạng</Text>
              </div>
            }
          />
        )}
      </Card>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UploadOutlined style={{ color: MATCHA_GREEN }} />
            Upload CV để chấm điểm
          </div>
        }
        open={uploadModalOpen}
        onCancel={resetUploadModal}
        footer={null}
        width={480}
      >
        <div style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <Text strong>Vị trí:</Text>{' '}
            <Select
              value={selectedJob}
              onChange={setSelectedJob}
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Chọn vị trí"
              showSearch
              options={jobs.map(job => ({ value: job.jobId, label: job.title }))}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <Text strong>Tên ứng viên: <Text type="danger">*</Text></Text>
            <Input
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="Nguyễn Văn A"
              style={{ marginTop: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <Text strong>Email ứng viên: <Text type="danger">*</Text></Text>
            <Input
              value={candidateEmail}
              onChange={(e) => setCandidateEmail(e.target.value)}
              placeholder="email@example.com"
              style={{ marginTop: 8 }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Text strong>Số điện thoại (tùy chọn):</Text>
            <Input
              value={candidatePhone}
              onChange={(e) => setCandidatePhone(e.target.value)}
              placeholder="09xxxxxxxx"
              style={{ marginTop: 8 }}
            />
          </div>

          <Dragger
            name="file"
            maxCount={1}
            accept=".pdf"
            beforeUpload={(f) => {
              if (!f.name.toLowerCase().endsWith('.pdf')) {
                message.error('Backend chỉ chấp nhận file PDF!');
                return Upload.LIST_IGNORE;
              }
              setFile(f);
              return false;
            }}
            fileList={file ? [file] : []}
            onRemove={() => setFile(null)}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: MATCHA_GREEN }} />
            </p>
            <p className="ant-upload-text">Click hoặc kéo file vào đây</p>
            <p className="ant-upload-hint">Chỉ hỗ trợ PDF (tối đa 20MB)</p>
          </Dragger>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button onClick={resetUploadModal}>Hủy</Button>
            <Button
              type="primary"
              onClick={handleUploadCV}
              loading={uploading}
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
              disabled={!file || !selectedJob || !candidateName.trim() || !candidateEmail.trim()}
            >
              {uploading ? 'Đang chấm...' : 'Upload & Chấm điểm'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextOutlined style={{ color: MATCHA_GREEN }} />
            Chi tiết CV
          </div>
        }
        open={cvDetailOpen}
        onCancel={() => { setCvDetailOpen(false); setSelectedCV(null); }}
        footer={null}
        width={600}
      >
        {selectedCV && (
          <div style={{ marginTop: 20 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Avatar size={64} style={{ backgroundColor: MATCHA_GREEN, marginBottom: 12 }} icon={<UserOutlined />} />
              <Title level={4} style={{ margin: 0 }}>{selectedCV.candidateName || 'N/A'}</Title>
              <Text type="secondary">{selectedCV.email || ''}</Text>
            </div>

            <Tabs
              items={[
                {
                  key: 'overview',
                  label: 'Tổng quan',
                  children: (
                    <div>
                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Card size="small" bordered={false} style={{ background: '#f5f5f4' }}>
                            <Statistic
                              title="Điểm tổng"
                              value={selectedCV.score ?? selectedCV.totalScore ?? selectedCV.aiScore ?? 0}
                              suffix="%"
                              valueStyle={{ color: getScoreColor(selectedCV.score ?? selectedCV.totalScore), fontSize: 28 }}
                              prefix={<TrophyOutlined />}
                            />
                          </Card>
                        </Col>
                        <Col span={12}>
                          <Card size="small" bordered={false} style={{ background: '#f5f5f4' }}>
                            <Statistic
                              title="Kỹ năng khớp"
                              value={selectedCV.matchedSkillsCount || (selectedCV.matchedSkills || []).length}
                              suffix={`/ ${selectedCV.totalSkillsCount || (selectedCV.matchedSkills || []).length + (selectedCV.missingSkills || []).length}`}
                              valueStyle={{ fontSize: 28 }}
                              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                            />
                          </Card>
                        </Col>
                      </Row>

                      {(selectedCV.matchedSkills || []).length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <Text strong style={{ color: '#52c41a' }}>Kỹ năng khớp:</Text>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                            {(selectedCV.matchedSkills || []).map((s, i) => (
                              <Tag key={i} color="green" icon={<CheckCircleOutlined />}>{s}</Tag>
                            ))}
                          </div>
                        </div>
                      )}

                      {(selectedCV.missingSkills || []).length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <Text strong style={{ color: '#f5222d' }}>Kỹ năng thiếu:</Text>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                            {(selectedCV.missingSkills || []).map((s, i) => (
                              <Tag key={i} color="red" icon={<CloseCircleOutlined />}>{s}</Tag>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'details',
                  label: 'Đánh giá chi tiết',
                  children: (
                    <div>
                      {(selectedCV.evaluation || selectedCV.scores || []).map((item, idx) => (
                        <div key={idx} style={{ marginBottom: 16, padding: 12, background: '#f5f5f4', borderRadius: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text strong>{item.criterion || item.name}</Text>
                            <Text style={{ color: getScoreColor(item.score) }}>{item.score}/100</Text>
                          </div>
                          <Progress percent={item.score} strokeColor={getScoreColor(item.score)} showInfo={false} />
                          {item.feedback && <Text type="secondary" style={{ fontSize: 12 }}>{item.feedback}</Text>}
                        </div>
                      ))}
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CVScoring;
