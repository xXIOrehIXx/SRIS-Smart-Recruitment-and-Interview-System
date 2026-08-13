import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  Layout,
  Typography,
  Button,
  Space,
  Row,
  Col,
  Card,
  Avatar,
  Tag,
  Statistic,
  Progress,
} from "antd";
import {
  UserOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ArrowUpOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  SolutionOutlined,
  FormOutlined,
  RightOutlined,
  StarFilled,
  AimOutlined,
  CheckOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import "./Home.css";

const { Header, Content, Footer } = Layout;
const { Title, Paragraph, Text } = Typography;

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, getDashboardRoute } = useAuth();

  const stats = [
    { title: "Total Jobs", value: 24, suffix: "+", trend: "+12%" },
    { title: "Active Candidates", value: 156, suffix: "", trend: "+8%" },
    { title: "Interviews Scheduled", value: 45, suffix: "", trend: "+15%" },
    { title: "Offers Sent", value: 12, suffix: "", trend: "+5%" },
  ];

  const workflowSteps = [
    {
      step: "01",
      icon: <FormOutlined />,
      title: "Tạo chiến dịch",
      desc: "Thiết lập mô tả công việc, tiêu chí đánh giá và xuất bản bài đăng nhanh chóng.",
    },
    {
      step: "02",
      icon: <RobotOutlined />,
      title: "Lọc CV tự động",
      desc: "Hệ thống AI quét và đề xuất những ứng viên phù hợp nhất dựa trên kỹ năng.",
    },
    {
      step: "03",
      icon: <CalendarOutlined />,
      title: "Lên lịch phỏng vấn",
      desc: "Tự động gửi email mời phỏng vấn, đồng bộ calendar cho người phỏng vấn.",
    },
    {
      step: "04",
      icon: <SolutionOutlined />,
      title: "Đánh giá & Offer",
      desc: "Tổng hợp Scorecard, so sánh kết quả và gửi thư mời nhận việc tức thì.",
    },
  ];

  return (
    <Layout className="home-layout">
      {/* HEADER */}
      <Header className="home-header">
        <div className="header-logo">
          <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="#5D8C3E" />
            <path
              d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z"
              stroke="white"
              strokeWidth="2"
            />
            <path
              d="M20 22L24 26L28 22"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M24 18V26"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <h2>SRIS</h2>
        </div>

        <nav className="nav-links">
          <a href="#features">Tính năng</a>
          <a href="#ai-copilot">AI Bóc tách tiêu chí</a>
          <a href="#workflow">Quy trình</a>
        </nav>

        <div className="header-actions">
          {isAuthenticated ? (
            <Space size="middle">
              <Text strong>{user?.fullName || user?.email}</Text>
              <Button
                type="primary"
                shape="round"
                className="dashboard-btn demo-btn"
                onClick={() => navigate(getDashboardRoute())}
              >
                Go to Dashboard
              </Button>
            </Space>
          ) : (
            <Space size="middle">
              <Button
                type="text"
                className="login-btn"
                onClick={() => navigate("/login")}
              >
                Log in
              </Button>
              <Button
                type="primary"
                shape="round"
                className="demo-btn"
                onClick={() => navigate("/login")}
              >
                Khám phá ngay
              </Button>
            </Space>
          )}
        </div>
      </Header>

      {/* HERO SECTION */}
      <Content className="home-content">
        <Row
          align="middle"
          justify="space-between"
          gutter={[64, 48]}
          className="hero-row"
        >
          {/* Cột trái: Text & Nội dung */}
          <Col xs={24} lg={11} className="hero-text-section">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              Smart Recruitment Platform
            </div>
            <Title level={1} className="hero-title">
              Tuyển dụng thông minh,{" "}
              <span className="highlight">phỏng vấn hiệu quả</span>
            </Title>
            <Paragraph className="hero-subtitle">
              Hệ thống quản lý tuyển dụng và phỏng vấn thông minh. Thu hút, quản
              lý và tuyển dụng những ứng viên tốt nhất một cách dễ dàng.
            </Paragraph>
            <Space size="middle" className="hero-buttons">
              <Button
                size="large"
                className="secondary-btn"
                onClick={() => {
                  document
                    .getElementById("workflow")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Xem quy trình <RightOutlined />
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
                  <Title level={5} style={{ margin: 0 }}>
                    Senior Frontend Developer
                  </Title>
                  <Text type="secondary" className="job-location">
                    Hanoi, Vietnam
                  </Text>
                </div>
                <Tag color="processing" className="status-tag">
                  Active
                </Tag>
              </div>

              <Row gutter={16} className="pipeline-board">
                <Col span={8}>
                  <div className="pipeline-col">
                    <div className="col-title">
                      Applied <span>(2)</span>
                    </div>
                    <Card
                      size="small"
                      className="candidate-card"
                      bordered={false}
                    >
                      <Card.Meta
                        avatar={
                          <Avatar
                            icon={<UserOutlined />}
                            style={{ backgroundColor: "#5D8C3E" }}
                          />
                        }
                        title="Alex Morgan"
                        description="2 hours ago"
                      />
                    </Card>
                    <Card
                      size="small"
                      className="candidate-card"
                      bordered={false}
                    >
                      <Card.Meta
                        avatar={
                          <Avatar
                            icon={<UserOutlined />}
                            style={{ backgroundColor: "#7BA55C" }}
                          />
                        }
                        title="Sam Smith"
                        description="1 day ago"
                      />
                    </Card>
                  </div>
                </Col>

                <Col span={8}>
                  <div className="pipeline-col">
                    <div className="col-title">
                      Interview <span>(1)</span>
                    </div>
                    <Card
                      size="small"
                      className="candidate-card"
                      bordered={false}
                    >
                      <Card.Meta
                        avatar={
                          <Avatar src="https://api.dicebear.com/7.x/notionists/svg?seed=Jane" />
                        }
                        title="Jane Doe"
                        description={
                          <>
                            <CalendarOutlined /> Tomorrow, 10:00
                          </>
                        }
                      />
                    </Card>
                  </div>
                </Col>

                <Col span={8}>
                  <div className="pipeline-col">
                    <div className="col-title">
                      Offer <span>(1)</span>
                    </div>
                    <Card
                      size="small"
                      className="candidate-card offer-card"
                      bordered={false}
                    >
                      <Card.Meta
                        avatar={
                          <Avatar
                            icon={<CheckCircleOutlined />}
                            style={{ backgroundColor: "#52c41a" }}
                          />
                        }
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
                  valueStyle={{ color: "#5D8C3E", fontWeight: 700 }}
                />
                <div className="stat-trend">
                  <ArrowUpOutlined
                    style={{ color: "#52c41a", marginRight: 4 }}
                  />
                  <span>{stat.trend} this month</span>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </section>

      {/* FEATURES SECTION */}
      <section className="features-section" id="features">
        <div className="section-header">
          <Title level={2} className="section-title">
            Why choose SRIS?
          </Title>
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
              <Paragraph>
                Organize and track candidates through every stage of your hiring
                pipeline with our intuitive Kanban board.
              </Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card className="feature-card" bordered={false}>
              <div className="feature-icon">
                <CalendarOutlined />
              </div>
              <Title level={4}>Easy Scheduling</Title>
              <Paragraph>
                Schedule interviews with just a few clicks. Send automated
                reminders and calendar invites to candidates.
              </Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card className="feature-card" bordered={false}>
              <div className="feature-icon">
                <CheckCircleOutlined />
              </div>
              <Title level={4}>Collaborative Evaluation</Title>
              <Paragraph>
                Get real-time feedback from your interview team. Compare scores
                and make data-driven hiring decisions.
              </Paragraph>
            </Card>
          </Col>
        </Row>
      </section>

      {/* SECTION 1: AI BÓC TÁCH TIÊU CHÍ */}
      <section className="ai-section" id="ai-copilot">
        <div className="section-container">
          <Row align="middle" gutter={[48, 48]}>
            {/* Cột trái: Card mô phỏng UI Dashboard AI */}
            <Col xs={24} lg={12}>
              <Card className="ai-preview-card" bordered={false}>
                <div className="ai-badge-header">
                  <div className="ai-title-group">
                    <div className="ai-icon-wrapper">
                      <RobotOutlined />
                    </div>
                    <div className="ai-header-text-group">
                      <Text strong className="ai-header-text">
                        SRIS AI - Matrix Evaluation
                      </Text>
                      <Text type="secondary" className="ai-header-sub">
                        Tự động phân tích & Bóc tách JD
                      </Text>
                    </div>
                  </div>
                  <Tag color="green" className="ai-status-pill">
                    Live Screening
                  </Tag>
                </div>

                {/* Bảng ma trận tiêu chí */}
                <div className="criteria-matrix">
                  <div className="criteria-row">
                    <div className="criteria-info">
                      <span className="criteria-name">
                        <AimOutlined className="icon-tech" />
                        Chuyên môn React / Frontend
                      </span>
                      <span className="criteria-weight">Trọng số: 35%</span>
                    </div>
                    <div className="criteria-progress">
                      <Progress
                        percent={92}
                        strokeColor={{ "0%": "#7BA55C", "100%": "#5D8C3E" }}
                        format={(percent) => (
                          <span className="score-badge">{percent}/100</span>
                        )}
                      />
                    </div>
                  </div>

                  <div className="criteria-row">
                    <div className="criteria-info">
                      <span className="criteria-name">
                        <ThunderboltOutlined className="icon-arch" />
                        Kinh nghiệm dự án & Kiến trúc
                      </span>
                      <span className="criteria-weight">Trọng số: 30%</span>
                    </div>
                    <div className="criteria-progress">
                      <Progress
                        percent={85}
                        strokeColor={{ "0%": "#7BA55C", "100%": "#5D8C3E" }}
                        format={(percent) => (
                          <span className="score-badge">{percent}/100</span>
                        )}
                      />
                    </div>
                  </div>

                  <div className="criteria-row">
                    <div className="criteria-info">
                      <span className="criteria-name">
                        <SafetyCertificateOutlined className="icon-soft" />
                        Ngoại ngữ & Soft Skills
                      </span>
                      <span className="criteria-weight">Trọng số: 20%</span>
                    </div>
                    <div className="criteria-progress">
                      <Progress
                        percent={80}
                        strokeColor={{ "0%": "#7BA55C", "100%": "#5D8C3E" }}
                        format={(percent) => (
                          <span className="score-badge">{percent}/100</span>
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Thẻ tổng hợp điểm */}
                <div className="ai-scorecard-summary">
                  <div className="scorecard-total">
                    <span className="total-label">ĐIỂM PHÙ HỢP TỔNG THỂ</span>
                    <div className="total-val-wrapper">
                      <span className="total-val">87.5</span>
                      <span className="total-max">/ 100</span>
                    </div>
                  </div>
                  <div className="scorecard-tags">
                    <Tag icon={<CheckOutlined />} className="tag-pass">
                      Đạt ngưỡng phỏng vấn
                    </Tag>
                    <Tag icon={<StarFilled />} className="tag-fit">
                      High Fit
                    </Tag>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Cột phải: Nội dung giải thích */}
            <Col xs={24} lg={12}>
              <div className="ai-text-content">
                <div className="sub-tag-pill">
                  <ThunderboltOutlined /> AI CRITERIA EXTRACTION
                </div>
                <Title level={2} className="ai-title">
                  Tự động bóc tách tiêu chí & Chấm điểm chuẩn hóa
                </Title>
                <Paragraph className="ai-description">
                  AI tự động phân tích Mô tả công việc (JD) để lập ra bảng tiêu
                  chí đánh giá đa chiều với từng trọng số tương ứng. Giúp loại
                  bỏ định kiến cá nhân và đưa ra điểm số ứng viên minh bạch
                  nhất.
                </Paragraph>
                <div className="ai-feature-list">
                  <div className="ai-feature-item">
                    <div className="check-bullet">
                      <CheckOutlined />
                    </div>
                    <div>
                      <strong>Phân rã JD thành Ma trận tiêu chí (Scorecard)</strong>
                      <p>
                        Tự động trích xuất các yêu cầu Kỹ năng cứng, Kỹ năng
                        mềm và Kinh nghiệm tối thiểu.
                      </p>
                    </div>
                  </div>
                  <div className="ai-feature-item">
                    <div className="check-bullet">
                      <CheckOutlined />
                    </div>
                    <div>
                      <strong>Gán trọng số & Chấm điểm tự động</strong>
                      <p>
                        Tính toán điểm số ứng viên dựa trên thang điểm chuẩn hóa
                        trước khi vào vòng phỏng vấn.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </div>
      </section>

      {/* SECTION 2: QUY TRÌNH TUYỂN DỤNG (BỌC CARD) */}
      <section className="workflow-section" id="workflow">
        <div className="section-container">
          <div className="section-header">
            <span className="sub-tag-pill">HOW IT WORKS</span>
            <Title level={2} className="section-title">
              Quy trình tuyển dụng tối ưu
            </Title>
            <Paragraph className="section-subtitle">
              4 bước đơn giản giúp doanh nghiệp chuẩn hóa và tăng tốc tuyển dụng
            </Paragraph>
          </div>

          <Row gutter={[24, 24]}>
            {workflowSteps.map((item, index) => (
              <Col xs={24} sm={12} lg={6} key={index}>
                <Card className="workflow-card" bordered={false}>
                  <div className="step-number">{item.step}</div>
                  <div className="workflow-icon">{item.icon}</div>
                  <Title level={4} className="workflow-card-title">
                    {item.title}
                  </Title>
                  <Paragraph className="workflow-card-desc">
                    {item.desc}
                  </Paragraph>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </section>

      {/* SECTION 3: CTA BANNER (ĐƯA VÀO GIỮA) */}
      <section className="cta-section">
        <div className="section-container">
          <div className="cta-container">
            <Title
              level={2}
              style={{
                color: "#ffffff",
                marginBottom: "16px",
                fontSize: "32px",
              }}
            >
              Sẵn sàng nâng tầm quy trình tuyển dụng của bạn?
            </Title>
            <Paragraph
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: "16px",
                marginBottom: "32px",
                maxWidth: "600px",
                margin: "0 auto 32px",
              }}
            >
              Trải nghiệm ngay giải pháp quản trị phỏng vấn và tuyển dụng thông
              minh SRIS hoàn toàn miễn phí.
            </Paragraph>
            <Button
              size="large"
              className="cta-btn"
              onClick={() => navigate("/login")}
            >
              Bắt đầu ngay
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <Footer className="home-footer">
        <Row justify="space-between" align="middle">
          <Col>
            <div className="footer-logo">
              <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="#5D8C3E" />
                <path
                  d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z"
                  stroke="white"
                  strokeWidth="2"
                />
                <path
                  d="M20 22L24 26L28 22"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M24 18V26"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
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