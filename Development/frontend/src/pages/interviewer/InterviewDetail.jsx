import React, { useState, useEffect } from "react";
import {
  Row,
  Col,
  Card,
  Typography,
  Button,
  Descriptions,
  Tag,
  Avatar,
  Space,
  Divider,
  message,
  Input,
  Rate,
  Spin,
} from "antd";
import {
  ArrowLeftOutlined,
  VideoCameraOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  UserOutlined,
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  SaveOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { interviewAPI, applicationAPI } from "../../services/api";
import "../Dashboard.css";

const { Title, Text } = Typography;
const { TextArea } = Input;

const MATCHA_GREEN = "#5D8C3E";

const InterviewerInterviewDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [schedule, setSchedule] = useState(null);
  const [application, setApplication] = useState(null);
  const [sheet, setSheet] = useState(null);

  const [feedback, setFeedback] = useState("");
  const [recommendation, setRecommendation] = useState(null);
  const [ratings, setRatings] = useState({});

  const recommendationOptions = [
    { key: "STRONG_HIRE", label: "Trúng tuyển mạnh", color: "#52c41a" },
    { key: "HIRE", label: "Trúng tuyển", color: "#73d13d" },
    { key: "CONSIDER", label: "Cân nhắc", color: "#faad14" },
    { key: "NO_HIRE", label: "Không trúng tuyển", color: "#f5222d" },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Get my schedules to find the application ID and basic info
        const schedulesRes = await interviewAPI.getMySchedules();
        const currentSchedule = schedulesRes.data.find(
          (s) => s.scheduleId === Number(id),
        );

        if (!currentSchedule) {
          message.error(
            "Không tìm thấy lịch phỏng vấn hoặc bạn không có quyền truy cập",
          );
          navigate("/interviewer/schedule");
          return;
        }
        setSchedule(currentSchedule);

        // 2. Get application details
        const appRes = await applicationAPI.getById(
          currentSchedule.applicationId,
        );
        setApplication(appRes.data);

        // 3. Get scoring sheet
        const sheetRes = await interviewAPI.getMySheet(
          currentSchedule.scheduleId,
        );
        setSheet(sheetRes.data);

        // Initialize ratings from existing sheet
        if (sheetRes.data && sheetRes.data.criteria) {
          const initialRatings = {};
          sheetRes.data.criteria.forEach((c) => {
            // Convert backend score back to 5-star rating (assuming score is proportional to maxScore)
            const starValue =
              c.myScore != null && c.maxScore > 0
                ? Math.round((c.myScore / c.maxScore) * 5)
                : 0;
            initialRatings[c.criteriaId] = starValue;
          });
          setRatings(initialRatings);
        }
      } catch (error) {
        console.error("Error fetching interview details:", error);
        message.error("Lỗi khi tải thông tin phỏng vấn");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const handleRatingChange = (criteriaId, value) => {
    setRatings({ ...ratings, [criteriaId]: value });
  };

  const getTotalScore = () => {
    if (!sheet) return 0;
    let total = 0;
    sheet.criteria.forEach((c) => {
      const stars = ratings[c.criteriaId] || 0;
      total += (stars / 5) * c.maxScore;
    });
    return Math.round(total * 10) / 10;
  };

  const getMaxScore = () => {
    if (!sheet) return 0;
    return sheet.criteria.reduce((sum, c) => sum + c.maxScore, 0);
  };

  const getScoreColor = (score) => {
    const max = getMaxScore();
    if (max === 0) return "#999";
    const percent = (score / max) * 100;
    if (percent >= 80) return "#52c41a";
    if (percent >= 60) return "#faad14";
    return "#f5222d";
  };

  const prepareDraftData = () => {
    const items = sheet.criteria.map((c) => {
      const stars = ratings[c.criteriaId] || 0;
      const score = (stars / 5) * c.maxScore;
      return {
        criteriaId: c.criteriaId,
        score: score > 0 ? score : null,
        note: null, // Currently no per-criteria note in UI
      };
    });
    return { items };
  };

  const handleSave = async () => {
    try {
      setSubmitting(true);
      const data = prepareDraftData();
      await interviewAPI.updateMySheet(schedule.scheduleId, data);

      // Save overall feedback as a note if provided
      if (feedback || recommendation) {
        const noteContent = `[Đánh giá tổng quan]
Đề xuất: ${recommendationOptions.find((o) => o.key === recommendation)?.label || "Chưa chọn"}
Nhận xét: ${feedback || "Không có"}`;
        await applicationAPI.addNote(schedule.applicationId, noteContent);
      }

      message.success("Đã lưu nháp đánh giá thành công!");
    } catch (error) {
      console.error("Error saving draft:", error);
      message.error("Lỗi khi lưu nháp");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    const isAllRated = sheet.criteria.every((c) => ratings[c.criteriaId] > 0);
    if (!isAllRated) {
      message.error("Vui lòng đánh giá tất cả các tiêu chí trước khi nộp");
      return;
    }

    try {
      setSubmitting(true);
      // First save draft to ensure backend has the latest scores
      const data = prepareDraftData();
      await interviewAPI.updateMySheet(schedule.scheduleId, data);

      // Save overall feedback
      if (feedback || recommendation) {
        const noteContent = `[Đánh giá tổng quan]
Đề xuất: ${recommendationOptions.find((o) => o.key === recommendation)?.label || "Chưa chọn"}
Nhận xét: ${feedback || "Không có"}`;
        await applicationAPI.addNote(schedule.applicationId, noteContent);
      }

      // Then submit
      await interviewAPI.submitMySheet(schedule.scheduleId);
      message.success("Đã gửi phiếu chấm thành công!");
      navigate("/interviewer/schedule"); // Or history
    } catch (error) {
      console.error("Error submitting sheet:", error);
      message.error(
        "Lỗi khi nộp phiếu chấm (có thể bạn chưa đánh giá đủ tiêu chí)",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !schedule || !application || !sheet) {
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

  const isSubmitted = sheet.myStatus === "SUBMITTED";

  return (
    <div className="interview-detail-page">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/interviewer/schedule")}
          />
          <div>
            <Title level={3} className="page-title">
              Chi Tiết Phỏng Vấn
            </Title>
            <Text type="secondary">
              Mã Lịch: #{schedule.scheduleId} • Vòng {schedule.roundNumber} •{" "}
              {schedule.status}
            </Text>
          </div>
        </div>
        <Space>
          <Button
            icon={<VideoCameraOutlined />}
            style={{ borderColor: MATCHA_GREEN, color: MATCHA_GREEN }}
          >
            Tham gia phỏng vấn
          </Button>
        </Space>
      </div>

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={16}>
          <Card
            className="main-card"
            bordered={false}
            style={{ marginBottom: 20 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <Avatar
                size={64}
                style={{ backgroundColor: MATCHA_GREEN }}
                icon={<UserOutlined />}
              />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {application.candidateName}
                </Title>
                <Text type="secondary">{application.candidateEmail}</Text>
                {application.candidatePhone && (
                  <>
                    <br />
                    <Text type="secondary">{application.candidatePhone}</Text>
                  </>
                )}
              </div>
              <Tag
                color={
                  schedule.status === "COMPLETED"
                    ? "success"
                    : schedule.status === "CANCELLED"
                      ? "error"
                      : "processing"
                }
                style={{ marginLeft: "auto" }}
              >
                {schedule.status === "COMPLETED"
                  ? "Đã hoàn thành"
                  : schedule.status === "SCHEDULED"
                    ? "Đã lên lịch"
                    : schedule.status}
              </Tag>
            </div>

            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Vị trí ứng tuyển" span={2}>
                <Text strong>{application.jobTitle}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái hồ sơ">
                {application.currentState}
              </Descriptions.Item>
              <Descriptions.Item label="Vòng phỏng vấn">
                Vòng {schedule.roundNumber}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            className="main-card"
            bordered={false}
            style={{ marginBottom: 20 }}
          >
            <Title level={5}>
              <FileTextOutlined style={{ marginRight: 8 }} />
              Đánh Giá Phỏng Vấn
              {isSubmitted && (
                <Tag color="success" style={{ marginLeft: 12 }}>
                  Đã nộp
                </Tag>
              )}
            </Title>

            <div style={{ marginTop: 20 }}>
              {sheet.criteria.length === 0 ? (
                <Text type="secondary">
                  Không có tiêu chí đánh giá nào cho vòng này.
                </Text>
              ) : (
                sheet.criteria.map((c) => (
                  <div
                    key={c.criteriaId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 0",
                      borderBottom: "1px solid #f0f0f0",
                    }}
                  >
                    <div>
                      <Text strong>{c.name}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Trọng số: {c.weight} | Tối đa: {c.maxScore}đ
                      </Text>
                    </div>
                    <Rate
                      count={5}
                      value={ratings[c.criteriaId] || 0}
                      onChange={(value) =>
                        handleRatingChange(c.criteriaId, value)
                      }
                      disabled={isSubmitted || submitting}
                      style={{ fontSize: 20 }}
                    />
                  </div>
                ))
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 20,
                padding: "16px",
                background: `${getScoreColor(getTotalScore())}10`,
                borderRadius: 8,
              }}
            >
              <Text strong>Điểm tổng (ước tính):</Text>
              <Text
                strong
                style={{ fontSize: 24, color: getScoreColor(getTotalScore()) }}
              >
                {getTotalScore()} / {getMaxScore()}
              </Text>
            </div>
          </Card>

          {!isSubmitted && (
            <>
              <Card
                className="main-card"
                bordered={false}
                style={{ marginBottom: 20 }}
              >
                <Title level={5}>Nhận Xét Chung (Lưu vào ghi chú nội bộ)</Title>
                <TextArea
                  rows={4}
                  placeholder="Nhập nhận xét chi tiết về ứng viên..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  style={{ marginBottom: 20 }}
                  disabled={submitting}
                />

                <Title level={5}>Đề Xuất</Title>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {recommendationOptions.map((opt) => (
                    <Button
                      key={opt.key}
                      type={recommendation === opt.key ? "primary" : "default"}
                      onClick={() => setRecommendation(opt.key)}
                      disabled={submitting}
                      style={
                        recommendation === opt.key
                          ? {
                              background: opt.color,
                              borderColor: opt.color,
                              color: "#fff",
                            }
                          : {}
                      }
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </Card>

              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}
              >
                <Button
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={submitting}
                >
                  Lưu nháp
                </Button>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSubmit}
                  loading={submitting}
                  style={{
                    background: MATCHA_GREEN,
                    borderColor: MATCHA_GREEN,
                  }}
                >
                  Gửi đánh giá
                </Button>
              </div>
            </>
          )}
        </Col>

        <Col xs={24} lg={8}>
          <Card
            className="main-card"
            bordered={false}
            style={{ marginBottom: 20 }}
          >
            <Title level={5}>
              <CalendarOutlined style={{ marginRight: 8 }} />
              Thông tin lịch
            </Title>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginTop: 12,
              }}
            >
              <Text type="secondary">
                Lịch chi tiết (ngày giờ, phòng họp) chỉ có thể xem từ phía
                Recruiter/Dept Manager do API cho Interviewer hiện tại chỉ cung
                cấp mã lịch và trạng thái. Bạn có thể xem lịch trên Google
                Calendar của bạn.
              </Text>
            </div>
          </Card>

          <Card className="main-card" bordered={false}>
            <Title level={5}>
              <FileTextOutlined style={{ marginRight: 8 }} />
              Checklist
            </Title>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 12,
              }}
            >
              {[
                "Chuẩn bị câu hỏi phỏng vấn",
                "Xem lại CV ứng viên",
                "Kiểm tra kết nối Internet",
                "Chuẩn bị không gian yên tĩnh",
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <CheckCircleOutlined style={{ color: "#52c41a" }} />
                  <Text>{item}</Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default InterviewerInterviewDetail;
