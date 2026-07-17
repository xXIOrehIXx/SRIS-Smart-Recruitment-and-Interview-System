import React, { useState, useEffect } from "react";
import {
  Card,
  Typography,
  Table,
  Tag,
  Avatar,
  Button,
  Space,
  Input,
  Select,
  Row,
  Col,
  Statistic,
  message,
} from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { applicationAPI, jobsAPI } from "../../services/api";
import "../Dashboard.css";

const { Title, Text } = Typography;
const { Option } = Select;

const MATCHA_GREEN = "#5D8C3E";

const InterviewerInterviewHistory = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const getHistoryActionLabel = (action) => {
    const labels = {
      STATE_CHANGE: "Thay đổi trạng thái",
      CREATE: "Tạo mới",
      UPDATE: "Cập nhật",
      DELETE: "Xóa",
    };
    return labels[action] || action || "Không xác định";
  };

  const getHistoryStateLabel = (state) => {
    const labels = {
      NEW: "Mới",
      SCREENING: "Sàng lọc",
      QUIZ: "Quiz",
      INTERVIEW: "Phỏng vấn",
      OFFER: "Offer",
      HIRED: "Đã tuyển",
      REJECTED: "Từ chối",
      COMPLETED: "Đã hoàn thành",
      CANCELLED: "Đã hủy",
      MISSED: "Bỏ lỡ",
      PENDING: "Chờ xử lý",
    };
    return labels[state] || state || "Không xác định";
  };

  const fetchHistory = async () => {
    if (!selectedApplicationId) {
      setHistory([]);
      return;
    }

    try {
      setLoading(true);
      const response = await applicationAPI.getHistory(selectedApplicationId);
      const data = response.data || [];

      const normalized = data.map((item, index) => {
        const isStateLog =
          item &&
          (item.logId !== undefined ||
            item.action ||
            item.fromState ||
            item.toState ||
            item.createdAt);

        if (isStateLog) {
          return {
            id: item.logId || item.id || `${selectedApplicationId}-${index}`,
            candidate: item.actorEmail || item.actor?.email || "N/A",
            position:
              item.detail || getHistoryStateLabel(item.toState) || "N/A",
            department: item.detail || "N/A",
            date: item.createdAt,
            time: "",
            type: getHistoryActionLabel(item.action),
            level: 1,
            status: item.toState || item.fromState || "PENDING",
            score: null,
            maxScore: 50,
            recommendation: null,
            graded: false,
            applicationId:
              selectedApplicationId || item.applicationId || item.id,
            actorEmail: item.actorEmail || item.actor?.email || "N/A",
            fromState: item.fromState,
            toState: item.toState,
            detail: item.detail || "",
            raw: item,
          };
        }

        return {
          id: item.applicationId || item.id || index,
          candidate: item.candidateName || item.candidate || "N/A",
          position:
            item.positionTitle || item.jobTitle || item.position || "N/A",
          department: item.department || "N/A",
          date: item.interviewDate || item.scheduledDate || item.date,
          time: item.interviewTime || item.scheduledTime || item.time || "",
          type: item.interviewType || item.type || "N/A",
          level: item.round || item.interviewRound || item.level || 1,
          status: item.status || "PENDING",
          score: item.score ?? null,
          maxScore: item.maxScore || 50,
          recommendation: item.recommendation || null,
          graded:
            item.graded ?? (item.score !== null && item.score !== undefined),
          applicationId: item.applicationId || item.id,
          actorEmail: item.actorEmail || item.actor?.email || "N/A",
          fromState: item.fromState,
          toState: item.toState,
          detail: item.detail || "",
          raw: item,
        };
      });

      setHistory(normalized);
    } catch (error) {
      console.error("Error fetching interview history:", error);
      message.error("Không thể tải lịch sử phỏng vấn");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (selectedJobId) {
      fetchApplications(selectedJobId);
    } else {
      setApplications([]);
      setSelectedApplicationId(null);
    }
  }, [selectedJobId]);

  useEffect(() => {
    fetchHistory();
  }, [selectedApplicationId]);

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      const jobList = response.data || [];
      setJobs(jobList);
      const defaultJobId = jobList[0]?.jobId || jobList[0]?.id || null;
      setSelectedJobId(defaultJobId);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      message.error("Không thể tải danh sách công việc");
    }
  };

  const fetchApplications = async (jobId) => {
    if (!jobId) {
      setApplications([]);
      setSelectedApplicationId(null);
      return;
    }

    try {
      setApplicationsLoading(true);
      const response = await applicationAPI.getAll(jobId);
      const payload = response.data || {};
      const apps = Array.isArray(payload)
        ? payload
        : payload.applications || [];
      const normalized = apps.map((app) => ({
        id: app.applicationId || app.id,
        candidateName:
          app.candidateName ||
          app.candidate?.fullName ||
          app.candidate?.name ||
          "N/A",
        position:
          app.positionTitle ||
          app.jobTitle ||
          app.position ||
          app.job?.title ||
          "N/A",
        status: app.currentState || app.status || "N/A",
      }));
      setApplications(normalized);
      if (normalized.length > 0) {
        setSelectedApplicationId(normalized[0].id);
      } else {
        setSelectedApplicationId(null);
      }
    } catch (error) {
      console.error("Error fetching applications:", error);
      message.error("Không thể tải danh sách ứng viên");
      setApplications([]);
      setSelectedApplicationId(null);
    } finally {
      setApplicationsLoading(false);
    }
  };

  const getStatusConfig = (status) => {
    const configs = {
      COMPLETED: {
        color: "success",
        label: "Đã hoàn thành",
        icon: <CheckCircleOutlined />,
      },
      CANCELLED: {
        color: "error",
        label: "Đã hủy",
        icon: <CloseCircleOutlined />,
      },
      MISSED: {
        color: "warning",
        label: "Bỏ lỡ",
        icon: <ClockCircleOutlined />,
      },
      PENDING: {
        color: "processing",
        label: "Chờ xử lý",
        icon: <ClockCircleOutlined />,
      },
      NEW: { color: "default", label: "Mới" },
      SCREENING: { color: "purple", label: "Sàng lọc" },
      QUIZ: { color: "cyan", label: "Quiz" },
      INTERVIEW: { color: "blue", label: "Phỏng vấn" },
      OFFER: { color: "green", label: "Offer" },
      HIRED: { color: "success", label: "Đã tuyển" },
      REJECTED: { color: "error", label: "Từ chối" },
    };
    return configs[status] || { color: "default", label: status };
  };

  const getRecommendationConfig = (rec) => {
    const configs = {
      STRONG_HIRE: { color: "#52c41a", label: "Trúng tuyển mạnh" },
      HIRE: { color: "#73d13d", label: "Trúng tuyển" },
      CONSIDER: { color: "#faad14", label: "Cân nhắc" },
      NO_HIRE: { color: "#f5222d", label: "Không trúng tuyển" },
    };
    return configs[rec] || { color: "default", label: "-" };
  };

  const getScoreColor = (score, max) => {
    if (score === null || score === undefined) return "#faad14";
    const percent = (score / max) * 100;
    if (percent >= 80) return "#52c41a";
    if (percent >= 60) return "#faad14";
    return "#f5222d";
  };

  const columns = [
    {
      title: "Người thực hiện",
      key: "candidate",
      fixed: "left",
      width: 240,
      render: (_, record) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar
            style={{ backgroundColor: MATCHA_GREEN }}
            icon={<UserOutlined />}
          />
          <div>
            <Text strong>{record.actorEmail || record.candidate}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.position || record.detail || "Không có mô tả"}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "Hành động",
      dataIndex: "type",
      key: "type",
      width: 170,
      render: (type) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status) => {
        const config = getStatusConfig(status);
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: "Thời gian",
      dataIndex: "date",
      key: "date",
      width: 180,
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY HH:mm") : "-"),
    },
    {
      title: "Chi tiết",
      dataIndex: "detail",
      key: "detail",
      width: 300,
      render: (detail) => <Text type="secondary">{detail || "-"}</Text>,
    },
  ];

  const filteredData = history.filter((item) => {
    const matchesSearch =
      !searchText ||
      (item.candidate || "").toLowerCase().includes(searchText.toLowerCase()) ||
      (item.position || "").toLowerCase().includes(searchText.toLowerCase()) ||
      (item.actorEmail || "")
        .toLowerCase()
        .includes(searchText.toLowerCase()) ||
      (item.detail || "").toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalInterviews = history.length;
  const completedInterviews = history.filter(
    (i) => i.status === "COMPLETED",
  ).length;
  const avgScore =
    history.filter((i) => i.graded && i.score !== null).length > 0
      ? Math.round(
          history
            .filter((i) => i.graded && i.score !== null)
            .reduce((sum, i) => sum + i.score, 0) /
            history.filter((i) => i.graded && i.score !== null).length,
        )
      : 0;

  return (
    <div className="interview-history-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">
            Lịch Sử Phỏng Vấn
          </Title>
          <Text type="secondary">Xem lại các buổi phỏng vấn đã thực hiện</Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchHistory}
          loading={loading}
        >
          Làm mới
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Tổng phỏng vấn"
              value={totalInterviews}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: MATCHA_GREEN }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Đã hoàn thành"
              value={completedInterviews}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Điểm TB"
              value={avgScore}
              suffix="/ 50"
              prefix={<TeamOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
      </Row>

      <Card className="main-card" bordered={false}>
        <div className="table-toolbar">
          <div className="toolbar-left">
            <Select
              value={selectedJobId}
              onChange={(value) => setSelectedJobId(value)}
              style={{ width: 260 }}
              placeholder="Chọn công việc"
              allowClear
            >
              {jobs.map((job) => (
                <Option key={job.jobId || job.id} value={job.jobId || job.id}>
                  {job.title ||
                    job.jobTitle ||
                    `Công việc #${job.jobId || job.id}`}
                </Option>
              ))}
            </Select>
            <Select
              value={selectedApplicationId}
              onChange={(value) => setSelectedApplicationId(value)}
              style={{ width: 300 }}
              placeholder="Chọn ứng dụng"
              loading={applicationsLoading}
              allowClear
            >
              {applications.map((app) => (
                <Option key={app.id} value={app.id}>
                  {app.candidateName} - {app.position}
                </Option>
              ))}
            </Select>
            <Input
              placeholder="Tìm kiếm ứng viên, vị trí..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 260 }}
              allowClear
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 160 }}
            >
              <Option value="all">Tất cả trạng thái</Option>
              <Option value="COMPLETED">Đã hoàn thành</Option>
              <Option value="CANCELLED">Đã hủy</Option>
              <Option value="MISSED">Bỏ lỡ</Option>
              <Option value="NEW">Mới</Option>
              <Option value="SCREENING">Sàng lọc</Option>
              <Option value="QUIZ">Quiz</Option>
              <Option value="INTERVIEW">Phỏng vấn</Option>
            </Select>
          </div>
          <Text type="secondary">{filteredData.length} buổi phỏng vấn</Text>
        </div>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} buổi`,
          }}
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
  );
};

export default InterviewerInterviewHistory;
