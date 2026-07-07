import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Typography, Statistic, Table, Tag, Avatar, Button, Space, Progress } from 'antd';
import {
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  RightOutlined,
  RiseOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import '../Dashboard.css';

const { Title, Text } = Typography;

const MATCHA_GREEN = '#5D8C3E';

const DeptManagerDashboard = () => {
  const navigate = useNavigate();

  const stats = [
    {
      title: 'Yêu Cầu Tuyển Dụng',
      value: 12,
      icon: <FileTextOutlined />,
      color: '#5D8C3E',
      onClick: () => navigate('/dept/requests'),
    },
    {
      title: 'Chờ Phê Duyệt',
      value: 5,
      icon: <ClockCircleOutlined />,
      color: '#faad14',
      onClick: () => navigate('/dept/hiring-decision'),
    },
    {
      title: 'Đã Phê Duyệt',
      value: 7,
      icon: <CheckCircleOutlined />,
      color: '#52c41a',
      onClick: () => navigate('/dept/hiring-decision'),
    },
    {
      title: 'Ứng Viên Quan Tâm',
      value: 34,
      icon: <TeamOutlined />,
      color: '#1890ff',
    },
  ];

  const pendingRequests = [
    {
      id: 1,
      title: 'Senior Frontend Developer',
      department: 'Engineering',
      positions: 2,
      priority: 'High',
      submittedDate: '08/07/2026',
      status: 'PENDING',
    },
    {
      id: 2,
      title: 'UI/UX Designer',
      department: 'Design',
      positions: 1,
      priority: 'Medium',
      submittedDate: '07/07/2026',
      status: 'PENDING',
    },
    {
      id: 3,
      title: 'DevOps Engineer',
      department: 'Infrastructure',
      positions: 1,
      priority: 'High',
      submittedDate: '06/07/2026',
      status: 'PENDING',
    },
    {
      id: 4,
      title: 'Product Manager',
      department: 'Product',
      positions: 1,
      priority: 'Medium',
      submittedDate: '05/07/2026',
      status: 'PENDING',
    },
  ];

  const recentDecisions = [
    {
      id: 1,
      candidate: 'Nguyễn Văn Minh',
      position: 'Backend Developer',
      action: 'APPROVED',
      date: '07/07/2026',
    },
    {
      id: 2,
      candidate: 'Trần Thị Lan',
      position: 'QA Engineer',
      action: 'APPROVED',
      date: '06/07/2026',
    },
    {
      id: 3,
      candidate: 'Lê Hoàng Nam',
      position: 'Frontend Developer',
      action: 'REJECTED',
      date: '05/07/2026',
    },
  ];

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High':
        return 'error';
      case 'Medium':
        return 'warning';
      case 'Low':
        return 'success';
      default:
        return 'default';
    }
  };

  const getActionColor = (action) => {
    return action === 'APPROVED' ? 'success' : 'error';
  };

  const columns = [
    {
      title: 'Vị trí',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.department}</Text>
        </div>
      ),
    },
    {
      title: 'Số lượng',
      dataIndex: 'positions',
      key: 'positions',
      width: 100,
      render: (val) => <Tag color="blue">{val} vị trí</Tag>,
    },
    {
      title: 'Mức ưu tiên',
      dataIndex: 'priority',
      key: 'priority',
      width: 110,
      render: (val) => <Tag color={getPriorityColor(val)}>{val}</Tag>,
    },
    {
      title: 'Ngày gửi',
      dataIndex: 'submittedDate',
      key: 'submittedDate',
      width: 110,
    },
    {
      title: 'Thao tác',
      key: 'actions',
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
      title: 'Ứng viên',
      key: 'candidate',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />
          <Text strong>{record.candidate}</Text>
        </div>
      ),
    },
    {
      title: 'Vị trí',
      dataIndex: 'position',
      key: 'position',
    },
    {
      title: 'Quyết định',
      dataIndex: 'action',
      key: 'action',
      render: (val) => <Tag color={getActionColor(val)}>{val === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'}</Tag>,
    },
    {
      title: 'Ngày',
      dataIndex: 'date',
      key: 'date',
    },
  ];

  return (
    <div className="dashboard-page dept-dashboard">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Dashboard - Trưởng Phòng</Title>
          <Text type="secondary">Tổng quan yêu cầu tuyển dụng và quyết định hiring</Text>
        </div>
        <Button
          type="primary"
          icon={<FileTextOutlined />}
          onClick={() => navigate('/dept/create-request')}
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
              style={{ cursor: stat.onClick ? 'pointer' : 'default' }}
            >
              <div className="stat-card-content">
                <div className="stat-info">
                  <Text type="secondary" className="stat-title">{stat.title}</Text>
                  <span className="stat-value">{stat.value}</span>
                </div>
                <div className="stat-icon" style={{ backgroundColor: `${stat.color}15` }}>
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
              <Button type="link" onClick={() => navigate('/dept/hiring-decision')}>
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
              <Button type="link" onClick={() => navigate('/dept/hiring-decision')}>
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
              <Title level={5}>Tiến Độ Tuyển Dụng Theo Phòng Ban</Title>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>Engineering</Text>
                  <Text type="secondary">8/10 vị trí</Text>
                </div>
                <Progress percent={80} strokeColor={MATCHA_GREEN} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>Design</Text>
                  <Text type="secondary">3/5 vị trí</Text>
                </div>
                <Progress percent={60} strokeColor="#1890ff" />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>Product</Text>
                  <Text type="secondary">2/3 vị trí</Text>
                </div>
                <Progress percent={67} strokeColor="#faad14" />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>Infrastructure</Text>
                  <Text type="secondary">1/4 vị trí</Text>
                </div>
                <Progress percent={25} strokeColor="#f5222d" />
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card className="dashboard-card" bordered={false}>
            <div className="card-header">
              <Title level={5}>Hoạt Động Gần Đây</Title>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { text: 'Yêu cầu "Senior Frontend Developer" đã được gửi', time: '2 giờ trước', icon: <FileTextOutlined /> },
                { text: 'Ứng viên Nguyễn Văn Minh được phê duyệt', time: '5 giờ trước', icon: <CheckCircleOutlined /> },
                { text: 'Yêu cầu "UI/UX Designer" chờ duyệt', time: '1 ngày trước', icon: <ClockCircleOutlined /> },
                { text: 'Yêu cầu "DevOps Engineer" được tạo mới', time: '2 ngày trước', icon: <AuditOutlined /> },
              ].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Avatar
                    size={32}
                    style={{ backgroundColor: `${MATCHA_GREEN}15`, color: MATCHA_GREEN, flexShrink: 0, marginTop: 2 }}
                    icon={item.icon}
                  />
                  <div>
                    <Text style={{ display: 'block' }}>{item.text}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.time}</Text>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DeptManagerDashboard;
