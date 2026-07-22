import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Statistic, Select, Space, DatePicker, Button, message, Spin } from 'antd';
import {
  TeamOutlined, FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined,
  TrophyOutlined, BarChartOutlined, PieChartOutlined,
  ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined
} from '@ant-design/icons';
import { dashboardAPI, jobsAPI } from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend } from 'recharts';
import './css/Analytics.css';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const MATCHA_GREEN = '#5D8C3E';

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedJob]);

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      setJobs(response.data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  // Funnel + nguồn ứng viên nằm ngay trong /dashboard/overview
  // (DashboardOverviewDto: { summary, funnel, rejectReasons, sources })
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getOverview(selectedJob);
      setOverview(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      message.error('Không thể tải dữ liệu phân tích');
    } finally {
      setLoading(false);
    }
  };

  const funnel = overview?.funnel || [];
  const sources = overview?.sources || [];

  const STATE_LABELS = {
    NEW: 'Hồ sơ mới', SCREENING: 'Sàng lọc', INTERVIEW: 'Phỏng vấn',
    OFFER: 'Offer', HIRED: 'Đã tuyển', REJECTED: 'Từ chối',
  };

  const funnelConfig = {
    data: funnel.map(item => ({ stage: STATE_LABELS[item.state] || item.state, count: item.count })),
    margin: { top: 20, right: 30, left: 20, bottom: 20 },
  };

  const COLORS = ['#5D8C3E', '#7ab356', '#a8d48a', '#c8e4b4', '#e8f5dc'];

  // BreakdownItemDto: { label, count, percentage }
  const sourceData = sources.map((s, i) => ({ name: s.label || `Source ${i + 1}`, value: s.count || 0 }));

  if (loading && !overview) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  // Số thật từ /dashboard/overview — không hiển thị trend vì backend chưa có số liệu so kỳ trước
  const stats = [
    {
      title: 'Tổng đơn ứng tuyển',
      value: overview?.summary?.totalApplications || 0,
      icon: <FileTextOutlined />,
      color: '#1890ff',
    },
    {
      title: 'Đang xử lý',
      value: overview?.summary?.inPipeline || 0,
      icon: <ClockCircleOutlined />,
      color: '#faad14',
    },
    {
      title: 'Đã tuyển',
      value: overview?.summary?.hired || 0,
      icon: <CheckCircleOutlined />,
      color: '#52c41a',
    },
    {
      title: 'Từ chối',
      value: overview?.summary?.rejected || 0,
      icon: <TeamOutlined />,
      color: '#f5222d',
    },
  ];

  return (
    <div className="analytics-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Báo Cáo & Phân Tích</Title>
          <Text type="secondary">Theo dõi hiệu quả tuyển dụng với các biểu đồ trực quan</Text>
        </div>
        <Space>
          <Select
            placeholder="Lọc theo vị trí"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 200 }}
            onChange={(val) => setSelectedJob(val || null)}
            value={selectedJob}
            options={jobs.map(job => ({ value: job.jobId, label: job.title }))}
          />
          <RangePicker style={{ width: 260 }} placeholder={['Từ ngày', 'Đến ngày']} />
          <Button icon={<ReloadOutlined />} onClick={fetchAnalytics} loading={loading}>
            Làm mới
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {stats.map((stat, idx) => (
          <Col xs={12} sm={12} md={6} key={idx}>
            <Card className="stat-card" bordered={false}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 13 }}>{stat.title}</Text>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#1a1a1a', lineHeight: 1.2, marginTop: 4 }}>
                    {stat.value}
                  </div>
                </div>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: `${stat.color}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: stat.color, fontSize: 22 }}>{stat.icon}</span>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card
            title={<span><BarChartOutlined style={{ color: MATCHA_GREEN, marginRight: 8 }} />Phễu Tuyển Dụng</span>}
            className="chart-card"
            bordered={false}
          >
            {funnel.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={funnelConfig.data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e7e6" />
                  <XAxis dataKey="stage" tick={{ fontSize: 13 }} />
                  <YAxis tick={{ fontSize: 13 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e7e7e6' }}
                    formatter={(value) => [value, 'Ứng viên']}
                  />
                  <Bar dataKey="count" fill={MATCHA_GREEN} radius={[6, 6, 0, 0]} name="Ứng viên" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8b' }}>Chưa có dữ liệu</div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={<span><PieChartOutlined style={{ color: MATCHA_GREEN, marginRight: 8 }} />Nguồn Ứng Viên</span>}
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
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {sourceData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [value, name]}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e7e7e6' }}
                  />
                  <Legend />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8b' }}>Chưa có dữ liệu</div>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={<span><BarChartOutlined style={{ color: MATCHA_GREEN, marginRight: 8 }} />Xu hướng Tuyển Dụng</span>}
            className="chart-card"
            bordered={false}
          >
            <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8b' }}>
              Biểu đồ xu hướng theo thời gian
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={<span><TrophyOutlined style={{ color: MATCHA_GREEN, marginRight: 8 }} />Top Vị Trí Tuyển Nhanh</span>}
            className="chart-card"
            bordered={false}
          >
            <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8b' }}>
              Thống kê thời gian tuyển dụng trung bình
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Analytics;
