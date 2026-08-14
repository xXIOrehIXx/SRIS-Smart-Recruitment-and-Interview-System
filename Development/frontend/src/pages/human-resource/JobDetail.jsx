import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Row, Col, Card, Button, Tag, Typography, Descriptions, Tabs, Table, Avatar, Progress, Space, Modal, Select, DatePicker, Spin, message, Input } from 'antd';
import { 
  EditOutlined, 
  ShareAltOutlined, 
  ClockCircleOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  UserAddOutlined,
  MailOutlined,
  ArrowLeftOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { jobsAPI, applicationAPI } from '../../services/api';
import ApplicationStateTag from '../../components/ApplicationStateTag';
import './css/JobDetail.css';

const { Title, Text, Paragraph } = Typography;

const MATCHA_GREEN = '#5D8C3E';

const JobDetail = () => {
  const { id: jobId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);

  // Reject per-row từ danh sách ứng viên
  const [rejectTarget, setRejectTarget] = useState(null); // { id, name } | null
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const promptReject = (record) => {
    setRejectTarget({ id: record.id, name: record.fullName || record.name || 'N/A' });
    setRejectReason('');
  };
  const cancelReject = () => {
    setRejectTarget(null);
    setRejectReason('');
  };
  const submitReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      await applicationAPI.reject(rejectTarget.id, rejectReason.trim());
      message.success(`Đã từ chối ${rejectTarget.name}`);
      cancelReject();
      fetchApplications();
    } catch (err) {
      console.error('Error rejecting:', err);
      message.error(err?.response?.data?.userMsg || 'Không thể từ chối');
    } finally {
      setRejecting(false);
    }
  };

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
      fetchApplications();
    }
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      const response = await jobsAPI.getById(jobId);
      setJob(response.data);
    } catch (error) {
      console.error('Error fetching job details:', error);
      message.error('Không thể tải thông tin tin tuyển dụng');
    }
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await applicationAPI.getAll(jobId);
      // Backend trả ApplicationBoardDto: { jobId, applications: [ApplicationCardDto] }
      const cards = response.data?.applications || [];
      setApplications(cards.map(app => ({
        ...app,
        id: app.applicationId,
        fullName: app.candidateName,
        email: app.candidateEmail,
        state: app.currentState,
      })));
    } catch (error) {
      console.error('Error fetching applications:', error);
      message.error('Không thể tải danh sách ứng viên');
    } finally {
      setLoading(false);
    }
  };

  // Pipeline stats
  const getPipelineStats = () => {
    const stats = {
      Applied: 0,
      Screening: 0,
      Interview: 0,
      Offer: 0,
    };

    // 6 state nội bộ → 4 pha hiển thị (OFFER/HIRED gộp vào Quyết định, REJECTED không đếm)
    const STATE_TO_STAGE = {
      NEW: 'Applied', SCREENING: 'Screening', INTERVIEW: 'Interview',
      OFFER: 'Offer', HIRED: 'Offer',
    };
    applications.forEach(app => {
      const stageKey = STATE_TO_STAGE[app.state];
      if (stageKey) {
        stats[stageKey]++;
      }
    });

    return [
      { stage: 'Đã Ứng Tuyển', count: stats.Applied, color: '#1890ff' },
      { stage: 'Sàng Lọc', count: stats.Screening, color: '#722ed1' },
      { stage: 'Phỏng Vấn', count: stats.Interview, color: '#faad14' },
      { stage: 'Offer', count: stats.Offer, color: '#52c41a' },
    ];
  };

  const pipelineStats = getPipelineStats();

  const formatCurrency = (value) => {
    if (!value) return 'Thỏa thuận';
    return new Intl.NumberFormat('vi-VN').format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  };

  const candidatesColumns = [
    {
      title: 'Ứng Viên',
      dataIndex: 'fullName',
      key: 'name',
      render: (name, record) => (
        <div className="candidate-cell">
          <Avatar style={{ backgroundColor: MATCHA_GREEN }}>{((name || record.name || 'N')[0]).toUpperCase()}</Avatar>
          <div className="candidate-info">
            <span className="candidate-name">{name || record.name || 'N/A'}</span>
            <span className="candidate-email">{record.email || 'N/A'}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'state',
      key: 'stage',
      render: (stage) => <ApplicationStateTag state={stage} />,
    },
    {
      title: 'Ngày Ứng Tuyển',
      dataIndex: 'appliedAt',
      key: 'appliedDate',
      render: (date) => <Text type="secondary">{formatDate(date)}</Text>,
    },
    {
      title: '',
      key: 'actions',
      width: 220,
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" onClick={() => navigate(`/human-resource/candidates/${record.id}`)}>Xem</Button>
          <Button size="small" type="primary" onClick={() => navigate(`/interviews/schedule?jobId=${jobId}`)}>Lịch</Button>
          {record.state !== 'REJECTED' && record.state !== 'HIRED' && (
            <Button
              size="small"
              danger
              onClick={() => promptReject(record)}
            >
              Từ chối
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'candidates',
      label: `Ứng Viên (${applications.length})`,
      children: (
        <Table 
          columns={candidatesColumns} 
          dataSource={applications} 
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} ứng viên`
          }}
          className="candidates-table"
          loading={loading}
        />
      ),
    },
    {
      key: 'pipeline',
      label: 'Phễu Tuyển Dụng',
      children: (
        <div className="pipeline-stats">
          {pipelineStats.map((item, index) => (
            <div key={index} className="pipeline-stat-item">
              <div className="pipeline-stat-header">
                <span className="stage-dot" style={{ backgroundColor: item.color }}></span>
                <span className="stage-name">{item.stage}</span>
                <span className="stage-count">{item.count}</span>
              </div>
              <Progress 
                percent={applications.length > 0 ? (item.count / applications.length) * 100 : 0} 
                showInfo={false}
                strokeColor={item.color}
                trailColor="#f0f0f0"
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'info',
      label: 'Thông Tin Tin',
      children: (
        <div className="job-info-content">
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Mô tả công việc">
              <Paragraph>{job?.description || 'N/A'}</Paragraph>
            </Descriptions.Item>
            <Descriptions.Item label="Yêu cầu">
              {job?.requirements?.map((req, i) => (
                <div key={i}>• {req}</div>
              )) || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Phúc lợi">
              {job?.benefits?.map((ben, i) => (
                <div key={i}>• {ben}</div>
              )) || 'N/A'}
            </Descriptions.Item>
          </Descriptions>
        </div>
      ),
    },
  ];

  if (loading && !job) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="job-detail-page">
      <div className="page-header">
        <Button 
          onClick={() => navigate('/human-resource/jobs')} 
          className="back-btn"
          icon={<ArrowLeftOutlined />}
        >
          Quay Lại
        </Button>
        <div className="header-actions">
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => {
              fetchJobDetails();
              fetchApplications();
            }}
            loading={loading}
          >
            Làm Mới
          </Button>
        </div>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card className="main-card" bordered={false}>
            <div className="job-header">
              <div className="job-info">
                <Title level={3} className="job-title">{job?.title || 'N/A'}</Title>
                <div className="job-tags">
                  <Tag color="blue">{job?.jobType || job?.type || 'N/A'}</Tag>
                  {/* Backend trả "Open"/"Closed" (không phải "Active") */}
                  <Tag color={/^open$/i.test(job?.status) ? 'success' : 'default'}>
                    {/^open$/i.test(job?.status) ? 'Đang tuyển' : 'Đã đóng'}
                  </Tag>
                  <Tag icon={<ClockCircleOutlined />}>Đăng ngày {formatDate(job?.createdAt)}</Tag>
                </div>
              </div>
              <div className="job-actions">
                <Button icon={<ShareAltOutlined />}>Chia Sẻ</Button>
                <Button 
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/human-resource/jobs/create?edit=${jobId}`)}
                >
                  Chỉnh Sửa
                </Button>
              </div>
            </div>

            <div className="job-details-grid">
              <div className="detail-item">
                <TeamOutlined className="detail-icon" />
                <div>
                  <Text type="secondary">Phòng Ban</Text>
                  <p>{job?.department || 'N/A'}</p>
                </div>
              </div>
              <div className="detail-item">
                <CalendarOutlined className="detail-icon" />
                <div>
                  <Text type="secondary">Địa Điểm</Text>
                  <p>{job?.location || job?.workLocation || 'N/A'}</p>
                </div>
              </div>
              <div className="detail-item">
                <CheckCircleOutlined className="detail-icon" />
                <div>
                  <Text type="secondary">Lương</Text>
                  <p>
                    {job?.salaryMin && job?.salaryMax 
                      ? `${formatCurrency(job.salaryMin)} - ${formatCurrency(job.salaryMax)} ${job?.currency || 'VND'}`
                      : job?.salary || 'Thỏa thuận'}
                  </p>
                </div>
              </div>
            </div>

            <Tabs items={tabItems} className="job-tabs" />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="sidebar-card" bordered={false}>
            <Title level={5}>Thao Tác Nhanh</Title>
            <div className="action-buttons">
              <Button 
                type="primary" 
                icon={<UserAddOutlined />} 
                block
                onClick={() => navigate(`/interviews/schedule?jobId=${jobId}`)}
                className="primary-action"
              >
                Lên Lịch Phỏng Vấn
              </Button>
              <Button icon={<MailOutlined />} block>
                Gửi Email
              </Button>
              <Button 
                icon={<EditOutlined />} 
                block
                onClick={() => navigate(`/human-resource/jobs/create?edit=${jobId}`)}
              >
                Chỉnh Sửa Tin
              </Button>
            </div>
          </Card>

          <Card className="sidebar-card" bordered={false}>
            <Title level={5}>Tổng Quan Phễu</Title>
            <div className="pipeline-summary">
              {pipelineStats.map((item, index) => (
                <div key={index} className="summary-item">
                  <span className="summary-label">{item.stage}</span>
                  <span className="summary-count">{item.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        title={`Từ chối hồ sơ — ${rejectTarget?.name || ''}`}
        open={!!rejectTarget}
        onCancel={cancelReject}
        onOk={submitReject}
        confirmLoading={rejecting}
        okText="Từ chối"
        okButtonProps={{ danger: true }}
        cancelText="Hủy"
      >
        <Typography.Paragraph type="secondary">
          Ứng viên sẽ nhận email thông báo (nếu có template REJECTED đang hoạt động).
        </Typography.Paragraph>
        <Typography.Paragraph>
          Lý do từ chối (không bắt buộc):
        </Typography.Paragraph>
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Nhập lý do từ chối..."
          maxLength={500}
          showCount
        />
      </Modal>

    </div>
  );
};

export default JobDetail;
