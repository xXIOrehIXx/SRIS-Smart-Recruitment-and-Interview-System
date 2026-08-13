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
  Radio,
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

// InterviewFeedback.recommendation (V031) — BE chỉ nhận đúng 4 mã này và BẮT BUỘC có khi nộp phiếu.
const RECOMMENDATIONS = [
  { key: 'STRONG_HIRE', label: 'Rất nên tuyển', color: '#52c41a' },
  { key: 'HIRE', label: 'Nên tuyển', color: '#73d13d' },
  { key: 'CONSIDER', label: 'Cần xem xét', color: '#faad14' },
  { key: 'NO_HIRE', label: 'Không nên tuyển', color: '#f5222d' },
];

const Grading = () => {
  const navigate = useNavigate();
  const { id: scheduleId } = useParams();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scores, setScores] = useState({});
  const [criteria, setCriteria] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [recommendation, setRecommendation] = useState(null);
  const [interviewInfo, setInterviewInfo] = useState(null);
  // Note theo từng tiêu chí (ô nhập nằm ngay dưới thanh điểm của tiêu chí đó).
  // Luôn gửi lại nguyên vẹn khi lưu — gửi null sẽ xoá note của chính mình đã lưu trước đó.
  const [criteriaNotes, setCriteriaNotes] = useState({});

  // Modal states
  const [saveConfirmModal, setSaveConfirmModal] = useState(false);
  const [submitConfirmModal, setSubmitConfirmModal] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  // Khóa sửa phiếu theo TRẠNG THÁI HỒ SƠ (OFFER/HIRED/REJECTED) — không phải theo "đã nộp".
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState('');

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

      // ScoringSheetDto: { scheduleId, myStatus, isLocked, lockReason, criteria: [...], schedule, candidate }
      if (data.myStatus === 'SUBMITTED') setIsSubmitted(true);
      setIsLocked(!!data.isLocked);
      setLockReason(data.lockReason || '');

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

        // Note riêng từng tiêu chí — giữ lại để gửi ngược lên, TRỪ phiếu cũ nhét
        // nhận xét chung vào note tiêu chí đầu (nay đã có cột summary riêng).
        const existingNotes = {};
        data.criteria.forEach((c) => {
          if (c.myNote && !c.myNote.startsWith('[Nhận xét chung]')) {
            existingNotes[c.criteriaId] = c.myNote;
          }
        });
        setCriteriaNotes(existingNotes);

        // Nhận xét chung: ưu tiên cột mySummary (V031); phiếu chấm dở từ trước V031
        // vẫn còn nằm trong note của tiêu chí đầu -> đọc nốt cho khỏi mất.
        const legacyNote = data.criteria[0]?.myNote;
        const legacyMatch = legacyNote?.match(/^\[Nhận xét chung\] ([\s\S]*)$/);
        setFeedback(data.mySummary || legacyMatch?.[1] || '');
      }

      // Đề xuất của CHÍNH mình (blind review: không thấy của người khác).
      setRecommendation(data.myRecommendation || null);

      // Giữ NGUYÊN cả sheet: header đọc interviewInfo.schedule.* và interviewInfo.candidate.*
      // (gán data.schedule vào đây làm mất một tầng -> panelSize/candidate luôn undefined).
      setInterviewInfo(data);
    } catch (error) {
      console.error('Error fetching my sheet:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể tải phiếu chấm. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Ô nhập tay là <input type="number">: thuộc tính min/max của HTML chỉ chặn lúc submit form
  // chứ không cấm gõ, nên 50/10 vẫn vào được state rồi BE trả 400 khi lưu. Kẹp tại đây —
  // một cửa duy nhất cho cả ô nhập lẫn slider.
  const handleScoreChange = (id, value) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      setScores({ ...scores, [id]: value });
      return;
    }
    const max = criteria.find((c) => c.id === id)?.maxScore ?? 10;
    setScores({ ...scores, [id]: Math.min(Math.max(value, 0), max) });
  };

  const calculateTotal = () => {
    const total = Object.values(scores).reduce((sum, score) => sum + (score || 0), 0);
    return total;
  };

  const calculateMaxScore = () => {
    return criteria.reduce((sum, c) => sum + c.maxScore, 0);
  };

  // Cùng công thức với BE (InterviewScoringService.GetAggregateAsync): điểm có trọng số chia
  // điểm TỐI ĐA có trọng số. Khác một điểm: ở đây tiêu chí chưa chấm tính 0 (để thấy tiến độ),
  // còn BE chỉ tính tiêu chí đã chấm — nộp phiếu bắt buộc chấm đủ nên lúc đó hai bên bằng nhau.
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
    if (isLocked) {
      message.warning(lockReason || 'Hồ sơ đã có quyết định — phiếu chấm đã khóa.');
      return;
    }
    setSaveConfirmModal(true);
  };

  const handleSubmitScore = () => {
    // Chặn sớm đúng 2 điều kiện BE bắt buộc khi nộp (InterviewScoringService.SubmitAsync):
    // chấm đủ mọi tiêu chí + có đề xuất. Báo tại chỗ thay vì để BE trả 400.
    const unscored = criteria.filter(
      (c) => typeof c.id === 'number' && (scores[c.id] === undefined || scores[c.id] === null)
    );
    if (unscored.length > 0) {
      message.warning(`Hãy chấm đủ điểm trước khi nộp. Còn thiếu: ${unscored.map((c) => c.name).join(', ')}.`);
      return;
    }
    if (!recommendation) {
      message.warning('Hãy chọn đề xuất (nên tuyển / cần xem xét / không nên tuyển) trước khi nộp phiếu.');
      return;
    }
    setSubmitConfirmModal(true);
  };

  // Backend SaveScoreDraftDto = { items: [{criteriaId, score, note}], recommendation, summary }.
  // Đề xuất + nhận xét chung có cột riêng ở BE (V031) — người quyết tuyển đọc chính hai thứ này.
  const buildItemsPayload = () => ({
    items: criteria
      .filter((c) => typeof c.id === 'number') // bỏ tiêu chí fallback (id chuỗi, không có trên server)
      .map((c) => ({
        criteriaId: c.id,
        score: scores[c.id] ?? null,
        note: criteriaNotes[c.id] || null,
      })),
    recommendation: recommendation || null, // null = nháp chưa chốt, BE vẫn cho lưu
    summary: feedback?.trim() || null,
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
                <Text type="secondary">Điểm thô</Text>
                <div className="score-display">
                  <span className="score-value">{calculateTotal()}</span>
                  <span className="score-divider">/</span>
                  <span className="score-max">{calculateMaxScore()}</span>
                </div>
                {/* Hai con số này là HAI phép tính khác nhau: trên là tổng thô (không trọng số),
                    dưới là % có trọng số — lệch nhau khi các tiêu chí khác trọng số. Ghi rõ để
                    không bị đọc thành "X/Y quy ra phần trăm". % mới là con số DM thấy ở tổng hợp. */}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {calculateWeightedScore()}% có trọng số
                </Text>
              </div>
            </div>

            <Divider />

            <div className="criteria-list">
              {criteria.map((item) => (
                <div key={item.id} className="criteria-item">
                  <div className="criteria-header">
                    {/* Tiêu chí chỉ còn name + weight + maxScore: cột mô tả đã xoá ở V032,
                        phiếu chấm (ScoringSheetCriterionDto) không trả description. */}
                    <div>
                      <span className="criteria-name">{item.name}</span>
                    </div>
                    <div className="criteria-score-input">
                      <Input
                        type="number"
                        min={0}
                        max={item.maxScore}
                        value={scores[item.id] || 0}
                        onChange={(e) => handleScoreChange(item.id, parseInt(e.target.value) || 0)}
                        style={{ width: 70, textAlign: 'center' }}
                        disabled={isLocked}
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
                    disabled={isLocked}
                  />
                  {/* Ghi chú riêng cho tiêu chí này — cột note đã có từ đầu ở BE và hiện
                      nguyên văn trong bản tóm tắt của trưởng bộ phận, nhưng phiếu chấm lại
                      không có ô nào để gõ. Không bắt buộc: bỏ trống thì chỉ còn nhận xét chung. */}
                  <TextArea
                    rows={1}
                    autoSize={{ minRows: 1, maxRows: 3 }}
                    placeholder="Dẫn chứng cho điểm này (tùy chọn)"
                    value={criteriaNotes[item.id] || ''}
                    onChange={(e) =>
                      setCriteriaNotes({ ...criteriaNotes, [item.id]: e.target.value })
                    }
                    disabled={isLocked}
                    style={{ marginTop: 8 }}
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
                disabled={isLocked}
              />
            </div>

            <div className="feedback-section" style={{ marginTop: 20 }}>
              <Title level={5} style={{ marginBottom: 4 }}>
                Đề xuất <Text type="danger">*</Text>
              </Title>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                Bắt buộc chọn trước khi nộp phiếu — đây là thứ trưởng bộ phận đọc trước tiên.
              </Text>
              <Radio.Group
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                disabled={isLocked}
                optionType="button"
                buttonStyle="solid"
              >
                {RECOMMENDATIONS.map((r) => (
                  <Radio.Button
                    key={r.key}
                    value={r.key}
                    style={
                      recommendation === r.key
                        ? { background: r.color, borderColor: r.color, color: '#fff' }
                        : {}
                    }
                  >
                    {r.label}
                  </Radio.Button>
                ))}
              </Radio.Group>
            </div>

            {!isLocked && (
              <div className="grading-actions">
                <Button
                  icon={<SaveOutlined />}
                  onClick={handleSaveDraft}
                  loading={submitting}
                >
                  {isSubmitted ? 'Lưu thay đổi' : 'Lưu nháp'}
                </Button>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSubmitScore}
                  loading={submitting}
                  className="submit-btn"
                  style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
                >
                  {isSubmitted ? 'Cập nhật phiếu đã nộp' : 'Submit điểm'}
                </Button>
              </div>
            )}

            {isSubmitted && !isLocked && (
              <Alert
                message="Điểm đã được submit"
                description="Panel đã thấy điểm của bạn (blind đã mở). Bạn vẫn sửa điểm / bổ sung nhận xét được cho tới khi hồ sơ có quyết định tuyển."
                type="info"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}

            {isLocked && (
              <Alert
                message="Phiếu chấm đã khóa"
                description={lockReason || 'Hồ sơ đã có quyết định (Offer / Tuyển / Từ chối) — không sửa phiếu được nữa.'}
                type="warning"
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
          message="Lưu ý"
          description="Sau khi submit, điểm của bạn hiện với cả panel (mở blind). Bạn vẫn sửa được cho tới khi hồ sơ có quyết định tuyển."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <p>Bạn có chắc chắn muốn submit điểm đánh giá này?</p>
        <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, marginTop: 16 }}>
          <p><strong>Tổng điểm:</strong> {calculateTotal()}/{calculateMaxScore()}</p>
          <p style={{ marginBottom: 0 }}>
            <strong>Đề xuất:</strong>{' '}
            {(() => {
              const r = RECOMMENDATIONS.find((x) => x.key === recommendation);
              return r ? <Tag color={r.color}>{r.label}</Tag> : <Text type="danger">Chưa chọn</Text>;
            })()}
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Grading;
