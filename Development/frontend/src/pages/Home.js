import React from 'react';
import { Layout, Typography, Button, Space, Row, Col, Card, Avatar, Tag } from 'antd';
import { RightOutlined, UserOutlined, CalendarOutlined, CheckCircleOutlined } from '@ant-design/icons';
import './Home.css';

const { Header, Content } = Layout;
const { Title, Paragraph } = Typography;

const Home = () => {
  return (
    <Layout className="home-layout">
      {/* HEADER */}
      <Header className="home-header">
        <div className="logo">
          <h2>Teamtailor</h2>
        </div>
        <div className="nav-links">
          <Button type="text">Product</Button>
          <Button type="text">Pricing</Button>
          <Button type="text">Resources</Button>
        </div>
        <div className="header-actions">
          <Button type="text" className="login-btn">Log in</Button>
          <Button type="primary" shape="round">Book a demo</Button>
        </div>
      </Header>

      {/* HERO SECTION */}
      <Content className="home-content">
        <Row align="middle" justify="space-between" gutter={[48, 48]} className="hero-row">
          
          {/* Cột trái: Text & Nút bấm */}
          <Col xs={24} lg={12} className="hero-text-section">
            <Title level={1} className="hero-title">
              The recruitment software your team will love
            </Title>
            <Paragraph className="hero-subtitle">
              Attract, manage, and hire the best talent. Everything you need from the first application to a signed offer lives in one place.
            </Paragraph>
            <Space size="middle" className="hero-buttons">
              <Button type="primary" size="large" shape="round" icon={<RightOutlined />} iconPosition="end">
                Book a demo
              </Button>
              <Button size="large" shape="round">
                Try it for free
              </Button>
            </Space>
          </Col>

          {/* Cột phải: Mockup bảng ứng viên (Kanban Pipeline) */}
          <Col xs={24} lg={12}>
            <div className="dashboard-mockup">
              <div className="mockup-header">
                <Title level={5} style={{ margin: 0 }}>Senior Frontend Developer</Title>
                <Tag color="processing">Active</Tag>
              </div>
              
              <Row gutter={16} className="pipeline-board">
                {/* Cột Applied */}
                <Col span={8}>
                  <div className="pipeline-col">
                    <div className="col-title">Applied <span>(2)</span></div>
                    <Card size="small" className="candidate-card" bordered={false}>
                      <Card.Meta 
                        avatar={<Avatar icon={<UserOutlined />} style={{ backgroundColor: '#f56a00' }}/>} 
                        title="Alex Morgan" 
                        description="2 hours ago" 
                      />
                    </Card>
                    <Card size="small" className="candidate-card" bordered={false}>
                      <Card.Meta 
                        avatar={<Avatar icon={<UserOutlined />} style={{ backgroundColor: '#87d068' }}/>} 
                        title="Sam Smith" 
                        description="1 day ago" 
                      />
                    </Card>
                  </div>
                </Col>

                {/* Cột Interview */}
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

                {/* Cột Offer */}
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
    </Layout>
  );
};

export default Home;