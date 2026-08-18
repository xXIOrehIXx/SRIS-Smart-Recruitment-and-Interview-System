import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Row, Col, Card, Button, Tag, Typography, Descriptions, Tabs, Table, Avatar, Progress, Space, Modal, Select, DatePicker, Spin, message, Input, Segmented, Tooltip } from 'antd';
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
  ReloadOutlined,
  ThunderboltOutlined,
  FileExcelOutlined
} from '@ant-design/icons';
import { jobsAPI, applicationAPI, cvAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { canRejectAtState, rejectOwnerLabel } from '../../utils/decisionRights';
import ApplicationStateTag from '../../components/ApplicationStateTag';
import FitScoreTag from '../../components/FitScoreTag';
import './css/JobDetail.css';

const { Title, Text, Paragraph } = Typography;

const MATCHA_GREEN = '#5D8C3E';

const JobDetail = () => {
  const { id: jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);

  // Thứ tự danh sách ứng viên. Mặc định 'fit' — màn này là chỗ người tuyển dụng CHỌN đọc
  // hồ sơ nào trước, nên mở ra đã thấy ngay hồ sơ AI cho là khớp nhất. Vẫn đổi được về
  // 'recent' cho ai muốn duyệt theo thứ tự nộp.
  const [sort, setSort] = useState('fit');
  const [screeningAll, setScreeningAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const pollTimer = useRef(null);

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
    }
  }, [jobId]);

  useEffect(() => {
    if (jobId) {
      fetchApplications();
    }
  }, [jobId, sort]);

  // Dừng hẳn vòng hỏi lại khi rời màn — để lại là timer chạy tiếp trên một component đã unmount.
  useEffect(() => () => clearTimeout(pollTimer.current), []);

  const fetchJobDetails = async () => {
    try {
      const response = await jobsAPI.getById(jobId);
      setJob(response.data);
    } catch (error) {
      console.error('Error fetching job details:', error);
      message.error('Không thể tải thông tin tin tuyển dụng');
    }
  };

  const fetchApplications = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const response = await applicationAPI.getAll(jobId, sort);
      // Backend trả ApplicationBoardDto: { jobId, sort, applications: [ApplicationCardDto] }
      const cards = response.data?.applications || [];
      setApplications(cards.map(app => ({
        ...app,
        id: app.applicationId,
        fullName: app.candidateName,
        email: app.candidateEmail,
        state: app.currentState,
      })));

      // Còn hồ sơ đang chờ AI thì tải lại sau vài giây để điểm tự hiện dần và danh sách tự
      // sắp lại — người dùng bấm "Phân tích CV" xong không phải ngồi bấm F5.
      // silent: không bật spinner, tránh cả bảng nháy mỗi 5 giây.
      clearTimeout(pollTimer.current);
      const stillRunning = cards.some(
        (c) => c.screeningStatus === 'PENDING' || c.screeningStatus === 'RUNNING'
      );
      if (stillRunning) {
        pollTimer.current = setTimeout(() => fetchApplications({ silent: true }), 5000);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
      if (!silent) message.error('Không thể tải danh sách ứng viên');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [jobId, sort]);

  /**
   * Chấm mức phù hợp cho toàn bộ hồ sơ đang ở vòng sàng lọc.
   *
   * Cố ý là một NÚT người dùng bấm chứ không chạy tự động khi nhận CV: mỗi lượt bắt Local LLM
   * đọc cả CV lẫn tin tuyển dụng, nổ ra hàng chục lượt sau lưng người dùng là treo máy demo.
   */
  const handleScreenAll = async () => {
    setScreeningAll(true);
    try {
      const { data } = await cvAPI.requestJobScreening(jobId);
      if (data.queued === 0) {
        message.info(
          data.totalCandidates === 0
            ? 'Không có hồ sơ nào đang ở vòng sàng lọc.'
            : 'Mọi hồ sơ ở vòng sàng lọc đều đã được phân tích.'
        );
      } else {
        message.success(
          `Đã xếp hàng phân tích ${data.queued} hồ sơ. Điểm sẽ hiện dần, không cần tải lại trang.`
        );
      }
      fetchApplications({ silent: true });
    } catch (err) {
      console.error('Error screening job:', err);
      message.error(err?.response?.data?.userMsg || 'Không thể phân tích CV cho vị trí này');
    } finally {
      setScreeningAll(false);
    }
  };

  /**
   * Tải danh sách ứng viên của vị trí này ra file Excel (V047).
   *
   * File gồm cả phần AI đọc CV (tóm tắt, yêu cầu đạt kèm câu trích, yêu cầu thiếu, mức phù hợp)
   * để người tuyển dụng mang ra ngoài hệ thống — họp, gửi sếp — mà không phải gõ lại từng dòng.
   * Tên file do backend đặt (Content-Disposition), FE chỉ lấy lại để đặt tên khi lưu.
   */
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await applicationAPI.exportByJob(jobId);
      const disposition = res.headers?.['content-disposition'] || '';
      const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
      const fileName = match ? decodeURIComponent(match[1]) : `Ung-vien-${jobId}.xlsx`;

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('Đã tải danh sách ứng viên.');
    } catch (err) {
      console.error('Error exporting applications:', err);
      message.error(err?.response?.data?.userMsg || 'Không xuất được danh sách ứng viên');
    } finally {
      setExporting(false);
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
      title: (
        <Tooltip title="AI đối chiếu CV với tin tuyển dụng. Là gợi ý để chọn đọc trước, KHÔNG phải quyết định — mở hồ sơ để xem AI dựa vào câu nào trong CV.">
          <span>Mức Phù Hợp&nbsp;<Text type="secondary">(AI)</Text></span>
        </Tooltip>
      ),
      key: 'fit',
      width: 170,
      render: (_, record) => (
        <FitScoreTag
          status={record.screeningStatus}
          fitScore={record.fitScore}
          decision={record.screeningDecision}
        />
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
          {/* Loại hồ sơ chỉ hiện cho người thực sự gác cửa ở chặng đó — nhân sự không còn
              loại được ứng viên đã sang bước sàng lọc (siết 17/08/2026). Ẩn nút thay vì để
              bấm rồi ăn 403, nhưng nói rõ ai làm được để họ biết đi hỏi ai. */}
          {canRejectAtState(role, record.state) ? (
            <Button
              size="small"
              danger
              onClick={() => promptReject(record)}
            >
              Từ chối
            </Button>
          ) : rejectOwnerLabel(record.state) ? (
            <Tooltip title={`Ở bước này, chỉ ${rejectOwnerLabel(record.state)} mới được loại ứng viên.`}>
              <Button size="small" danger disabled>Từ chối</Button>
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'candidates',
      label: `Ứng Viên (${applications.length})`,
      children: (
        <>
          <Space
            style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}
            wrap
          >
            <Space wrap>
              <Text type="secondary">Sắp xếp:</Text>
              <Segmented
                value={sort}
                onChange={setSort}
                options={[
                  { label: 'Mức phù hợp', value: 'fit' },
                  { label: 'Mới nộp trước', value: 'recent' },
                ]}
              />
            </Space>
            <Space wrap>
              <Tooltip title="Tải file Excel danh sách ứng viên: liên hệ, trạng thái, và phần AI đọc CV (tóm tắt, yêu cầu đạt/thiếu, mức phù hợp).">
                <Button
                  icon={<FileExcelOutlined />}
                  loading={exporting}
                  onClick={handleExportExcel}
                >
                  Xuất Excel
                </Button>
              </Tooltip>
              <Tooltip title="Cho AI đọc CV của mọi hồ sơ đang ở vòng sàng lọc và đối chiếu với tin tuyển dụng. Hồ sơ đã có kết quả sẽ được bỏ qua.">
                <Button
                  icon={<ThunderboltOutlined />}
                  loading={screeningAll}
                  onClick={handleScreenAll}
                >
                  Phân tích CV toàn bộ
                </Button>
              </Tooltip>
            </Space>
          </Space>

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
        </>
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
