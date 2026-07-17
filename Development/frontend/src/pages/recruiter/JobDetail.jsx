import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Row,
  Col,
  Card,
  Button,
  Tag,
  Typography,
  Descriptions,
  Tabs,
  Table,
  Avatar,
  Progress,
  Space,
  Modal,
  Select,
  DatePicker,
  Spin,
  message,
  Empty,
  Tooltip,
  Divider,
} from "antd";
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
  EnvironmentOutlined,
  DollarOutlined,
  TrophyOutlined,
  RocketOutlined,
  FileTextOutlined,
  GiftOutlined,
  FieldTimeOutlined,
} from "@ant-design/icons";
import { jobsAPI, applicationAPI } from "../../services/api";
import "./css/JobDetail.css";

const { Title, Text, Paragraph } = Typography;

const MATCHA_GREEN = "#5D8C3E";

const STATUS_LABEL = {
  Open: { label: "Đang mở", color: "success" },
  Paused: { label: "Tạm dừng", color: "warning" },
  Closed: { label: "Đã đóng", color: "default" },
  Draft: { label: "Bản nháp", color: "processing" },
};

const EMPLOYMENT_LABEL = {
  "Full-time": { label: "Toàn thời gian", color: "green" },
  "Part-time": { label: "Bán thời gian", color: "blue" },
  Contract: { label: "Hợp đồng", color: "orange" },
  Internship: { label: "Thực tập", color: "cyan" },
};

const WORK_MODE_LABEL = {
  Onsite: { label: "Tại văn phòng", color: "blue" },
  Remote: { label: "Từ xa", color: "purple" },
  Hybrid: { label: "Lai ghép", color: "geekblue" },
};

const EXP_LABEL = {
  Fresher: { label: "Mới ra trường", color: "default" },
  Junior: { label: "Junior (1-2 năm)", color: "cyan" },
  Mid: { label: "Mid (3-5 năm)", color: "blue" },
  Senior: { label: "Senior (5+ năm)", color: "purple" },
  Lead: { label: "Lead / Manager", color: "magenta" },
};

const APPLICATION_STATE_LABEL = {
  NEW: { label: "Hồ sơ mới", color: "blue" },
  PENDING: { label: "Đang xử lý", color: "gold" },
  SCREENING: { label: "Sàng lọc", color: "purple" },
  INTERVIEW: { label: "Phỏng vấn", color: "orange" },
  OFFER: { label: "Đề nghị", color: "cyan" },
  HIRED: { label: "Đã tuyển", color: "green" },
  REJECTED: { label: "Từ chối", color: "red" },
  WITHDRAWN: { label: "Rút lui", color: "default" },
};

const PIPELINE_PHASES = [
  { key: "NEW", label: "Hồ sơ mới", color: "#1890ff" },
  { key: "SCREENING", label: "Sàng lọc", color: "#722ed1" },
  { key: "INTERVIEW", label: "Phỏng vấn", color: "#faad14" },
  { key: "OFFER", label: "Đề nghị", color: "#13c2c2" },
];

const safeString = (v, fallback = "N/A") => {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "object") {
    if (Array.isArray(v)) return v.length ? `${v.length} mục` : fallback;
    return fallback;
  }
  return String(v);
};

const safeList = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

const fmtMoney = (n) => {
  if (n === null || n === undefined) return "";
  return new Intl.NumberFormat("vi-VN").format(Number(n));
};

const fmtDate = (d) => {
  if (!d) return "N/A";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "N/A";
  return dt.toLocaleDateString("vi-VN");
};

