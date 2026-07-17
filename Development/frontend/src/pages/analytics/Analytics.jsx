import React, { useState, useEffect } from "react";
import {
  Card,
  Typography,
  Row,
  Col,
  Statistic,
  Select,
  Space,
  DatePicker,
  Button,
  message,
  Spin,
} from "antd";
import {
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  BarChartOutlined,
  PieChartOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { dashboardAPI } from "../../services/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import "./css/Analytics.css";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const MATCHA_GREEN = "#5D8C3E";

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [funnel, setFunnel] = useState([]);
  const [sources, setSources] = useState([]);
  const [kanban, setKanban] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedJob]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [overviewRes, funnelRes, sourcesRes, kanbanRes] =
        await Promise.allSettled([
          dashboardAPI.getOverview(selectedJob),
          dashboardAPI.getFunnelData(selectedJob),
          dashboardAPI.getSourceAnalytics(),
          dashboardAPI.getKanban(selectedJob),
        ]);

      if (overviewRes.status === "fulfilled")
        setOverview(overviewRes.value.data);
      if (funnelRes.status === "fulfilled")
        setFunnel(funnelRes.value.data || []);
      if (sourcesRes.status === "fulfilled")
        setSources(sourcesRes.value.data || []);
      if (kanbanRes.status === "fulfilled")
        setKanban(kanbanRes.value.data?.columns || []);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      message.error("Không thể tải dữ liệu phân tích");
    } finally {
      setLoading(false);
    }
  };

  const funnelConfig = {
    data: funnel.map((item) => ({
      stage: item.stateLabel || item.state,
      count: item.count,
    })),
    margin: { top: 20, right: 30, left: 20, bottom: 20 },
  };

  const COLORS = ["#5D8C3E", "#7ab356", "#a8d48a", "#c8e4b4", "#e8f5dc"];

  const sourceData = (sources || []).map((s, i) => ({
    name: s.source || `Source ${i + 1}`,
    value: s.count || 0,
  }));

  if (loading && !overview) {
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

  const stats = [
    {
      title: "Tổng đơn ứng tuyển",
      value: overview?.summary?.totalApplications || 0,
      trend: "+12%",
      trendUp: true,
      icon: <FileTextOutlined />,
      color: "#1890ff",
    },
    {
      title: "Đang xử lý",
      value: overview?.summary?.inPipeline || 0,
      trend: "+8%",
      trendUp: true,
      icon: <ClockCircleOutlined />,
      color: "#faad14",
    },
    {
      title: "Đã tuyển",
      value: overview?.summary?.hired || 0,
      trend: "+3",
      trendUp: true,
      icon: <CheckCircleOutlined />,
      color: "#52c41a",
    },
    {
      title: "Từ chối",
      value: overview?.summary?.rejected || 0,
      trend: "-5%",
      trendUp: false,
      icon: <TeamOutlined />,
      color: "#f5222d",
    },
  ];

  return (
    <div className="analytics-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">
            Báo Cáo & Phân Tích
          </Title>
          <Text type="secondary">
            Theo dõi hiệu quả tuyển dụng với các biểu đồ trực quan
          </Text>
        </div>
        <Space>
          <Select
            placeholder="Lọc theo vị trí"
            allowClear
            style={{ width: 200 }}
            onChange={(val) => setSelectedJob(val || null)}
            value={selectedJob}
          />
          <RangePicker
            style={{ width: 260 }}
            placeholder={["Từ ngày", "Đến ngày"]}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchAnalytics}
            loading={loading}
          >
            Làm mới
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {stats.map((stat, idx) => (
          <Col xs={12} sm={12} md={6} key={idx}>
            <Card className="stat-card" bordered={false}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {stat.title}
                  </Text>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      color: "#1a1a1a",
                      lineHeight: 1.2,
                      marginTop: 4,
                    }}
                  >
                    {stat.value}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 8,
                    }}
                  >
                    {stat.trendUp ? (
                      <ArrowUpOutlined
                        style={{ color: "#52c41a", fontSize: 12 }}
                      />
                    ) : (
                      <ArrowDownOutlined
                        style={{ color: "#f5222d", fontSize: 12 }}
                      />
                    )}
                    <Text
                      style={{
                        color: stat.trendUp ? "#52c41a" : "#f5222d",
                        fontSize: 13,
                      }}
                    >
                      {stat.trend}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      so với tháng trước
                    </Text>
                  </div>
                </div>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: `${stat.color}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ color: stat.color, fontSize: 22 }}>
                    {stat.icon}
                  </span>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <span>
                <BarChartOutlined
                  style={{ color: MATCHA_GREEN, marginRight: 8 }}
                />
                Phễu Tuyển Dụng
              </span>
            }
            className="chart-card"
            bordered={false}
          >
            {funnel.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={funnelConfig.data}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e7e6" />
                  <XAxis dataKey="stage" tick={{ fontSize: 13 }} />
                  <YAxis tick={{ fontSize: 13 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e7e7e6",
                    }}
                    formatter={(value) => [value, "Ứng viên"]}
                  />
                  <Bar
                    dataKey="count"
                    fill={MATCHA_GREEN}
                    radius={[6, 6, 0, 0]}
                    name="Ứng viên"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{ textAlign: "center", padding: 40, color: "#8c8c8b" }}
              >
                Chưa có dữ liệu
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={
              <span>
                <PieChartOutlined
                  style={{ color: MATCHA_GREEN, marginRight: 8 }}
                />
                Nguồn Ứng Viên
              </span>
            }
            className="chart-card"
            bordered={false}
          >
            {sources.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <RePieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {sourceData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [value, name]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e7e7e6",
                    }}
                  />
                  <Legend />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{ textAlign: "center", padding: 40, color: "#8c8c8b" }}
              >
                Chưa có dữ liệu
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <BarChartOutlined
                  style={{ color: MATCHA_GREEN, marginRight: 8 }}
                />
                Xu hướng Tuyển Dụng
              </span>
            }
            className="chart-card"
            bordered={false}
          >
            <div style={{ textAlign: "center", padding: 40, color: "#8c8c8b" }}>
              Biểu đồ xu hướng theo thời gian
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <TrophyOutlined
                  style={{ color: MATCHA_GREEN, marginRight: 8 }}
                />
                Top Vị Trí Tuyển Nhanh
              </span>
            }
            className="chart-card"
            bordered={false}
          >
            <div style={{ textAlign: "center", padding: 40, color: "#8c8c8b" }}>
              Thống kê thời gian tuyển dụng trung bình
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Analytics;
