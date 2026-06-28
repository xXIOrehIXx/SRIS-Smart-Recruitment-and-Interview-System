import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Typography, Button, Space, Row, Col, Card, Avatar, Tag, Statistic } from 'antd';
import { RightOutlined, UserOutlined, CalendarOutlined, CheckCircleOutlined, ArrowUpOutlined } from '@ant-design/icons';
import './Home.css';

const { Header, Content, Footer } = Layout;
const { Title, Paragraph, Text } = Typography;

const Home = () => {
  const navigate = useNavigate();
  
  const stats = [
    { title: 'Total Jobs', value: 24, suffix: '+', trend: '+12%' },
    { title: 'Active Candidates', value: 156, suffix: '', trend: '+8%' },
    { title: 'Interviews Scheduled', value: 45, suffix: '', trend: '+15%' },
    { title: 'Offers Sent', value: 12, suffix: '', trend: '+5%' },
  ];

  return (
    <Layout className="home-layout">
      {/* HEADER */}
      <Header className="home-header">
        <div className="header-logo">
          <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="#5D8C3E"/>
            <path d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z" stroke="white" strokeWidth="2"/>
            <path d="M20 22L24 26L28 22" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M24 18V26" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <h2>SRIS</h2>
        </div>
        <div className="nav-links">
          <a href="#product">Product</a>
          <a href="#pricing">Pricing</a>
          <a href="#resources">Resources</a>
          <a href="#customers">Customers</a>
        </div>
        <div className="header-actions">
          <Button type="text" className="login-btn" onClick={() => window.location.href = '/login'}>Log in</Button>
          <Button type="primary" shape="round" className="demo-btn" onClick={() => window.location.href = '/register'}>Book a demo</Button>
        </div>
      </Header>

      {/* HERO SECTION */}
      <Content className="home-content">
        <Row align="middle" justify="space-between" gutter={[64, 48]} className="hero-row">
          {/* Cột trái: Text & Nút bấm */}
          <Col xs={24} lg={11} className="hero-text-section">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              Smart Recruitment Platform
            </div>
            <Title level={1} className="hero-title">
              Tuyển dụng thông minh, <span className="highlight">phỏng vấn hiệu quả</span>
            </Title>
            <Paragraph className="hero-subtitle">
              Hệ thống quản lý tuyển dụng và phỏng vấn thông minh. Thu hút, quản lý và tuyển dụng những ứng viên tốt nhất một cách dễ dàng.
            </Paragraph>
            <Space size="middle" className="hero-buttons">
              <Button type="primary" size="large" shape="round" className="primary-btn" icon={<RightOutlined />} iconPosition="end">
                Book a demo
              </Button>
              <Button size="large" shape="round" className="secondary-btn" onClick={() => window.location.href = '/register'}>
                Try it for free
              </Button>
            </Space>
            <div className="hero-stats">
              <div className="stat-item">
                <span className="stat-value">500+</span>
                <span className="stat-label">Companies</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-value">10K+</span>
                <span className="stat-label">Candidates</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-value">98%</span>
                <span className="stat-label">Satisfaction</span>
              </div>
            </div>
          </Col>

          {/* Cột phải: Mockup bảng ứng viên (Kanban Pipeline) */}
          <Col xs={24} lg={13}>
            <div className="dashboard-mockup">
              <div className="mockup-header">
                <div>
                  <Title level={5} style={{ margin: 0 }}>Senior Frontend Developer</Title>
                  <Text type="secondary" className="job-location">Hanoi, Vietnam</Text>
                </div>
                <Tag color="processing" className="status-tag">Active</Tag>
              </div>
              
              <Row gutter={16} className="pipeline-board">
                <Col span={8}>
                  <div className="pipeline-col">
                    <div className="col-title">Applied <span>(2)</span></div>
                    <Card size="small" className="candidate-card" bordered={false}>
                      <Card.Meta 
                        avatar={<Avatar icon={<UserOutlined />} style={{ backgroundColor: '#5D8C3E' }}/>} 
                        title="Alex Morgan" 
                        description="2 hours ago" 
                      />
                    </Card>
                    <Card size="small" className="candidate-card" bordered={false}>
                      <Card.Meta 
                        avatar={<Avatar icon={<UserOutlined />} style={{ backgroundColor: '#7BA55C' }}/>} 
                        title="Sam Smith" 
                        description="1 day ago" 
                      />
                    </Card>
                  </div>
                </Col>

                <Col span={8}>
                  <div className="pipeline-col">
                    <div className="col-title">Interview <span>(1)</span></div>
                    <Card size="small" className="candidate-card" bordered={false}>
                      <Card.Meta 
                        avatar={<Avatar src="https://api.dicebear.com/7.x/notionists/svg?seed=Jane" />} 
                        title="Jane Doe" 
                        description={<><CalendarOutlined /> Tomorrow, 10:00</>} 
                      />
                    </Card>
                  </div>
                </Col>

                <Col span={8}>
                  <div className="pipeline-col">
                    <div className="col-title">Offer <span>(1)</span></div>
                    <Card size="small" className="candidate-card offer-card" bordered={false}>
                      <Card.Meta 
                        avatar={<Avatar icon={<CheckCircleOutlined />} style={{ backgroundColor: '#52c41a' }}/>} 
                        title="John Connor" 
                        description="Offer Sent" 
                      />
                    </Card>
                  </div>
                </Col>
              </Row>
            </div>
          </Col>
        </Row>
      </Content>

      {/* STATS SECTION */}
      <section className="stats-section">
        <Row gutter={[32, 24]} justify="center">
          {stats.map((stat, index) => (
            <Col xs={12} sm={12} md={6} key={index}>
              <Card className="stat-card" bordered={false}>
                <Statistic 
                  title={stat.title} 
                  value={stat.value} 
                  suffix={stat.suffix}
                  valueStyle={{ color: '#5D8C3E', fontWeight: 700 }}
                />
                <div className="stat-trend">
                  <ArrowUpOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                  <span>{stat.trend} this month</span>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </section>

      {/* FEATURES SECTION */}
      <section className="features-section">
        <div className="section-header">
          <Title level={2} className="section-title">Why choose SRIS?</Title>
          <Paragraph className="section-subtitle">
            Everything you need to streamline your recruitment process
          </Paragraph>
        </div>
        <Row gutter={[24, 24]}>
          <Col xs={24} md={8}>
            <Card className="feature-card" bordered={false}>
              <div className="feature-icon">
                <UserOutlined />
              </div>
              <Title level={4}>Smart Candidate Management</Title>
              <Paragraph>Organize and track candidates through every stage of your hiring pipeline with our intuitive Kanban board.</Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card className="feature-card" bordered={false}>
              <div className="feature-icon">
                <CalendarOutlined />
              </div>
              <Title level={4}>Easy Scheduling</Title>
              <Paragraph>Schedule interviews with just a few clicks. Send automated reminders and calendar invites to candidates.</Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card className="feature-card" bordered={false}>
              <div className="feature-icon">
                <CheckCircleOutlined />
              </div>
              <Title level={4}>Collaborative Evaluation</Title>
              <Paragraph>Get real-time feedback from your interview team. Compare scores and make data-driven hiring decisions.</Paragraph>
            </Card>
          </Col>
        </Row>
      </section>

      {/* FOOTER */}
      <Footer className="home-footer">
        <Row justify="space-between" align="middle">
          <Col>
            <div className="footer-logo">
              <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="#5D8C3E"/>
                <path d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z" stroke="white" strokeWidth="2"/>
                <path d="M20 22L24 26L28 22" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M24 18V26" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>SRIS</span>
            </div>
          </Col>
          <Col>
            <Text type="secondary">© 2026 SRIS. All rights reserved.</Text>
          </Col>
        </Row>
      </Footer>
    </Layout>
  );
};

export default Home;
