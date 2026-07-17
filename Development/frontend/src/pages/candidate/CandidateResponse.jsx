import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Layout,
  Card,
  Typography,
  Button,
  Tag,
  Descriptions,
  Result,
  Spin,
  Form,
  Input,
  message,
  Modal,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  TrophyOutlined,
  CalendarOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import { candidateAPI } from "../../services/api";
import "./css/CandidateResponse.css";

const { Header, Content, Footer } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const MATCHA_GREEN = "#5D8C3E";

const CandidateResponse = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [offerData, setOfferData] = useState(null);
  const [error, setError] = useState(null);
  const [responded, setResponded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [responseType, setResponseType] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (token) {
      fetchOffer();
    } else {
      setError("Token không hợp lệ hoặc đã hết hạn.");
      setLoading(false);
    }
  }, [token]);

  const fetchOffer = async () => {
    try {
      setLoading(true);
      const response = await candidateAPI.getOffer(token);
      const data = response.data;
      setOfferData(data);
    } catch (err) {
      console.error("Error fetching offer:", err);
      const errorMsg =
        err?.response?.data?.message ||
        "Không thể tải thông tin offer. Liên kết có thể đã hết hạn.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (accept) => {
    try {
      setSubmitting(true);
      const values = await form.validateFields();
      await candidateAPI.respondToOffer(token, accept);
      setResponseType(accept ? "accepted" : "declined");
      setResponded(true);
    } catch (err) {
      console.error("Error responding to offer:", err);
      message.error(
        err?.response?.data?.message ||
          "Không thể gửi phản hồi. Vui lòng thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout className="candidate-response-layout">
        <Header className="cr-header">
          <div className="header-logo">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill={MATCHA_GREEN} />
              <path
                d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z"
                stroke="white"
                strokeWidth="2.5"
              />
              <path
                d="M20 22L24 26L28 22"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M24 18V26"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            <span>SRIS</span>
          </div>
        </Header>
        <Content className="cr-content">
          <div style={{ textAlign: "center", padding: 80 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">Đang tải thông tin offer...</Text>
            </div>
          </div>
        </Content>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout className="candidate-response-layout">
        <Header className="cr-header">
          <div className="header-logo">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill={MATCHA_GREEN} />
              <path
                d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z"
                stroke="white"
                strokeWidth="2.5"
              />
              <path
                d="M20 22L24 26L28 22"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M24 18V26"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            <span>SRIS</span>
          </div>
        </Header>
        <Content className="cr-content">
          <Result
            status="error"
            icon={<CloseCircleOutlined style={{ color: "#f5222d" }} />}
            title="Không thể tải Offer"
            subTitle={error}
            extra={
              <Button type="primary" onClick={() => navigate("/")}>
                Quay về trang chủ
              </Button>
            }
          />
        </Content>
      </Layout>
    );
  }

  if (responded) {
    return (
      <Layout className="candidate-response-layout">
        <Header className="cr-header">
          <div className="header-logo">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill={MATCHA_GREEN} />
              <path
                d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z"
                stroke="white"
                strokeWidth="2.5"
              />
              <path
                d="M20 22L24 26L28 22"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M24 18V26"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            <span>SRIS</span>
          </div>
        </Header>
        <Content className="cr-content">
          <Result
            status={responseType === "accepted" ? "success" : "info"}
            icon={
              responseType === "accepted" ? (
                <CheckCircleOutlined
                  style={{ color: "#52c41a", fontSize: 72 }}
                />
              ) : (
                <FileTextOutlined style={{ color: "#8c8c8b", fontSize: 72 }} />
              )
            }
            title={
              responseType === "accepted"
                ? "Cảm ơn bạn đã đồng ý!"
                : "Phản hồi của bạn đã được ghi nhận"
            }
            subTitle={
              responseType === "accepted"
                ? "Chúc mừng bạn! Chúng tôi sẽ liên hệ trong thời gian sớm nhất để sắp xếp các thủ tục tiếp theo."
                : "Cảm ơn bạn đã phản hồi. Chúng tôi hiểu quyết định của bạn và chúc bạn may mắn trên con đường sự nghiệp."
            }
            extra={
              <Button type="primary" onClick={() => navigate("/")}>
                Đóng
              </Button>
            }
          />
        </Content>
      </Layout>
    );
  }

  const formatSalary = (salary) => {
    if (!salary) return "Thỏa thuận";
    return new Intl.NumberFormat("vi-VN").format(salary) + " VNĐ/tháng";
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <Layout className="candidate-response-layout">
      <Header className="cr-header">
        <div className="header-logo">
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill={MATCHA_GREEN} />
            <path
              d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z"
              stroke="white"
              strokeWidth="2.5"
            />
            <path
              d="M20 22L24 26L28 22"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M24 18V26"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <span>SRIS</span>
        </div>
        <Tag color="green" icon={<FileTextOutlined />}>
          Offer Letter
        </Tag>
      </Header>

      <Content className="cr-content">
        <div className="cr-container">
          <div className="cr-hero">
            <div className="cr-hero-icon">
              <TrophyOutlined />
            </div>
            <Title level={2} className="cr-hero-title">
              Chúc mừng bạn đã vượt qua phỏng vấn!
            </Title>
            <Paragraph className="cr-hero-subtitle">
              Chúng tôi rất vui được gửi đến bạn một offer chính thức. Vui lòng
              xem chi tiết bên dưới và phản hồi trước ngày hết hạn.
            </Paragraph>
          </div>

          <Card className="cr-offer-card">
            <div className="cr-offer-header">
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  Thông Tin Offer
                </Title>
                <Text type="secondary">
                  Vị trí:{" "}
                  <strong>
                    {offerData?.jobTitle || offerData?.position || "N/A"}
                  </strong>
                </Text>
              </div>
              <Tag color="gold" style={{ fontSize: 14, padding: "4px 12px" }}>
                Chờ phản hồi
              </Tag>
            </div>

            <Descriptions
              column={{ xs: 1, sm: 2 }}
              className="cr-offer-details"
            >
              <Descriptions.Item
                label={
                  <span>
                    <DollarOutlined /> Mức lương
                  </span>
                }
              >
                <Text strong style={{ color: MATCHA_GREEN, fontSize: 16 }}>
                  {formatSalary(offerData?.salary)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item
                label={
                  <span>
                    <CalendarOutlined /> Ngày bắt đầu
                  </span>
                }
              >
                <Text strong>{formatDate(offerData?.startDate)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Hạn phản hồi">
                <Text type="danger" strong>
                  {formatDate(offerData?.deadline)}
                </Text>
              </Descriptions.Item>
              {offerData?.position && (
                <Descriptions.Item label="Phòng ban">
                  {offerData.department || "N/A"}
                </Descriptions.Item>
              )}
            </Descriptions>

            {offerData?.notes && (
              <>
                <div className="cr-notes-section">
                  <Title level={5} style={{ marginBottom: 8 }}>
                    Ghi chú từ nhà tuyển dụng
                  </Title>
                  <div className="cr-notes-box">{offerData.notes}</div>
                </div>
              </>
            )}

            <div className="cr-response-section">
              <Title level={5}>Phản hồi của bạn</Title>

              <Form form={form} layout="vertical">
                <Form.Item label="Lời nhắn (tùy chọn)" name="message">
                  <TextArea
                    rows={3}
                    placeholder="Bạn có muốn gửi lời nhắn kèm theo không?..."
                    maxLength={500}
                    showCount
                  />
                </Form.Item>
              </Form>

              <div className="cr-action-buttons">
                <Button
                  size="large"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleResponse(true)}
                  loading={submitting}
                  className="accept-btn"
                >
                  Đồng ý Offer
                </Button>
                <Button
                  size="large"
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleResponse(false)}
                  loading={submitting}
                  className="decline-btn"
                >
                  Từ chối
                </Button>
              </div>
            </div>
          </Card>

          <Text type="secondary" className="cr-footer-note">
            Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với bộ phận nhân sự
            qua email hoặc số điện thoại được cung cấp trong email gốc.
          </Text>
        </div>
      </Content>

      <Footer className="cr-footer">
        <Text type="secondary">
          © 2026 SRIS - Smart Recruitment & Interview System
        </Text>
      </Footer>
    </Layout>
  );
};

export default CandidateResponse;
