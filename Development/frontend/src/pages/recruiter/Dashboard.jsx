import React, { useEffect, useState } from "react";
import {
  Row,
  Col,
  Card,
  Tag,
  Avatar,
  Button,
  Typography,
  Spin,
  message,
  Select,
  Tooltip,
} from "antd";
import {
  FileTextOutlined,
  TeamOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  PlusOutlined,
  ClockCircleOutlined,
  UserOutlined,
  MailOutlined,
  TrophyOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useNavigate } from "react-router-dom";
import { dashboardAPI, applicationAPI } from "../../services/api";
import "./css/Dashboard.css";

const { Title, Text } = Typography;
const { Option } = Select;

const MATCHA_GREEN = "#5D8C3E";
const MATCHA_LIGHT = "rgba(93, 140, 62, 0.1)";

const STATE_COLORS = {
  NEW: "#1890ff",
  INTERVIEW: "#faad14",
  OFFER: "#52c41a",
};

const STATE_LABELS = {
  NEW: "Applied",
  INTERVIEW: "Interview",
  OFFER: "Offer",
};

const KANBAN_STATES = ["NEW", "INTERVIEW", "OFFER"];

// Forward-only state machine order (matches backend ApplicationStateMachine)
const STATE_ORDER = ["NEW", "SCREENING", "INTERVIEW", "OFFER", "HIRED"];

const RecruiterDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kanbanLoading, setKanbanLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [kanbanData, setKanbanData] = useState({ columns: [] });
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    fetchDashboardOverview();
    fetchJobs();
    fetchKanbanData();
  }, []);

  const fetchDashboardOverview = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getOverview();
      setDashboardData(response.data);
    } catch (error) {
      console.error("Error fetching dashboard overview:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await dashboardAPI.getOverview();
      if (response.data?.summary?.totalApplications > 0) {
        setJobs([]);
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
    }
  };

  const fetchKanbanData = async () => {
    try {
      setKanbanLoading(true);
      const response = await dashboardAPI.getKanban(selectedJob);
      setKanbanData(response.data || { columns: [] });
    } catch (error) {
      console.error("Error fetching kanban data:", error);
      message.error("Không thể tải dữ liệu Kanban");
    } finally {
      setKanbanLoading(false);
    }
  };

  const handleJobFilter = (jobId) => {
    setSelectedJob(jobId || null);
    fetchKanbanData();
  };

  /**
   * Compute the intermediate transition states needed to move from `fromState` to `toState`.
   * The backend is forward-only (one step at a time), so moving across multiple columns
   * (e.g. NEW → INTERVIEW) requires transitioning through each intermediate state (NEW → SCREENING → INTERVIEW).
   * Returns an array of target states in order, or null if the transition is invalid (backward).
   */
  const getTransitionSteps = (fromState, toState) => {
    const fromIdx = STATE_ORDER.indexOf(fromState);
    const toIdx = STATE_ORDER.indexOf(toState);
    if (fromIdx === -1 || toIdx === -1 || toIdx <= fromIdx) return null;
    return STATE_ORDER.slice(fromIdx + 1, toIdx + 1);
  };

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    )
      return;

    const sourceState = source.droppableId;
    const destState = destination.droppableId;
    const applicationId = draggableId;

    // Validate forward-only transition
    const steps = getTransitionSteps(sourceState, destState);
    if (!steps) {
      message.warning(
        "Chỉ được chuyển ứng viên theo chiều tiến (Applied → Interview → Offer).",
      );
      return;
    }

    // Save previous state for rollback
    const previousKanbanData = JSON.parse(JSON.stringify(kanbanData));

    // Optimistic update: move card between columns in local state
    const newColumns = kanbanData.columns.map((col) => ({
      ...col,
      cards: [...(col.cards || [])],
    }));
    const sourceCol = newColumns.find((col) => col.state === sourceState);
    const destCol = newColumns.find((col) => col.state === destState);

    if (!sourceCol || !destCol) return;

    const cardIndex = sourceCol.cards.findIndex(
      (c) => String(c.applicationId) === String(applicationId),
    );
    if (cardIndex === -1) return;

    const [movedCard] = sourceCol.cards.splice(cardIndex, 1);
    destCol.cards.splice(destination.index, 0, movedCard);

    // Update counts
    sourceCol.count = sourceCol.cards.length;
    destCol.count = destCol.cards.length;

    setKanbanData({ ...kanbanData, columns: newColumns });

    // Call backend API — execute each intermediate transition step sequentially
    try {
      for (const stepState of steps) {
        await applicationAPI.transition(applicationId, stepState);
      }
      message.success(
        `Đã chuyển ứng viên sang ${STATE_LABELS[destState] || destState}`,
      );
      // Refresh to get accurate server state
      fetchKanbanData();
      fetchDashboardOverview();
    } catch (error) {
      console.error("Error transitioning application:", error);
      const errorMsg =
        error.response?.data?.errorMessage ||
        error.response?.data?.message ||
        "Không thể chuyển trạng thái ứng viên";
      message.error(errorMsg);
      // Rollback optimistic update
      setKanbanData(previousKanbanData);
    }
  };

  // Stats cards data
  const stats = [
    {
      title: "Tổng Hồ Sơ",
      value: dashboardData?.summary?.totalApplications || 0,
      trend: "+12%",
      trendUp: true,
      icon: <FileTextOutlined />,
      color: MATCHA_GREEN,
    },
    {
      title: "Đang Xử Lý",
      value: dashboardData?.summary?.inPipeline || 0,
      trend: "+8%",
      trendUp: true,
      icon: <TeamOutlined />,
      color: "#1890ff",
    },
    {
      title: "Đã Tuyển",
      value: dashboardData?.summary?.hired || 0,
      trend: "+3",
      trendUp: true,
      icon: <CheckCircleOutlined />,
      color: "#52c41a",
    },
    {
      title: "Bị Từ Chối",
      value: dashboardData?.summary?.rejected || 0,
      trend: "-5%",
      trendUp: false,
      icon: <CloseOutlined />,
      color: "#f5222d",
    },
  ];

  // Kanban columns (exclude REJECTED from main view)
  const kanbanColumns =
    kanbanData.columns?.filter((col) => KANBAN_STATES.includes(col.state)) ||
    [];

  const getScoreColor = (score) => {
    if (score === null || score === undefined) return "#d9d9d9";
    if (score >= 80) return "#52c41a";
    if (score >= 60) return "#faad14";
    return "#f5222d";
  };

  const renderCandidateCard = (card, index) => {
    const scoreColor = getScoreColor(card.aiMatchScore);

    return (
      <Draggable
        key={card.applicationId}
        draggableId={String(card.applicationId)}
        index={index}
      >
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`kanban-card ${snapshot.isDragging ? "dragging" : ""}`}
            onClick={() =>
              navigate(`/recruiter/candidates/${card.applicationId}`)
            }
          >
            <div className="card-header">
              <Avatar
                size={32}
                style={{ backgroundColor: MATCHA_GREEN }}
                icon={<UserOutlined />}
              />
              <div className="card-info">
                <Text strong className="candidate-name">
                  {card.candidateName}
                </Text>
                <Text type="secondary" className="candidate-email">
                  <MailOutlined /> {card.candidateEmail}
                </Text>
              </div>
            </div>

            <div className="card-job">
              <Tag color="blue" icon={<FileTextOutlined />}>
                {card.jobTitle}
              </Tag>
            </div>

            <div className="card-footer">
              <div className="card-meta">
                <Tooltip title="Điểm AI">
                  <div
                    className="score-badge"
                    style={{
                      backgroundColor: `${scoreColor}20`,
                      color: scoreColor,
                    }}
                  >
                    <TrophyOutlined />{" "}
                    {card.aiMatchScore ? `${card.aiMatchScore}%` : "N/A"}
                  </div>
                </Tooltip>
                <Tooltip title="Ngày nộp">
                  <div className="date-badge">
                    <ClockCircleOutlined />{" "}
                    {new Date(card.appliedAt).toLocaleDateString("vi-VN")}
                  </div>
                </Tooltip>
              </div>
            </div>

            <div className="card-actions">
              <Button
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/recruiter/candidates/${card.applicationId}`);
                }}
              >
                Chi tiết
              </Button>
              <Button
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  message.info("Chuyển trạng thái");
                }}
              >
                Chuyển
              </Button>
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  if (loading && !dashboardData) {
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

  return (
    <div className="dashboard-page recruiter-dashboard">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">
            Dashboard Tuyển Dụng
          </Title>
          <Text type="secondary">
            Quản lý pipeline ứng viên với giao diện Kanban
          </Text>
        </div>
        <div className="header-actions">
          <Select
            placeholder="Lọc theo vị trí"
            allowClear
            style={{ width: 200, marginRight: 12 }}
            onChange={handleJobFilter}
            value={selectedJob}
          >
            {jobs.map((job) => (
              <Option key={job.jobId || job.id} value={job.jobId || job.id}>
                {job.title}
              </Option>
            ))}
          </Select>
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => navigate("/recruiter/jobs/create")}
          >
            Đăng Tin Mới
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <Row gutter={[20, 20]} className="stats-row">
        {stats.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card className="stat-card" bordered={false}>
              <div className="stat-card-content">
                <div className="stat-info">
                  <Text type="secondary" className="stat-title">
                    {stat.title}
                  </Text>
                  <div className="stat-value-row">
                    <span className="stat-value">{stat.value}</span>
                    <span
                      className={`stat-trend ${stat.trendUp ? "trend-up" : "trend-down"}`}
                    >
                      {stat.trendUp ? (
                        <ArrowUpOutlined />
                      ) : (
                        <ArrowDownOutlined />
                      )}
                      {stat.trend}
                    </span>
                  </div>
                </div>
                <div
                  className="stat-icon"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <span style={{ color: stat.color }}>{stat.icon}</span>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Kanban Board */}
      <Card className="dashboard-card kanban-card" bordered={false}>
        <div className="card-header">
          <Title level={5}>Pipeline Ứng Viên</Title>
          <Button
            type="link"
            icon={<PlusOutlined />}
            onClick={() => fetchKanbanData()}
          >
            Làm mới
          </Button>
        </div>

        {kanbanLoading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: 60,
            }}
          >
            <Spin size="large" />
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="kanban-board">
              {kanbanColumns.map((column) => (
                <div key={column.state} className="kanban-column">
                  <div
                    className="column-header"
                    style={{
                      borderTopColor:
                        STATE_COLORS[column.state] || MATCHA_GREEN,
                    }}
                  >
                    <div className="column-title">
                      <span
                        className="column-dot"
                        style={{
                          backgroundColor:
                            STATE_COLORS[column.state] || MATCHA_GREEN,
                        }}
                      ></span>
                      <Text strong>
                        {column.stateLabel ||
                          STATE_LABELS[column.state] ||
                          column.state}
                      </Text>
                      <Tag color={STATE_COLORS[column.state] || MATCHA_GREEN}>
                        {column.count}
                      </Tag>
                    </div>
                  </div>

                  <Droppable droppableId={column.state}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`column-cards ${snapshot.isDraggingOver ? "drag-over" : ""}`}
                      >
                        {column.cards && column.cards.length > 0 ? (
                          column.cards.map((card, index) =>
                            renderCandidateCard(card, index),
                          )
                        ) : (
                          <div className="empty-column">
                            <Text type="secondary">Chưa có ứng viên</Text>
                          </div>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        )}

        {(!kanbanData.columns || kanbanData.columns.length === 0) &&
          !kanbanLoading && (
            <div className="empty-board">
              <FileTextOutlined
                style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 16 }}
              />
              <Title level={5} type="secondary">
                Chưa có dữ liệu ứng viên
              </Title>
              <Text type="secondary">
                Hãy thêm ứng viên hoặc chọn vị trí tuyển dụng để xem pipeline
              </Text>
            </div>
          )}
      </Card>

      </div>
  );
};

export default RecruiterDashboard;
