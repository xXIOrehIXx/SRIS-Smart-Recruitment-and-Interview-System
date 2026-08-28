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
  Progress,
} from "antd";
import {
  UserOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  SolutionOutlined,
  FormOutlined,
  StarFilled,
  AimOutlined,
  CheckOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import "./Home.css";
import LogoIcon from "../components/LogoIcon";

const { Header, Content, Footer } = Layout;
const { Title, Paragraph, Text } = Typography;

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();

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
      title: "Tạo tiêu chí chấm điểm",
      desc: "AI tự động phân tích yêu cầu công việc và tạo tiêu chí chấm điểm từ nó.",
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
          <LogoIcon size={40} />
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
                type="text"
                className="login-btn"
                onClick={logout}
              >
                Log out
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
                  Tự động chấm điểm ứng viên theo tiêu chí có sẵn
                </Title>
                <Paragraph className="ai-description">
                  Chỉ cần tải bài đăng tuyển dụng (JD) lên, AI sẽ tự động đọc và
                  tạo ra một "thước đo" chi tiết. Điều này giúp mọi ứng viên được
                  đánh giá công bằng, chính xác và không bị phụ thuộc vào cảm
                  tính cá nhân của người chấm.
                </Paragraph>
                <div className="ai-feature-list">
                  <div className="ai-feature-item">
                    <div className="check-bullet">
                      <CheckOutlined />
                    </div>
                    <div>
                      <strong>Tự động rút ra các yêu cầu quan trọng</strong>
                      <p>
                        AI sẽ tự tìm và gom nhóm các yêu cầu trong bài tuyển dụng
                        thành: Kỹ năng chuyên môn, Kỹ năng mềm và Số năm kinh
                        nghiệm cần thiết.
                      </p>
                    </div>
                  </div>
                  <div className="ai-feature-item">
                    <div className="check-bullet">
                      <CheckOutlined />
                    </div>
                    <div>
                      <strong>Tính điểm tự động trước khi phỏng vấn</strong>
                      <p>
                        Mỗi yêu cầu sẽ có mức độ quan trọng riêng. AI sẽ dựa vào đó
                        để tự động tính ra điểm số phù hợp của từng ứng viên, giúp
                        bạn biết ngay ai là người tiềm năng nhất để mời phỏng vấn.
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
              <LogoIcon size={32} />
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