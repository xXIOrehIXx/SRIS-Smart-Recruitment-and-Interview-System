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
  Empty,
  Divider,
  Result,
} from 'antd';
import {
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  EditOutlined,
  EyeOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { interviewAPI, applicationAPI } from '../../services/api';

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
 * Popup chi tiết 1 buổi phỏng vấn.
 *
 * Hiện:
 *  - Thời gian, vòng, trạng thái lịch (PENDING/CONFIRMED/...)
 *  - Ứng viên (tên, email) + vị trí
 *  - Trạng thái phiếu chấm (NOT_STARTED / DRAFT / SUBMITTED)
 *
 * Có nút "Chấm điểm" / "Xem & sửa" chuyển sang trang Grading.
 *
 * Props:
 *  - schedule: { scheduleId, applicationId, status, startTime, candidateName, candidateEmail, jobTitle, roundNumber, mySheetStatus }
 *  - open / onClose
 *  - mode: 'incoming' | 'history' — để điều chỉnh label nút và copy
 */
const InterviewDetailModal = ({ schedule, open, onClose, mode = 'incoming' }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [application, setApplication] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !schedule?.applicationId) return;
    let cancelled = false;
    const fetchApp = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await applicationAPI.getById(schedule.applicationId);
        if (!cancelled) setApplication(res.data || null);
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

  if (!schedule) return null;

  const sheetStatus = schedule.mySheetStatus || 'NOT_STARTED';
  const isSubmitted = sheetStatus === 'SUBMITTED';
  const isDraft = sheetStatus === 'DRAFT';
  const scheduleStatusCfg = STATUS_CONFIG[schedule.status] || { color: 'default', label: schedule.status };
  const sheetStatusCfg = SHEET_STATUS_CONFIG[sheetStatus] || SHEET_STATUS_CONFIG.NOT_STARTED;

  const handleGrade = () => {
    onClose?.();
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
        mode: isSubmitted ? 'view' : isDraft ? 'continue' : 'new',
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
                  <Tag>{application.currentState}</Tag>
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
          </>
        )}

        <Divider style={{ margin: '16px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {isSubmitted
              ? 'Bạn đã nộp phiếu — có thể mở lại để xem tổng hợp điểm panel (sau khi cả panel nộp).'
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
              {isSubmitted ? 'Xem / Sửa điểm' : isDraft ? 'Tiếp tục chấm' : 'Chấm điểm'}
              <ArrowRightOutlined />
            </Button>
          </Space>
        </div>
      </Spin>
    </Modal>
  );
};

export default InterviewDetailModal;
