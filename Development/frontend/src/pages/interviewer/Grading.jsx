import React, { useState, useEffect } from "react";
import {
  Row,
  Col,
  Card,
  Typography,
  Button,
  Input,
  Slider,
  message,
  Form,
  Tag,
  Space,
  Divider,
  Descriptions,
  Modal,
  Alert,
} from "antd";
import {
  ArrowLeftOutlined,
  SaveOutlined,
  SendOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import { interviewAPI } from "../../services/api";
import "../Dashboard.css";

const { Title, Text } = Typography;
const { TextArea } = Input;

const MATCHA_GREEN = "#5D8C3E";

const Grading = () => {
  const navigate = useNavigate();
  const { id: scheduleId } = useParams();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scores, setScores] = useState({});
  const [criteria, setCriteria] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [recommendation, setRecommendation] = useState(null);
  const [interviewInfo, setInterviewInfo] = useState(null);
  const [candidateInfo, setCandidateInfo] = useState(null);

  // Modal states
  const [saveConfirmModal, setSaveConfirmModal] = useState(false);
  const [submitConfirmModal, setSubmitConfirmModal] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Get data from navigation state or use passed params
  const stateData = location.state || {};
  const candidateData = stateData.candidate || {};

  useEffect(() => {
    if (scheduleId) {
      fetchMySheet();
    }
  }, [scheduleId]);

  const fetchMySheet = async () => {
    try {
      setLoading(true);
      const response = await interviewAPI.getMySheet(scheduleId);
      const data = response.data || {};

      // Set criteria for scoring
      if (data.criteria && Array.isArray(data.criteria)) {
        setCriteria(
          data.criteria.map((c) => ({
            id: c.criteriaId || c.id,
            name: c.criteriaName || c.name || "Tiêu chí",
            maxScore: c.maxScore || 10,
            weight: c.weight || 1,
            description: c.description || "",
          })),
        );

        // Load existing scores
        const existingScores = {};
        data.criteria.forEach((c) => {
          if (c.score !== undefined && c.score !== null) {
            existingScores[c.criteriaId || c.id] = c.score;
          }
        });
        setScores(existingScores);
      } else {
        // Fallback criteria if none from API
        setCriteria([
          {
            id: "technical",
            name: "Kỹ năng kỹ thuật",
            maxScore: 10,
            weight: 1,
          },
          { id: "communication", name: "Giao tiếp", maxScore: 10, weight: 1 },
          {
            id: "problem_solving",
            name: "Giải quyết vấn đề",
            maxScore: 10,
            weight: 1,
          },
          {
            id: "culture_fit",
            name: "Phù hợp văn hóa",
            maxScore: 10,
            weight: 1,
          },
          { id: "experience", name: "Kinh nghiệm", maxScore: 10, weight: 1 },
        ]);
      }

      // Set existing feedback
      if (data.feedback) {
        setFeedback(data.feedback);
      }
      if (data.recommendation) {
        setRecommendation(data.recommendation);
      }

      // Set interview info
      if (data.schedule) {
        setInterviewInfo(data.schedule);
      }
      if (data.candidate) {
        setCandidateInfo(data.candidate);
      }

      // Check if already submitted
      if (data.isSubmitted || data.status === "SUBMITTED") {
        setIsSubmitted(true);
      }
    } catch (error) {
      console.error("Error fetching my sheet:", error);
      message.warning("Không thể tải dữ liệu chấm điểm, sử dụng form mới");

      // Set default criteria
      setCriteria([
        { id: "technical", name: "Kỹ năng kỹ thuật", maxScore: 10, weight: 1 },
        { id: "communication", name: "Giao tiếp", maxScore: 10, weight: 1 },
        {
          id: "problem_solving",
          name: "Giải quyết vấn đề",
          maxScore: 10,
          weight: 1,
        },
        { id: "culture_fit", name: "Phù hợp văn hóa", maxScore: 10, weight: 1 },
        { id: "experience", name: "Kinh nghiệm", maxScore: 10, weight: 1 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (id, value) => {
    setScores({ ...scores, [id]: value });
  };

  const calculateTotal = () => {
    const total = Object.values(scores).reduce(
      (sum, score) => sum + (score || 0),
      0,
    );
    return total;
  };

  const calculateMaxScore = () => {
    return criteria.reduce((sum, c) => sum + c.maxScore, 0);
  };

  const calculateWeightedScore = () => {
    let weightedSum = 0;
    let totalWeight = 0;

    criteria.forEach((c) => {
      const score = scores[c.id] || 0;
      weightedSum += score * c.weight;
      totalWeight += c.weight * c.maxScore;
    });

    return totalWeight > 0 ? ((weightedSum / totalWeight) * 100).toFixed(1) : 0;
  };

  const handleSaveDraft = () => {
    if (isSubmitted) {
      message.warning("Bạn đã submit rồi, không thể lưu nháp");
      return;
    }
    setSaveConfirmModal(true);
  };

  const handleSubmitScore = () => {
    setSubmitConfirmModal(true);
  };

  const confirmSaveDraft = async () => {
    try {
      setSubmitting(true);
      const payload = {
        scores: criteria.map((c) => ({
          criteriaId: c.id,
          score: scores[c.id] || 0,
        })),
        feedback,
        recommendation,
      };

      await interviewAPI.updateMySheet(scheduleId, payload);
      message.success("Đã lưu nháp thành công!");
      setSaveConfirmModal(false);
    } catch (error) {
      console.error("Error saving draft:", error);
      message.error("Không thể lưu nháp. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmSubmitScore = async () => {
    try {
      setSubmitting(true);
      const payload = {
        scores: criteria.map((c) => ({
          criteriaId: c.id,
          score: scores[c.id] || 0,
        })),
        feedback,
        recommendation,
      };

      await interviewAPI.submitMySheet(scheduleId, payload);
      message.success("Đã submit điểm thành công!");
      setSubmitConfirmModal(false);
      setIsSubmitted(true);
    } catch (error) {
      console.error("Error submitting score:", error);
      message.error("Không thể submit điểm. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const getRecommendationConfig = (rec) => {
    const configs = {
      STRONG_HIRE: {
        color: "#52c41a",
        label: "Rất nên tuyển",
        icon: <TrophyOutlined />,
      },
      HIRE: {
        color: "#73d13d",
        label: "Nên tuyển",
        icon: <CheckCircleOutlined />,
      },
      NO_HIRE: {
        color: "#ff4d4f",
        label: "Không nên tuyển",
        icon: <CloseCircleOutlined />,
      },
      STRONG_NO_HIRE: {
        color: "#cf1322",
        label: "Tuyệt đối không tuyển",
        icon: <CloseCircleOutlined />,
      },
    };
    return configs[rec] || { color: "#d9d9d9", label: rec || "Chưa đánh giá" };
  };

  const recommendationOptions = [
    { key: "STRONG_HIRE", label: "Rất nên tuyển", className: "strong-hire" },
    { key: "HIRE", label: "Nên tuyển", className: "hire" },
    { key: "NO_HIRE", label: "Không nên tuyển", className: "no-hire" },
    {
      key: "STRONG_NO_HIRE",
      label: "Tuyệt đối không",
      className: "strong-no-hire",
    },
  ];

  const getRecommendationIcon = (key) => {
    const icons = {
      STRONG_HIRE: <TrophyOutlined />,
      HIRE: <CheckCircleOutlined />,
      NO_HIRE: <ClockCircleOutlined />,
      STRONG_NO_HIRE: <ClockCircleOutlined />,
    };
    return icons[key];
  };

  return (
    <div className="grading-page">
      <div className="grading-header">
        <Button
          onClick={() => navigate("/interviewer/schedule")}
          icon={<ArrowLeftOutlined />}
        >
          Quay lại
        </Button>

        {isSubmitted && (
          <Tag
            color="success"
            icon={<CheckCircleOutlined />}
            style={{ fontSize: 14, padding: "4px 12px" }}
          >
            Đã submit
          </Tag>
        )}
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card className="main-card" bordered={false}>
            <div className="grading-header-content">
              <div>
                <Title level={4}>Đánh giá phỏng vấn</Title>
                <Text type="secondary">
                  {candidateData.candidateName ||
                    candidateData.candidate ||
                    candidateData.name ||
                    "Ứng viên"}
                  {" - "}
                  {candidateData.position || candidateData.jobTitle || "N/A"}
                </Text>
              </div>
              <div className="total-score">
                <Text type="secondary">Điểm tổng</Text>
                <div className="score-display">
                  <span className="score-value">{calculateTotal()}</span>
                  <span className="score-divider">/</span>
                  <span className="score-max">{calculateMaxScore()}</span>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ({calculateWeightedScore()}%)
                </Text>
              </div>
            </div>

            <Divider />

            <div className="criteria-list">
              {criteria.map((item) => (
                <div key={item.id} className="criteria-item">
                  <div className="criteria-header">
                    <div>
                      <span className="criteria-name">{item.name}</span>
                      {item.description && (
                        <Text
                          type="secondary"
                          style={{ fontSize: 12, display: "block" }}
                        >
                          {item.description}
                        </Text>
                      )}
                    </div>
                    <div className="criteria-score-input">
                      <Input
                        type="number"
                        min={0}
                        max={item.maxScore}
                        value={scores[item.id] || 0}
                        onChange={(e) =>
                          handleScoreChange(
                            item.id,
                            parseInt(e.target.value) || 0,
                          )
                        }
                        style={{ width: 70, textAlign: "center" }}
                        disabled={isSubmitted}
                      />
                      <Text type="secondary">/{item.maxScore}</Text>
                    </div>
                  </div>
                  <Slider
                    min={0}
                    max={item.maxScore}
                    value={scores[item.id] || 0}
                    onChange={(value) => handleScoreChange(item.id, value)}
                    marks={{
                      0: "0",
                      [item.maxScore]: item.maxScore.toString(),
                    }}
                    className="score-slider"
                    disabled={isSubmitted}
                  />
                </div>
              ))}
            </div>

            <Divider />

            <div className="feedback-section">
              <Title level={5}>Nhận xét tổng quan</Title>
              <TextArea
                rows={6}
                placeholder="Nhập nhận xét chi tiết về ứng viên..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                disabled={isSubmitted}
              />
            </div>

            <div className="recommendation">
              <Title level={5}>Đề xuất</Title>
              <div className="recommendation-options">
                {recommendationOptions.map((option) => {
                  const isSelected = recommendation === option.key;
                  const config = getRecommendationConfig(option.key);
                  return (
                    <Button
                      key={option.key}
                      className={`recommend-btn ${option.className} ${isSelected ? "selected" : ""}`}
                      onClick={() =>
                        !isSubmitted && setRecommendation(option.key)
                      }
                      icon={getRecommendationIcon(option.key)}
                      disabled={isSubmitted}
                      style={{
                        borderColor: isSelected ? config.color : undefined,
                        backgroundColor: isSelected
                          ? `${config.color}15`
                          : undefined,
                        color: isSelected ? config.color : undefined,
                      }}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {!isSubmitted && (
              <div className="grading-actions">
                <Button
                  icon={<SaveOutlined />}
                  onClick={handleSaveDraft}
                  loading={submitting}
                >
                  Lưu nháp
                </Button>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSubmitScore}
                  loading={submitting}
                  className="submit-btn"
                  style={{
                    background: MATCHA_GREEN,
                    borderColor: MATCHA_GREEN,
                  }}
                >
                  Submit điểm
                </Button>
              </div>
            )}

            {isSubmitted && (
              <Alert
                message="Điểm đã được submit"
                description="Bạn không thể chỉnh sửa sau khi submit. Nếu cần thay đổi, vui lòng liên hệ quản lý."
                type="info"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="sidebar-card" bordered={false}>
            <Title level={5}>Thông tin phỏng vấn</Title>
            <div className="interview-info">
              <div className="info-row">
                <Text type="secondary">
                  <UserOutlined /> Ứng viên:
                </Text>
                <span>
                  {candidateData.candidateName ||
                    candidateData.candidate ||
                    candidateData.name ||
                    "N/A"}
                </span>
              </div>
              <div className="info-row">
                <Text type="secondary">
                  <CalendarOutlined /> Ngày PV:
                </Text>
                <span>
                  {interviewInfo?.date
                    ? dayjs(interviewInfo.date).format("DD/MM/YYYY")
                    : candidateData.interviewDate || "-"}
                </span>
              </div>
              <div className="info-row">
                <Text type="secondary">
                  <ClockCircleOutlined /> Giờ PV:
                </Text>
                <span>{interviewInfo?.time || candidateData.time || "-"}</span>
              </div>
              <div className="info-row">
                <Text type="secondary">Loại:</Text>
                <span>
                  {interviewInfo?.type || candidateData.type || "Technical"}
                </span>
              </div>
              <div className="info-row">
                <Text type="secondary">Vòng:</Text>
                <span>
                  {interviewInfo?.round ||
                    candidateData.round ||
                    interviewInfo?.level ||
                    "1"}
                </span>
              </div>
            </div>

            <Divider />

            <Title level={5}>Hướng dẫn chấm điểm</Title>
            <div style={{ fontSize: 13, color: "#666" }}>
              <p>• Chấm điểm từ 0 đến điểm tối đa của mỗi tiêu chí</p>
              <p>• Nhập nhận xét chi tiết về từng khía cạnh</p>
              <p>• Chọn đề xuất phù hợp với ứng viên</p>
              <p>• Submit khi hoàn thành đánh giá</p>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Modal Xác nhận Lưu Nháp */}
      <Modal
        title="Xác nhận lưu nháp"
        open={saveConfirmModal}
        onCancel={() => setSaveConfirmModal(false)}
        onOk={confirmSaveDraft}
        okText="Lưu"
        cancelText="Hủy"
        okButtonProps={{ loading: submitting }}
      >
        <p>Bạn có chắc chắn muốn lưu nháp đánh giá này không?</p>
        <p>Điểm sẽ được lưu nhưng chưa được submit.</p>
      </Modal>

      {/* Modal Xác nhận Submit */}
      <Modal
        title="Xác nhận submit điểm"
        open={submitConfirmModal}
        onCancel={() => setSubmitConfirmModal(false)}
        onOk={confirmSubmitScore}
        okText="Submit"
        cancelText="Hủy"
        okButtonProps={{
          loading: submitting,
          style: { background: MATCHA_GREEN },
        }}
      >
        <Alert
          message="Lưu ý quan trọng"
          description="Sau khi submit, bạn sẽ không thể chỉnh sửa điểm. Vui lòng kiểm tra kỹ trước khi submit."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <p>Bạn có chắc chắn muốn submit điểm đánh giá này?</p>
        <div
          style={{
            background: "#f5f5f5",
            padding: 12,
            borderRadius: 8,
            marginTop: 16,
          }}
        >
          <p>
            <strong>Tổng điểm:</strong> {calculateTotal()}/{calculateMaxScore()}
          </p>
          <p>
            <strong>Đề xuất:</strong>{" "}
            {recommendation
              ? getRecommendationConfig(recommendation).label
              : "Chưa chọn"}
          </p>
        </div>
      </Modal>
    </div>
  );
};

// Add missing icon import fix
const CloseCircleOutlined = () => <span style={{ fontSize: 14 }}>✕</span>;

export default Grading;