const fmtDateTime = (d) => {
  if (!d) return "N/A";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "N/A";
  return `${dt.toLocaleDateString("vi-VN")} ${dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
};

const JobDetail = () => {
  const { id: jobId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
      fetchApplications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      const response = await jobsAPI.getById(jobId);
      setJob(response.data || null);
    } catch (error) {
      console.error("Error fetching job details:", error);
      message.error("Không thể tải thông tin tin tuyển dụng");
      setJob(null);
    }
  };

  const fetchApplications = async () => {
    try {
      const response = await applicationAPI.getAll(jobId);
      // Backend trả { jobId, applications: [...] }
      const data = response.data;
      let list = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && typeof data === "object") {
        list = Array.isArray(data.applications) ? data.applications : [];
      }
      setApplications(list);
    } catch (error) {
      console.error("Error fetching applications:", error);
      message.error("Không thể tải danh sách ứng viên");
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([fetchJobDetails(), fetchApplications()]);
    setLoading(false);
  };

  // ===================== DERIVED DATA =====================
  const statusInfo = useMemo(() => {
    const s = typeof job?.status === "string" ? job.status : "Draft";
    return STATUS_LABEL[s] || { label: s, color: "default" };
  }, [job]);

  const employmentInfo = useMemo(() => {
    const e = typeof job?.employmentType === "string" ? job.employmentType : "";
    return EMPLOYMENT_LABEL[e] || null;
  }, [job]);

  const workModeInfo = useMemo(() => {
    const w = typeof job?.workMode === "string" ? job.workMode : "";
    return WORK_MODE_LABEL[w] || null;
  }, [job]);

  const experienceInfo = useMemo(() => {
    const x =
      typeof job?.experienceLevel === "string" ? job.experienceLevel : "";
    return EXP_LABEL[x] || null;
  }, [job]);

  const pipelineStats = useMemo(() => {
    const counts = { NEW: 0, SCREENING: 0, INTERVIEW: 0, OFFER: 0 };
    applications.forEach((app) => {
      const st =
        typeof app.currentState === "string"
          ? app.currentState.toUpperCase()
          : "";
      if (counts[st] !== undefined) counts[st] += 1;
    });
    return PIPELINE_PHASES.map((p) => ({ ...p, count: counts[p.key] || 0 }));
  }, [applications]);

  const salaryDisplay = useMemo(() => {
    if (!job) return "Thỏa thuận";
    const { salaryMin, salaryMax, currency, salary } = job;
    if (typeof salary === "string" && salary.trim()) return salary;
    if (
      salaryMin !== null &&
      salaryMin !== undefined &&
      salaryMax !== null &&
      salaryMax !== undefined
    ) {
      return `${fmtMoney(salaryMin)} - ${fmtMoney(salaryMax)} ${currency || "VND"}`;
    }
    if (salaryMin !== null && salaryMin !== undefined) {
      return `Từ ${fmtMoney(salaryMin)} ${currency || "VND"}`;
    }
    if (salaryMax !== null && salaryMax !== undefined) {
      return `Đến ${fmtMoney(salaryMax)} ${currency || "VND"}`;
    }
    return "Thỏa thuận";
  }, [job]);

  const deadlineText = useMemo(() => {
    if (!job?.deadline) return null;
    const d = new Date(job.deadline);
    if (Number.isNaN(d.getTime())) return null;
    const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const base = fmtDate(job.deadline);
    if (days < 0) return `${base} (đã quá hạn)`;
    if (days === 0) return `${base} (hôm nay)`;
    return `${base} (còn ${days} ngày)`;
  }, [job]);

  // ===================== CANDIDATE COLUMNS =====================
  const candidatesColumns = [
    {
      title: "Ứng Viên",
      key: "candidate",
      render: (_, record) => {
        const name = safeString(
          record.candidateName || record.fullName || record.name,
        );
        const email = safeString(record.candidateEmail || record.email);
        const initial = (name[0] || "U").toUpperCase();
        return (
          <div className="candidate-cell">
            <Avatar style={{ backgroundColor: MATCHA_GREEN }}>{initial}</Avatar>
            <div className="candidate-info">
              <span className="candidate-name">{name}</span>
              <span className="candidate-email">{email}</span>
            </div>
          </div>
        );
      },
    },
    {
      title: "Trạng Thái",
      key: "state",
      render: (_, record) => {
        const st =
          typeof record.currentState === "string"
            ? record.currentState.toUpperCase()
            : "";
        const cfg = APPLICATION_STATE_LABEL[st] || {
          label: st || "N/A",
          color: "default",
        };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: "Điểm AI",
      key: "aiScore",
      width: 140,
      render: (_, record) => {
        const score = record.aiMatchScore ?? record.cvScore;
        if (score === null || score === undefined) {
          return <Text type="secondary">Chưa chấm</Text>;
        }
        const v = Math.round(Number(score));
        return (
          <Tooltip title={`Điểm khớp CV-JD: ${v}/100`}>
            <Progress
              percent={v}
              size="small"
              strokeColor={MATCHA_GREEN}
              format={(p) => `${p}`}
            />
          </Tooltip>
        );
      },
    },
    {
      title: "Điểm Tiêu Chí",
      key: "criteriaScore",
      width: 140,
      render: (_, record) => {
        const score = record.criteriaScore;
        if (score === null || score === undefined) {
          return <Text type="secondary">Chưa chấm</Text>;
        }
        const v = Math.round(Number(score));
        return (
          <Tooltip title={`Điểm theo tiêu chí: ${v}/100`}>
            <Progress
              percent={v}
              size="small"
              strokeColor="#722ed1"
              format={(p) => `${p}`}
            />
          </Tooltip>
        );
      },
    },
    {
      title: "Ngày Ứng Tuyển",
      key: "appliedAt",
      render: (_, record) => (
        <Text type="secondary">{fmtDateTime(record.appliedAt)}</Text>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 90,
      render: (_, record) => {
        const appId = record.applicationId || record.id;
        return (
          <Space>
            <Button
              size="small"
              disabled={!appId}
              onClick={() => {
                if (!appId) {
                  message.warning(
                    "Ứng viên này chưa có hồ sơ hợp lệ để xem chi tiết",
                  );
                  return;
                }
                navigate(`/recruiter/candidates/${appId}`);
              }}
            >
              Xem
            </Button>
          </Space>
        );
      },
    },
  ];

  const tabItems = [
    {
      key: "candidates",
      label: `Ứng Viên (${applications.length})`,
      children:
        applications.length === 0 && !loading ? (
          <Empty description="Chưa có ứng viên ứng tuyển" />
        ) : (
          <Table
            columns={candidatesColumns}
            dataSource={applications}
            rowKey={(r) =>
              r.applicationId || r.id || `${r.candidateId}-${r.appliedAt}`
            }
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} ứng viên`,
            }}
            className="candidates-table"
            loading={loading}
          />
        ),
    },
    {
      key: "pipeline",
      label: "Phễu Tuyển Dụng",
      children: (
        <div className="pipeline-stats">
          {pipelineStats.map((item) => (
            <div key={item.key} className="pipeline-stat-item">
              <div className="pipeline-stat-header">
                <span
                  className="stage-dot"
                  style={{ backgroundColor: item.color }}
                />
                <span className="stage-name">{item.label}</span>
                <span className="stage-count">{item.count}</span>
              </div>
              <Progress
                percent={
                  applications.length > 0
                    ? (item.count / applications.length) * 100
                    : 0
                }
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
      key: "info",
      label: "Thông Tin Tin",
      children: (
        <div className="job-info-content">
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item
              label={
                <span>
                  <FileTextOutlined /> Mô tả công việc
                </span>
              }
            >
              <Paragraph style={{ whiteSpace: "pre-line", marginBottom: 0 }}>
                {safeString(job?.jdText || job?.description, "Chưa cập nhật")}
              </Paragraph>
            </Descriptions.Item>

            <Descriptions.Item
              label={
                <span>
                  <CheckCircleOutlined /> Yêu cầu
                </span>
              }
            >
              {safeList(job?.requirements).length === 0 ? (
                <Text type="secondary">Chưa cập nhật</Text>
              ) : (
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  {safeList(job?.requirements).map((req, i) => (
                    <li key={i}>
                      {typeof req === "string" ? req : safeString(req)}
                    </li>
                  ))}
                </ul>
              )}
            </Descriptions.Item>

            <Descriptions.Item
              label={
                <span>
                  <GiftOutlined /> Phúc lợi
                </span>
              }
            >
              {safeList(job?.benefits).length === 0 ? (
                <Text type="secondary">Chưa cập nhật</Text>
              ) : (
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  {safeList(job?.benefits).map((ben, i) => (
                    <li key={i}>
                      {typeof ben === "string" ? ben : safeString(ben)}
                    </li>
                  ))}
                </ul>
              )}
            </Descriptions.Item>

            <Descriptions.Item
              label={
                <span>
                  <RocketOutlined /> Kỹ năng
                </span>
              }
            >
              {safeList(job?.skills).length === 0 ? (
                <Text type="secondary">Chưa cập nhật</Text>
              ) : (
                <Space wrap>
                  {safeList(job?.skills).map((s, i) => (
                    <Tag key={i} color="green">
                      {typeof s === "string" ? s : safeString(s)}
                    </Tag>
                  ))}
                </Space>
              )}
            </Descriptions.Item>
          </Descriptions>
        </div>
      ),
    },
  ];

  if (loading && !job) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "60vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!job) {
    return (
      <div style={{ padding: 32 }}>
        <Button
          onClick={() => navigate("/recruiter/jobs")}
          icon={<ArrowLeftOutlined />}
        >
          Quay Lại
        </Button>
        <Empty
          description="Không tìm thấy tin tuyển dụng"
          style={{ marginTop: 48 }}
        />
      </div>
    );
  }

  return (
    <div className="job-detail-page">
      <div className="page-header">
        <Button
          onClick={() => navigate("/recruiter/jobs")}
          className="back-btn"
          icon={<ArrowLeftOutlined />}
        >
          Quay Lại
        </Button>
        <div className="header-actions">
          <Button
            icon={<ReloadOutlined />}
            onClick={refreshAll}
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
                <Title level={3} className="job-title">
                  {safeString(job.title)}
                </Title>
                <div className="job-tags">
                  <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
                  {employmentInfo && (
                    <Tag color={employmentInfo.color}>
                      {employmentInfo.label}
                    </Tag>
                  )}
                  {workModeInfo && (
                    <Tag color={workModeInfo.color}>{workModeInfo.label}</Tag>
                  )}
                  {experienceInfo && (
                    <Tag color={experienceInfo.color}>
                      {experienceInfo.label}
                    </Tag>
                  )}
                  <Tag icon={<ClockCircleOutlined />}>
                    Đăng ngày {fmtDate(job.createdAt)}
                  </Tag>
                </div>
              </div>
              <div className="job-actions">
                <Button icon={<ShareAltOutlined />}>Chia Sẻ</Button>
                <Button
                  icon={<EditOutlined />}
                  onClick={() =>
                    navigate(`/recruiter/jobs/create?edit=${jobId}`)
                  }
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
                  <p>{safeString(job.department)}</p>
                </div>
              </div>
              <div className="detail-item">
                <EnvironmentOutlined className="detail-icon" />
                <div>
                  <Text type="secondary">Địa Điểm</Text>
                  <p>{safeString(job.location)}</p>
                </div>
              </div>
              <div className="detail-item">
                <DollarOutlined className="detail-icon" />
                <div>
                  <Text type="secondary">Mức Lương</Text>
                  <p>{salaryDisplay}</p>
                </div>
              </div>
              <div className="detail-item">
                <TrophyOutlined className="detail-icon" />
                <div>
                  <Text type="secondary">Số Lượng</Text>
                  <p>{job.quantity ? `${job.quantity} người` : "N/A"}</p>
                </div>
              </div>
              <div className="detail-item">
                <UserAddOutlined className="detail-icon" />
                <div>
                  <Text type="secondary">Ứng Viên</Text>
                  <p>
                    {applications.length}
                    {job.applicationCount > 0 &&
                    job.applicationCount !== applications.length
                      ? ` / ${job.applicationCount} tổng`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="detail-item">
                <FieldTimeOutlined className="detail-icon" />
                <div>
                  <Text type="secondary">Hạn Nộp</Text>
                  <p>{deadlineText || "Không giới hạn"}</p>
                </div>
              </div>
            </div>

            {safeList(job.skills).length > 0 && (
              <div className="job-skills-section">
                <Text type="secondary" style={{ marginRight: 8 }}>
                  Kỹ năng:
                </Text>
                <Space wrap size={[6, 6]}>
                  {safeList(job.skills).map((s, i) => (
                    <Tag key={i} color="green">
                      {typeof s === "string" ? s : safeString(s)}
                    </Tag>
                  ))}
                </Space>
              </div>
            )}

            <Divider style={{ margin: "20px 0 16px" }} />
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
                onClick={() => setIsScheduleModalOpen(true)}
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
                onClick={() => navigate(`/recruiter/jobs/create?edit=${jobId}`)}
              >
                Chỉnh Sửa Tin
              </Button>
            </div>
          </Card>

          <Card className="sidebar-card" bordered={false}>
            <Title level={5}>Tổng Quan Phễu</Title>
            <div className="pipeline-summary">
              {pipelineStats.map((item) => (
                <div key={item.key} className="summary-item">
                  <span className="summary-label">{item.label}</span>
                  <span className="summary-count">{item.count}</span>
                </div>
              ))}
            </div>
          </Card>

          {job.createdBy && (
            <Card className="sidebar-card" bordered={false}>
              <Title level={5}>Thông Tin Tạo</Title>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Người tạo">
                  User #{job.createdBy}
                </Descriptions.Item>
                <Descriptions.Item label="Cập nhật">
                  {fmtDateTime(job.updatedAt)}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title="Lên Lịch Phỏng Vấn"
        open={isScheduleModalOpen}
        onCancel={() => setIsScheduleModalOpen(false)}
        footer={null}
      >
        <div className="schedule-form">
          <div className="form-group">
            <label>Chọn Ứng Viên</label>
            <Select placeholder="Chọn ứng viên" style={{ width: "100%" }}>
              {applications.map((app) => (
                <Select.Option
                  key={app.applicationId || app.id}
                  value={app.applicationId || app.id}
                >
                  {safeString(app.candidateName || app.fullName)}
                </Select.Option>
              ))}
            </Select>
          </div>
          <div className="form-group">
            <label>Loại Phỏng Vấn</label>
            <Select placeholder="Chọn loại" style={{ width: "100%" }}>
              <Select.Option value="technical">Kỹ thuật</Select.Option>
              <Select.Option value="hr">HR</Select.Option>
              <Select.Option value="culture">Văn hóa</Select.Option>
            </Select>
          </div>
          <div className="form-group">
            <label>Ngày & Giờ</label>
            <DatePicker
              showTime
              style={{ width: "100%" }}
              format="DD/MM/YYYY HH:mm"
            />
          </div>
          <Button type="primary" block className="submit-btn">
            Lên Lịch
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default JobDetail;
