import React, { useState, useEffect } from "react";
import {
  Row,
  Col,
  Card,
  Typography,
  Statistic,
  Table,
  Tag,
  Avatar,
  Button,
  Space,
  Progress,
  Spin,
  message,
} from "antd";
import {
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  RightOutlined,
  RiseOutlined,
  AuditOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { dashboardAPI } from "../../services/api";
import "../Dashboard.css";

const { Title, Text } = Typography;

const MATCHA_GREEN = "#5D8C3E";

const DeptManagerDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const res = await dashboardAPI.getOverview();
        setOverview(res.data);
      } catch (error) {
        console.error("Lỗi khi lấy dữ liệu dashboard:", error);
        message.error("Không thể tải dữ liệu tổng quan");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const pendingRequests = [
    {
      id: 1,
      title: "Senior Frontend Developer",
      department: "Engineering",
      positions: 2,
      priority: "High",
      submittedDate: "08/07/2026",
      status: "PENDING",
    },
    {
      id: 2,
      title: "UI/UX Designer",
      department: "Design",
      positions: 1,
      priority: "Medium",
      submittedDate: "07/07/2026",
      status: "PENDING",
    },
  ];

  const recentDecisions = [
    {
      id: 1,
      candidate: "Nguyễn Văn Minh",
      position: "Backend Developer",
      action: "APPROVED",
      date: "07/07/2026",
    },
    {
      id: 2,
      candidate: "Trần Thị Lan",
      position: "QA Engineer",
      action: "APPROVED",
      date: "06/07/2026",
    },
  ];

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "High":
        return "error";
      case "Medium":
        return "warning";
      case "Low":
        return "success";
      default:
        return "default";
    }
  };

  const getActionColor = (action) => {
    return action === "APPROVED" ? "success" : "error";
  };

  const columns = [
    {
      title: "Vị trí",
      dataIndex: "title",
      key: "title",
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.department}
          </Text>
        </div>
      ),
    },
    {
      title: "Số lượng",
      dataIndex: "positions",
      key: "positions",
      width: 100,
      render: (val) => <Tag color="blue">{val} vị trí</Tag>,
    },
    {
      title: "Mức ưu tiên",
      dataIndex: "priority",
      key: "priority",
      width: 110,
      render: (val) => <Tag color={getPriorityColor(val)}>{val}</Tag>,
    },
    {
      title: "Ngày gửi",
      dataIndex: "submittedDate",
      key: "submittedDate",
      width: 110,
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/dept/hiring-decision/${record.id}`)}
          >
            Xem
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={() => navigate(`/dept/hiring-decision`)}
            style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
          >
            Duyệt
          </Button>
        </Space>
      ),
    },
  ];

  const decisionColumns = [
    {
      title: "Ứng viên",
      key: "candidate",
      render: (_, record) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar
            style={{ backgroundColor: MATCHA_GREEN }}
            icon={<UserOutlined />}
          />
          <Text strong>{record.candidate}</Text>
        </div>
      ),
    },
    {
      title: "Vị trí",
      dataIndex: "position",
      key: "position",
    },
    {
      title: "Quyết định",
      dataIndex: "action",
      key: "action",
      render: (val) => (
        <Tag color={getActionColor(val)}>
          {val === "APPROVED" ? "Đã duyệt" : "Từ chối"}
        </Tag>
      ),
    },
    {
      title: "Ngày",
      dataIndex: "date",
      key: "date",
    },
  ];

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  const stats = [
    {
      title: "Tổng Hồ Sơ Ứng Tuyển",
      value: overview?.summary?.totalApplications || 0,
      icon: <FileTextOutlined />,
      color: "#1890ff",
      onClick: null,
    },
    {
      title: "Hồ Sơ Đang Chờ Xử Lý",
      value: overview?.summary?.inPipeline || 0,
      icon: <ClockCircleOutlined />,
      color: "#faad14",
      onClick: () => navigate("/dept/hiring-decision"),
    },
    {
      title: "Đã Tuyển Được",
      value: overview?.summary?.hired || 0,
      icon: <CheckCircleOutlined />,
      color: "#52c41a",
      onClick: null,
    },
    {
      title: "Tỉ Lệ Chuyển Đổi (%)",
      value: overview?.summary?.conversionRatePct || 0,
      icon: <RiseOutlined />,
      color: "#722ed1",
    },
  ];

  return (
    <div className="dashboard-page dept-dashboard">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">
            Dashboard - Trưởng Phòng
          </Title>
          <Text type="secondary">
            Tổng quan yêu cầu tuyển dụng và quyết định hiring
          </Text>
        </div>
        <Button
          type="primary"
          icon={<FileTextOutlined />}
          onClick={() => navigate("/dept/create-request")}
          style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
        >
          Tạo Yêu Cầu Tuyển Dụng
        </Button>
      </div>

      <Row gutter={[20, 20]} className="stats-row">
        {stats.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card
              className="stat-card"
              bordered={false}
              hoverable={!!stat.onClick}
              onClick={stat.onClick}
              style={{ cursor: stat.onClick ? "pointer" : "default" }}
            >
              <div className="stat-card-content">
                <div className="stat-info">
                  <Text type="secondary" className="stat-title">
                    {stat.title}
                  </Text>
                  <span className="stat-value">{stat.value}</span>
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

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={14}>
          <Card className="dashboard-card" bordered={false}>
            <div className="card-header">
              <Title level={5}>Yêu Cầu Chờ Phê Duyệt</Title>
              <Button
                type="link"
                onClick={() => navigate("/dept/hiring-decision")}
              >
                Xem tất cả <RightOutlined />
              </Button>
            </div>
            <Table
              columns={columns}
              dataSource={pendingRequests}
              rowKey="id"
              pagination={false}
              scroll={{ x: 650 }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card className="dashboard-card" bordered={false}>
            <div className="card-header">
              <Title level={5}>Quyết Định Gần Đây</Title>
              <Button
                type="link"
                onClick={() => navigate("/dept/hiring-decision")}
              >
                Xem tất cả <RightOutlined />
              </Button>
            </div>
            <Table
              columns={decisionColumns}
              dataSource={recentDecisions}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} lg={12}>
          <Card className="dashboard-card" bordered={false}>
            <div className="card-header">
              <Title level={5}>Tiến Độ Tuyển Dụng Theo Phễu (Trạng Thái)</Title>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {overview?.funnel
                ?.filter((f) => f.count > 0)
                .map((stage, idx) => {
                  const percent =
                    overview.summary.totalApplications > 0
                      ? (stage.count / overview.summary.totalApplications) * 100
                      : 0;
                  let color = MATCHA_GREEN;
                  if (stage.state === "REJECTED") color = "#f5222d";
                  else if (stage.state === "HIRED") color = "#52c41a";
                  else if (stage.state === "NEW") color = "#1890ff";

                  return (
                    <div key={idx}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <Text>{stage.state}</Text>
                        <Text type="secondary">{stage.count} hồ sơ</Text>
                      </div>
                      <Progress
                        percent={percent}
                        showInfo={false}
                        strokeColor={color}
                      />
                    </div>
                  );
                })}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card className="dashboard-card" bordered={false}>
            <div className="card-header">
              <Title level={5}>Lý Do Loại Ứng Viên Phổ Biến</Title>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {overview?.rejectReasons?.slice(0, 5).map((reason, idx) => (
                <div
                  key={idx}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
                >
                  <Avatar
                    size={32}
                    style={{
                      backgroundColor: `#f5222d15`,
                      color: "#f5222d",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                    icon={<CloseCircleOutlined />}
                  />
                  <div>
                    <Text style={{ display: "block" }}>{reason.label}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {reason.count} hồ sơ ({reason.percentage}%)
                    </Text>
                  </div>
                </div>
              ))}
              {(!overview?.rejectReasons ||
                overview.rejectReasons.length === 0) && (
                <Text type="secondary">Chưa có dữ liệu</Text>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DeptManagerDashboard;
