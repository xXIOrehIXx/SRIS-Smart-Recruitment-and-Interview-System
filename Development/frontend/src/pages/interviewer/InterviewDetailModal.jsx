import React, { useEffect, useState } from 'react';
import {
  Modal,
  Descriptions,
  Tag,
  Avatar,
  Space,
  Button,
  Typography,
  Spin,
  Divider,
  Alert,
  message,
} from 'antd';
import {
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  EditOutlined,
  EyeOutlined,
  ArrowRightOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { applicationAPI, cvAPI } from '../../services/api';
import ApplicationStateTag from '../../components/ApplicationStateTag';
import FitScoreTag from '../../components/FitScoreTag';

const { Title, Text, Paragraph } = Typography;

const MATCHA_GREEN = '#5D8C3E';

const STATUS_CONFIG = {
  PENDING: { color: 'warning', label: 'Chờ ứng viên chốt lịch' },
  CONFIRMED: { color: 'processing', label: 'Đã chốt lịch' },
  NO_SLOT_FITS: { color: 'error', label: 'Không khớp khung giờ' },
  CANCELLED: { color: 'default', label: 'Đã hủy' },
  COMPLETED: { color: 'success', label: 'Đã hoàn thành' },
};

const SHEET_STATUS_CONFIG = {
  NOT_STARTED: { color: 'default', label: 'Chưa chấm' },
  DRAFT: { color: 'warning', label: 'Đang chấm (nháp)' },
  SUBMITTED: { color: 'success', label: 'Đã nộp' },
};

/**
 * Popup chi tiết 1 buổi phỏng vấn — dùng chung cho Incoming (sắp tới) và History (đã chấm).
 *
 * Props:
 *  - schedule: { scheduleId, applicationId, status, startTime, candidateName, candidateEmail, jobTitle, roundNumber, mySheetStatus }
 *  - open / onClose
 *  - mode: 'incoming' | 'history'
 */
const InterviewDetailModal = ({ schedule, open, onClose, mode = 'incoming' }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [application, setApplication] = useState(null);
  const [screening, setScreening] = useState(null);
  const [openingCv, setOpeningCv] = useState(false);

  useEffect(() => {
    if (!open || !schedule?.applicationId) return;
    let cancelled = false;
    const fetchApp = async () => {
      try {
        setLoading(true);
        // Bản phân tích CV chạy song song và ĐỘC LẬP: hồ sơ chưa ai bấm phân tích thì
        // endpoint trả NONE, không phải lỗi — không được để nó làm hỏng cả popup.
        const [appRes, screeningRes] = await Promise.allSettled([
          applicationAPI.getById(schedule.applicationId),
          cvAPI.getScreening(schedule.applicationId),
        ]);
        if (cancelled) return;
        setApplication(appRes.status === 'fulfilled' ? appRes.value.data || null : null);
        setScreening(screeningRes.status === 'fulfilled' ? screeningRes.value.data || null : null);
      } catch (err) {
        if (!cancelled) {
          console.warn('Không tải được application:', err);
          setApplication(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchApp();
    return () => { cancelled = true; };
  }, [open, schedule?.applicationId]);

  /**
   * Mở file CV gốc. Tới 17/08/2026 vai Interviewer không được phép gọi endpoint này — người
   * phỏng vấn ngồi vào phòng mà không mở nổi CV của ứng viên, phải đi xin qua chat.
   */
  const handleOpenCv = async () => {
    if (!application?.cvId) return;
    setOpeningCv(true);
    try {
      const res = await cvAPI.getCvFileUrl(application.cvId);
      const url = res.data?.url;
      if (url) window.open(url, '_blank', 'noopener');
      else message.warning('Hồ sơ này không có file CV gốc.');
    } catch (err) {
      console.error('Error opening CV:', err);
      message.error(err?.response?.data?.userMsg || 'Không mở được file CV');
    } finally {
      setOpeningCv(false);
    }
  };

  if (!schedule) return null;

  const sheetStatus = schedule.mySheetStatus || 'NOT_STARTED';
  const isSubmitted = sheetStatus === 'SUBMITTED';
  const isDraft = sheetStatus === 'DRAFT';
  // Khóa sửa phiếu khi hồ sơ đã có quyết định (OFFER/HIRED/REJECTED) — BE trả cờ này theo từng buổi.
  const isLocked = !!schedule.isLocked;
  const scheduleStatusCfg = STATUS_CONFIG[schedule.status] || { color: 'default', label: schedule.status };
  const sheetStatusCfg = SHEET_STATUS_CONFIG[sheetStatus] || SHEET_STATUS_CONFIG.NOT_STARTED;

  const handleGrade = () => {
    onClose?.();
    // candidate object giữ 3 alias (candidateName/candidate/name) để Grading.jsx fallback chain
    // (candidateData.candidateName || candidateData.candidate || candidateData.name) luôn có giá trị.
    navigate(`/interviewer/grading/${schedule.scheduleId}`, {
      state: {
        schedule,
        candidate: {
          candidateName: schedule.candidateName,
          candidate: schedule.candidateName,
          name: schedule.candidateName,
          email: schedule.candidateEmail,
          position: schedule.jobTitle,
          jobTitle: schedule.jobTitle,
          round: schedule.roundNumber,
          startTime: schedule.startTime,
        },
        mode: isLocked ? 'view' : sheetStatus === 'NOT_STARTED' ? 'new' : 'continue',
      },
    });
  };

  const formattedDate = schedule.startTime ? dayjs(schedule.startTime) : null;
  const isPast = formattedDate ? formattedDate.isBefore(dayjs()) : false;
  const isHistoryMode = mode === 'history' || isSubmitted || isPast;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnClose
      title={
        <Space>
          <Avatar style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />
          <div>
            <Text strong style={{ fontSize: 16 }}>
              {isHistoryMode ? 'Chi tiết buổi phỏng vấn' : 'Chi tiết buổi phỏng vấn sắp tới'}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {schedule.candidateName} — {schedule.jobTitle}
            </Text>
          </div>
        </Space>
      }
    >
      <Spin spinning={loading}>
        <Descriptions
          column={1}
          bordered
          size="small"
          labelStyle={{ width: 160, background: '#fafafa' }}
        >
          <Descriptions.Item label={<><UserOutlined /> Ứng viên</>}>
            <Space direction="vertical" size={0}>
              <Text strong>{schedule.candidateName || 'N/A'}</Text>
              {schedule.candidateEmail && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {schedule.candidateEmail}
                </Text>
              )}
            </Space>
          </Descriptions.Item>

          <Descriptions.Item label="Vị trí">
            {schedule.jobTitle || 'N/A'}
          </Descriptions.Item>

          <Descriptions.Item label={<><CalendarOutlined /> Ngày phỏng vấn</>}>
            {formattedDate ? formattedDate.format('DD/MM/YYYY (dddd)') : '—'}
          </Descriptions.Item>

          <Descriptions.Item label={<><ClockCircleOutlined /> Giờ phỏng vấn</>}>
            {formattedDate ? formattedDate.format('HH:mm') : '—'}
          </Descriptions.Item>

          <Descriptions.Item label="Vòng">
            <Tag color="cyan">Vòng {schedule.roundNumber || 1}</Tag>
            {/* Tên vòng (V041) — thứ thật sự nói cho người phỏng vấn biết buổi này để làm gì. */}
            {schedule.roundName && <Text style={{ marginLeft: 4 }}>{schedule.roundName}</Text>}
          </Descriptions.Item>

          <Descriptions.Item label="Trạng thái lịch">
            <Tag color={scheduleStatusCfg.color}>{scheduleStatusCfg.label}</Tag>
          </Descriptions.Item>

          <Descriptions.Item label="Phiếu chấm của bạn">
            <Tag color={sheetStatusCfg.color} icon={isSubmitted ? <EyeOutlined /> : <EditOutlined />}>
              {sheetStatusCfg.label}
            </Tag>
          </Descriptions.Item>
        </Descriptions>

        {application && (
          <>
            <Divider style={{ margin: '16px 0 12px' }} />
            <Title level={5} style={{ marginBottom: 8 }}>Thông tin hồ sơ</Title>
            <Descriptions column={2} size="small">
              {application.position && (
                <Descriptions.Item label="Vị trí ứng tuyển">{application.position}</Descriptions.Item>
              )}
              {application.currentState && (
                <Descriptions.Item label="Trạng thái hồ sơ">
                  <ApplicationStateTag state={application.currentState} />
                </Descriptions.Item>
              )}
              {application.departmentName && (
                <Descriptions.Item label="Phòng ban">{application.departmentName}</Descriptions.Item>
              )}
              {application.appliedAt && (
                <Descriptions.Item label="Ngày nộp">
                  {dayjs(application.appliedAt).format('DD/MM/YYYY')}
                </Descriptions.Item>
              )}
            </Descriptions>

            {application.cvId && (
              <Button
                icon={<FileTextOutlined />}
                onClick={handleOpenCv}
                loading={openingCv}
                style={{ marginTop: 4 }}
              >
                Mở CV ứng viên
              </Button>
            )}

            {/* Bản đối chiếu CV↔tin tuyển dụng của AI — "cơ sở" để chuẩn bị câu hỏi, không phải
                kết luận. Phần đáng đọc nhất là mục THIẾU: đó là chỗ nên hỏi trực tiếp trong buổi.
                Chỉ hiện khi đã phân tích xong; chưa có thì im lặng bỏ qua. */}
            {screening?.status === 'DONE' && screening.result && (
              <>
                <Divider style={{ margin: '16px 0 12px' }} />
                <Space align="center" style={{ marginBottom: 8 }}>
                  <Title level={5} style={{ margin: 0 }}>AI đối chiếu CV với tin tuyển dụng</Title>
                  <FitScoreTag
                    status={screening.status}
                    fitScore={screening.result.fitScore}
                    decision={screening.result.decision}
                  />
                </Space>

                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="Tham khảo trước buổi phỏng vấn"
                  description="Đây là nhận định của AI đọc CV, không phải đánh giá ứng viên. Điểm chấm của bạn vẫn phải dựa trên những gì bạn nghe được trong buổi."
                />

                {screening.result.summary && (
                  <Paragraph style={{ marginBottom: 12 }}>{screening.result.summary}</Paragraph>
                )}

                {screening.result.missing?.length > 0 && (
                  <>
                    <Text strong>Điểm CV chưa thể hiện — nên hỏi trong buổi:</Text>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                      {screening.result.missing.map((m, i) => (
                        <li key={i}><Text>{m}</Text></li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </>
        )}

        <Divider style={{ margin: '16px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {isLocked
              ? 'Hồ sơ đã có quyết định — phiếu chấm đã khóa, chỉ xem lại được.'
              : isSubmitted
                ? 'Bạn đã nộp phiếu — vẫn sửa điểm / bổ sung nhận xét được cho tới khi hồ sơ có quyết định.'
                : isDraft
                  ? 'Bạn đang có bản nháp — có thể tiếp tục chấm.'
                  : 'Bạn chưa chấm buổi này.'}
          </Text>
          <Space>
            <Button onClick={onClose}>Đóng</Button>
            <Button
              type="primary"
              icon={isSubmitted ? <EyeOutlined /> : <EditOutlined />}
              onClick={handleGrade}
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
            >
              {isLocked ? 'Xem phiếu' : isSubmitted ? 'Xem / Sửa điểm' : isDraft ? 'Tiếp tục chấm' : 'Chấm điểm'}
              <ArrowRightOutlined />
            </Button>
          </Space>
        </div>
      </Spin>
    </Modal>
  );
};

export default InterviewDetailModal;
