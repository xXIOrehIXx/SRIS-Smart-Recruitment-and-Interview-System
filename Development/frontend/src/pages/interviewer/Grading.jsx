import React, { useState, useEffect } from 'react';
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
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  SendOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { interviewAPI } from '../../services/api';
import '../Dashboard.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

const MATCHA_GREEN = '#5D8C3E';

const Grading = () => {
  const navigate = useNavigate();
  const { id: scheduleId } = useParams();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scores, setScores] = useState({});
  const [criteria, setCriteria] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [interviewInfo, setInterviewInfo] = useState(null);

  // Modal states
  const [saveConfirmModal, setSaveConfirmModal] = useState(false);
  const [submitConfirmModal, setSubmitConfirmModal] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Get candidate info từ navigation state — fallback khi API trả candidate rỗng
  const candidateData = location.state?.candidate || {};

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

      // ScoringSheetDto: { scheduleId, myStatus, criteria: [...], schedule, candidate }
      if (data.myStatus === 'SUBMITTED') setIsSubmitted(true);

      if (Array.isArray(data.criteria)) {
        setCriteria(data.criteria.map((c) => ({
          id: c.criteriaId,
          name: c.name || 'Tiêu chí',
          maxScore: c.maxScore || 10,
          weight: c.weight || 1,
        })));

        // Nạp lại điểm nháp đã lưu server (myScore — điểm CỦA MÌNH, blind review)
        const existingScores = {};
        data.criteria.forEach((c) => {
          if (c.myScore !== undefined && c.myScore !== null) {
            existingScores[c.criteriaId] = c.myScore;
          }
        });
        setScores(existingScores);

        // Khôi phục nhận xét chung (được lưu trong note của tiêu chí đầu)
        const firstNote = data.criteria[0]?.myNote;
        if (firstNote?.startsWith('[Nhận xét chung]')) {
          const match = firstNote.match(/^\[Nhận xét chung\] ([\s\S]*)$/);
          if (match) setFeedback(match[1] || '');
        }
      }

      if (data.schedule) setInterviewInfo(data.schedule);
    } catch (error) {
      console.error('Error fetching my sheet:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể tải phiếu chấm. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (id, value) => {
    setScores({ ...scores, [id]: value });
  };

  const calculateTotal = () => {
    const total = Object.values(scores).reduce((sum, score) => sum + (score || 0), 0);
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

    return totalWeight > 0 ? (weightedSum / totalWeight * 100).toFixed(1) : 0;
  };

  const handleSaveDraft = () => {
    if (isSubmitted) {
      message.warning('Bạn đã submit rồi, không thể lưu nháp');
      return;
    }
    setSaveConfirmModal(true);
  };

  const handleSubmitScore = () => {
    setSubmitConfirmModal(true);
  };

  // Backend SaveScoreDraftDto = { items: [{criteriaId, score, note}] } — note theo TỪNG tiêu chí;
  // nhận xét chung + đề xuất không có cột riêng nên ghi vào note của tiêu chí đầu.
  const buildItemsPayload = () => ({
    items: criteria
      .filter((c) => typeof c.id === 'number') // bỏ tiêu chí fallback (id chuỗi, không có trên server)
      .map((c, idx) => ({
        criteriaId: c.id,
        score: scores[c.id] ?? null,
        note: idx === 0 && feedback
          ? `[Nhận xét chung] ${feedback}`
          : null,
      })),
  });

  const confirmSaveDraft = async () => {
    try {
      setSubmitting(true);
      const payload = buildItemsPayload();
      if (payload.items.length === 0) {
        message.warning('Vị trí này chưa có bộ tiêu chí đã duyệt — không thể lưu điểm.');
        return;
      }

      await interviewAPI.updateMySheet(scheduleId, payload);
      message.success('Đã lưu nháp thành công!');
      setSaveConfirmModal(false);
    } catch (error) {
      console.error('Error saving draft:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể lưu nháp. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmSubmitScore = async () => {
    try {
      setSubmitting(true);
      const payload = buildItemsPayload();
      if (payload.items.length === 0) {
        message.warning('Vị trí này chưa có bộ tiêu chí đã duyệt — không thể nộp phiếu.');
        return;
      }

      // Submit KHÔNG nhận body — phải lưu nháp lên server trước, backend kiểm "chấm đủ mọi tiêu chí"
      await interviewAPI.updateMySheet(scheduleId, payload);
      await interviewAPI.submitMySheet(scheduleId);
      message.success('Đã nộp phiếu chấm — điểm của bạn giờ hiện với panel (mở blind).');
      setSubmitConfirmModal(false);
      setIsSubmitted(true);
      // Đợi toast hiện xong rồi quay lại trang trước
      setTimeout(() => navigate(-1), 700);
    } catch (error) {
      console.error('Error submitting score:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể submit điểm. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grading-page">
      <div className="grading-header">
        <Button
          onClick={() => navigate(-1)}
          icon={<ArrowLeftOutlined />}
        >
          Quay lại
        </Button>

        {isSubmitted && (
          <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontSize: 14, padding: '4px 12px' }}>
            Đã submit
          </Tag>
        )}
      </div>

      {/* Khung thông tin buổi phỏng vấn — Bind từ scoring sheet.scheduleInfo trả về từ BE */}
      <Card
        className="info-card"
        bordered={false}
        style={{ background: '#fafafa', marginBottom: 16 }}
        title={
          <Space>
            <CalendarOutlined style={{ color: MATCHA_GREEN }} />
            <Text strong>Thông tin buổi phỏng vấn</Text>
          </Space>
        }
        size="small"
      >
        <Row gutter={[16, 8]}>
          <Col xs={24} md={6}>
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Ứng viên</Text>
            <Text strong style={{ fontSize: 15 }}>
              {interviewInfo?.candidate?.fullName || candidateData.candidateName || candidateData.candidate || candidateData.name || 'N/A'}
            </Text>
            {interviewInfo?.candidate?.email && (
              <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                {interviewInfo.candidate.email}
              </Text>
            )}
          </Col>
          <Col xs={12} md={5}>
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Vòng</Text>
            <Tag color="cyan" style={{ fontSize: 13, padding: '2px 10px', marginTop: 2 }}>
              Vòng {interviewInfo?.schedule?.roundNumber || candidateData.round || interviewInfo?.schedule?.RoundNumber || '1'}
            </Tag>
          </Col>
          <Col xs={12} md={5}>
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Thời gian</Text>
            <Text strong>
              {interviewInfo?.schedule?.startTime
                ? dayjs(interviewInfo.schedule.startTime).format('DD/MM/YYYY HH:mm')
                : candidateData.startTime
                  ? dayjs(candidateData.startTime).format('DD/MM/YYYY HH:mm')
                  : '—'}
            </Text>
          </Col>
          <Col xs={12} md={4}>
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Số người panel</Text>
            <Space size={4}>
              <TeamOutlined style={{ color: MATCHA_GREEN }} />
              <Text strong style={{ fontSize: 15 }}>
                {interviewInfo?.schedule?.panelSize ?? '—'}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>người</Text>
            </Space>
          </Col>
          <Col xs={12} md={4}>
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Vị trí</Text>
            <Text strong>
              {interviewInfo?.schedule?.jobTitle || candidateData.position || candidateData.jobTitle || '—'}
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Khung chấm điểm — full-width */}
      <Row gutter={[24, 24]}>
        <Col xs={24}>
          <Card className="main-card" bordered={false}>
            <div className="grading-header-content">
              <div>
                <Title level={4}>Đánh giá phỏng vấn</Title>
                <Text type="secondary">
                  {candidateData.candidateName || candidateData.candidate || candidateData.name || 'Ứng viên'}
                  {' - '}
                  {candidateData.position || candidateData.jobTitle || 'N/A'}
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
                        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
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
                        onChange={(e) => handleScoreChange(item.id, parseInt(e.target.value) || 0)}
                        style={{ width: 70, textAlign: 'center' }}
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
                    marks={{ 0: '0', [item.maxScore]: item.maxScore.toString() }}
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
                  style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
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
        okButtonProps={{ loading: submitting, style: { background: MATCHA_GREEN } }}
      >
        <Alert
          message="Lưu ý quan trọng"
          description="Sau khi submit, bạn sẽ không thể chỉnh sửa điểm. Vui lòng kiểm tra kỹ trước khi submit."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <p>Bạn có chắc chắn muốn submit điểm đánh giá này?</p>
        <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, marginTop: 16 }}>
          <p><strong>Tổng điểm:</strong> {calculateTotal()}/{calculateMaxScore()}</p>
        </div>
      </Modal>
    </div>
  );
};

export default Grading;
