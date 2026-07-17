import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Row,
  Col,
  Card,
  Typography,
  Avatar,
  Tag,
  Button,
  Tabs,
  Timeline,
  Progress,
  Space,
  Divider,
  Spin,
  message,
  Descriptions,
  Empty,
  Skeleton,
} from "antd";
import {
  ArrowLeftOutlined,
  MailOutlined,
  PhoneOutlined,
  CalendarOutlined,
  FileTextOutlined,
  ReloadOutlined,
  UserOutlined,
  TrophyOutlined,
  FileSearchOutlined,
  IdcardOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import {
  applicationAPI,
  interviewAPI,
  jobsAPI,
  cvScoringAPI,
} from "../../services/api";
import "./css/CandidateDetail.css";

const { Title, Text, Paragraph } = Typography;

const MATCHA_GREEN = "#5D8C3E";

const STATE_LABEL = {
  NEW: { label: "Hồ sơ mới", color: "blue" },
  PENDING: { label: "Đang xử lý", color: "gold" },
  SCREENING: { label: "Sàng lọc", color: "purple" },
  INTERVIEW: { label: "Phỏng vấn", color: "orange" },
  OFFER: { label: "Đề nghị", color: "cyan" },
  HIRED: { label: "Đã tuyển", color: "green" },
  REJECTED: { label: "Từ chối", color: "red" },
  WITHDRAWN: { label: "Rút lui", color: "default" },
};

const CV_PARSE_LABEL = {
  PENDING: { label: "Đang xử lý", color: "gold" },
  PARSED: { label: "Đã parse", color: "green" },
  FAILED: { label: "Lỗi parse", color: "red" },
  SKIPPED: { label: "Bỏ qua", color: "default" },
};

const INTERVIEW_STATUS = {
  SCHEDULED: { label: "Đã lên lịch", color: "blue" },
  DONE: { label: "Hoàn thành", color: "green" },
  CANCELLED: { label: "Đã hủy", color: "red" },
};

const ROUND_LABEL = {
  SCREENING: "Sàng lọc",
  TECHNICAL: "Kỹ thuật",
  HR: "HR",
  CULTURE: "Văn hóa",
  FINAL: "Cuối cùng",
};

const safe = (v, fb = "N/A") => {
  if (v === null || v === undefined) return fb;
  if (typeof v === "object") return fb;
  return String(v);
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

const CandidateDetail = () => {
  const { id: applicationId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [cvUrlLoading, setCvUrlLoading] = useState(false);

  useEffect(() => {
    if (applicationId) fetchApplication();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const fetchApplication = async () => {
    if (
      !applicationId ||
      applicationId === "??" ||
      applicationId === "undefined"
    ) {
      message.error("ID ứng viên không hợp lệ");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await applicationAPI.getById(applicationId);
      console.log("[CandidateDetail] application raw:", res.data);
      setApplication(res.data || null);
      const jobId = res?.data?.jobId;
      if (jobId) fetchSchedules(jobId);
    } catch (error) {
      console.error("Error fetching application:", error);
      const status = error?.response?.status;
      const apiMsg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message;
      message.error(
        status
          ? `Không thể tải hồ sơ (HTTP ${status}${apiMsg ? `: ${apiMsg}` : ""})`
          : `Không thể tải hồ sơ: ${apiMsg || "Lỗi không xác định"}`,
      );
      setApplication(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async (jobId) => {
    try {
      setSchedulesLoading(true);
      const res = await interviewAPI.getAllSchedules(jobId);
      const data = res?.data;
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : [];
      // Backend chưa có endpoint riêng cho application → lấy toàn bộ của job, filter phía client theo applicationId/candidateId
      const filtered = list.filter((s) => {
        const sAppId = s.applicationId ?? s.ApplicationId;
        const sCandId = s.candidateId ?? s.CandidateId;
        const appId = application?.applicationId ?? applicationId;
        const candId = application?.candidateId;
        if (sAppId && appId && Number(sAppId) === Number(appId)) return true;
        if (sCandId && candId && Number(sCandId) === Number(candId))
          return true;
        return false;
      });
      setSchedules(filtered);
    } catch (error) {
      console.error("Error fetching schedules:", error);
      setSchedules([]);
    } finally {
      setSchedulesLoading(false);
    }
  };

  const handleViewCV = async () => {
    if (!application?.cvId) return;
    try {
      setCvUrlLoading(true);
      const res = await cvScoringAPI.getFileUrl(application.cvId);
      const url = res.data?.url || res.data?.data || res.data;
      if (typeof url === "string" && url.startsWith("http")) {
        window.open(url, "_blank");
      } else {
        message.error("Không lấy được đường dẫn file CV hợp lệ.");
      }
    } catch (error) {
      console.error("Error fetching CV URL:", error);
      message.error("Lỗi khi lấy file CV.");
    } finally {
      setCvUrlLoading(false);
    }
  };

  const refreshAll = async () => {
    await fetchApplication();
  };

  // ====== DERIVED ======
  const stateInfo = useMemo(() => {
    const s =
      typeof application?.currentState === "string"
        ? application.currentState.toUpperCase()
        : "";
    return STATE_LABEL[s] || { label: s || "N/A", color: "default" };
  }, [application]);

  const cvParseInfo = useMemo(() => {
    const p =
      typeof application?.cvParseStatus === "string"
        ? application.cvParseStatus.toUpperCase()
        : "";
    return CV_PARSE_LABEL[p] || null;
  }, [application]);

  const aiScore = useMemo(() => {
    if (
      application?.aiMatchScore === null ||
      application?.aiMatchScore === undefined
    )
      return null;
    const n = Number(application.aiMatchScore);
    return Number.isFinite(n) ? Math.round(n) : null;
  }, [application]);

  const criteriaScore = useMemo(() => {
    if (
      application?.criteriaScore === null ||
      application?.criteriaScore === undefined
    )
      return null;
    const n = Number(application.criteriaScore);
    return Number.isFinite(n) ? Math.round(n) : null;
  }, [application]);

  const initial = useMemo(() => {
    const n = safe(application?.candidateName, "U");
    return (n[0] || "U").toUpperCase();
  }, [application]);

  // ====== TABS ======
  const tabItems = [
    {
      key: "overview",
      label: "Tổng Quan",
      children: (
        <div className="overview-tab">
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item
              label={
                <span>
                  <UserOutlined /> Họ và tên
                </span>
              }
            >
              {safe(application?.candidateName)}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <span>
                  <MailOutlined /> Email
                </span>
              }
            >
              {application?.candidateEmail ? (
                <a href={`mailto:${application.candidateEmail}`}>
                  {application.candidateEmail}
                </a>
              ) : (
                "N/A"
              )}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <span>
                  <PhoneOutlined /> Số điện thoại
                </span>
              }
            >
              {safe(application?.candidatePhone)}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <span>
                  <GlobalOutlined /> Nguồn ứng viên
                </span>
              }
            >
              {safe(application?.candidateSource)}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <span>
                  <IdcardOutlined /> Tin tuyển dụng
                </span>
              }
            >
              {safe(application?.jobTitle, "")}
              {application?.jobId ? ` (#${application.jobId})` : ""}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <span>
                  <CalendarOutlined /> Ngày ứng tuyển
                </span>
              }
            >
              {fmtDateTime(application?.appliedAt)}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <span>
                  <CalendarOutlined /> Cập nhật pha gần nhất
                </span>
              }
            >
              {fmtDateTime(application?.stageUpdatedAt)}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <span>
                  <FileTextOutlined /> Trạng thái CV
                </span>
              }
            >
              {cvParseInfo ? (
                <Tag color={cvParseInfo.color}>{cvParseInfo.label}</Tag>
              ) : (
                "Chưa rõ"
              )}
            </Descriptions.Item>
            {application?.rejectReason && (
              <Descriptions.Item label="Lý do từ chối">
                <Text type="danger">{application.rejectReason}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        </div>
      ),
    },
    {
      key: "cv",
      label: "CV",
      children: (
        <Card className="cv-card" bordered={false}>
          <Row gutter={[24, 24]}>
            <Col xs={24} md={10}>
              <div className="cv-preview">
                <FileTextOutlined
                  style={{
                    fontSize: 56,
                    color: application?.cvId ? MATCHA_GREEN : "#ccc",
                  }}
                />
                <Title level={5} style={{ marginTop: 12, marginBottom: 4 }}>
                  {safe(application?.cvFileName, "Chưa có CV")}
                </Title>
                <Text type="secondary">
                  CV ID: {application?.cvId ? `#${application.cvId}` : "N/A"}
                </Text>
                <div style={{ marginTop: 12 }}>
                  {cvParseInfo && (
                    <Tag color={cvParseInfo.color}>
                      Parse: {cvParseInfo.label}
                    </Tag>
                  )}
                </div>
                <div style={{ marginTop: 16 }}>
                  <Button
                    type="primary"
                    icon={<FileSearchOutlined />}
                    disabled={!application?.cvId}
                    loading={cvUrlLoading}
                    onClick={handleViewCV}
                  >
                    Xem file CV
                  </Button>
                </div>
              </div>
            </Col>
            <Col xs={24} md={14}>
              <Title level={5}>Điểm Số</Title>
              <Space direction="vertical" size={20} style={{ width: "100%" }}>
                <div>
                  <Text type="secondary">Điểm AI Match (CV ↔ JD)</Text>
                  {aiScore === null ? (
                    <div style={{ marginTop: 6 }}>
                      <Text type="secondary">Chưa chấm</Text>
                    </div>
                  ) : (
                    <Progress
                      percent={aiScore}
                      strokeColor={MATCHA_GREEN}
                      format={(p) => `${p}/100`}
                    />
                  )}
                </div>
                <div>
                  <Text type="secondary">Điểm theo tiêu chí</Text>
                  {criteriaScore === null ? (
                    <div style={{ marginTop: 6 }}>
                      <Text type="secondary">
                        Chưa chấm (job chưa có tiêu chí hoặc chưa chấm)
                      </Text>
                    </div>
                  ) : (
                    <Progress
                      percent={criteriaScore}
                      strokeColor="#722ed1"
                      format={(p) => `${p}/100`}
                    />
                  )}
                </div>
              </Space>
            </Col>
          </Row>
        </Card>
      ),
    },
    {
      key: "interviews",
      label: `Phỏng Vấn (${schedules.length})`,
      children: schedulesLoading ? (
        <Skeleton active />
      ) : schedules.length === 0 ? (
        <Empty description="Chưa có lịch phỏng vấn cho ứng viên này" />
      ) : (
        <Timeline
          items={schedules.map((s) => {
            const st =
              typeof s.status === "string" ? s.status.toUpperCase() : "";
            const cfg = INTERVIEW_STATUS[st] || {
              label: st || "N/A",
              color: "default",
            };
            const round =
              typeof s.roundType === "string" ? s.roundType.toUpperCase() : "";
            const when = s.scheduledAt || s.startAt || s.date;
            return {
              color:
                cfg.color === "green"
                  ? "green"
                  : cfg.color === "red"
                    ? "red"
                    : "blue",
              children: (
                <div className="timeline-item">
                  <div className="timeline-header">
                    <span className="interview-type">
                      {ROUND_LABEL[round] || s.roundType || "Phỏng vấn"}
                    </span>
                    <Tag color={cfg.color}>{cfg.label}</Tag>
                  </div>
                  <Text type="secondary">
                    <CalendarOutlined /> {fmtDateTime(when)}
                  </Text>
                  {s.location && (
                    <div>
                      <Text type="secondary">Địa điểm: {safe(s.location)}</Text>
                    </div>
                  )}
                  {s.interviewerName && (
                    <div>
                      <Text type="secondary">
                        Người phỏng vấn: {safe(s.interviewerName)}
                      </Text>
                    </div>
                  )}
                  {s.notes && (
                    <Paragraph
                      type="secondary"
                      style={{ marginTop: 6, marginBottom: 0 }}
                    >
                      {safe(s.notes)}
                    </Paragraph>
                  )}
                </div>
              ),
            };
          })}
        />
      ),
    },
  ];

  if (loading) {
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

  if (!application) {
    return (
      <div style={{ padding: 32 }}>
        <Button onClick={() => navigate(-1)} icon={<ArrowLeftOutlined />}>
          Quay Lại
        </Button>
        <Empty
          description="Không tìm thấy hồ sơ ứng viên"
          style={{ marginTop: 48 }}
        />
      </div>
    );
  }

  return (
    <div className="candidate-detail-page">
      <div className="page-header">
        <Button
          onClick={() => navigate(-1)}
          className="back-btn"
          icon={<ArrowLeftOutlined />}
        >
          Quay Lại
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={refreshAll}
          loading={loading}
        >
          Làm Mới
        </Button>
      </div>

      <Row gutter={[24, 24]}>
        {/* ====== LEFT: PROFILE ====== */}
        <Col xs={24} lg={8}>
          <Card className="profile-card" bordered={false}>
            <div className="profile-header">
              <Avatar
                size={100}
                style={{ backgroundColor: MATCHA_GREEN, fontSize: 40 }}
              >
                {initial}
              </Avatar>
              <Title level={3} className="profile-name">
                {safe(application.candidateName)}
              </Title>
              <Text type="secondary">
                {safe(application.jobTitle, "Chưa rõ tin tuyển dụng")}
              </Text>

              <div className="profile-tags">
                <Tag color={stateInfo.color}>{stateInfo.label}</Tag>
                {aiScore !== null && (
                  <Tag
                    color={
                      aiScore >= 80
                        ? "success"
                        : aiScore >= 60
                          ? "warning"
                          : "default"
                    }
                  >
                    AI: {aiScore}
                  </Tag>
                )}
                {criteriaScore !== null && (
                  <Tag color="purple">Tiêu chí: {criteriaScore}</Tag>
                )}
              </div>
            </div>

            <Divider />

            <div className="profile-contact">
              <div className="contact-item">
                <MailOutlined />
                {application.candidateEmail ? (
                  <a href={`mailto:${application.candidateEmail}`}>
                    {application.candidateEmail}
                  </a>
                ) : (
                  <span>N/A</span>
                )}
              </div>
              {application.candidatePhone && (
                <div className="contact-item">
                  <PhoneOutlined />
                  <span>{application.candidatePhone}</span>
                </div>
              )}
              {application.candidateSource && (
                <div className="contact-item">
                  <GlobalOutlined />
                  <span>{application.candidateSource}</span>
                </div>
              )}
              <div className="contact-item">
                <CalendarOutlined />
                <span>Ứng tuyển: {fmtDate(application.appliedAt)}</span>
              </div>
              {application?.jobId && (
                <div className="contact-item">
                  <FileSearchOutlined />
                  <a
                    onClick={() =>
                      navigate(`/recruiter/jobs/${application.jobId}`)
                    }
                    style={{ cursor: "pointer" }}
                  >
                    Xem tin tuyển dụng
                  </a>
                </div>
              )}
            </div>

            <Divider />

            <Space direction="vertical" style={{ width: "100%" }}>
              <Button
                block
                icon={<MailOutlined />}
                disabled={!application.candidateEmail}
              >
                Gửi Email
              </Button>
              <Button
                block
                icon={<CalendarOutlined />}
                type="primary"
                className="schedule-btn"
                onClick={() =>
                  application?.jobId &&
                  navigate(`/recruiter/jobs/${application.jobId}/candidates`)
                }
              >
                Lên Lịch Phỏng Vấn
              </Button>
            </Space>

            {application?.rejectReason && (
              <>
                <Divider />
                <Title level={5}>Lý do từ chối</Title>
                <Text type="danger">{application.rejectReason}</Text>
              </>
            )}
          </Card>
        </Col>

        {/* ====== RIGHT: TABS ====== */}
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
