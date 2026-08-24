import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Button, Table, Tag, Space, Modal, Form, DatePicker, Select,
  Input, message, Popconfirm, Alert, Tooltip
} from 'antd';
import {
  PlusOutlined, CalendarOutlined, ReloadOutlined, PhoneOutlined, TeamOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import { interviewAPI, jobsAPI, applicationAPI } from '../../services/api';
import '../Dashboard.css';

const { Title, Text } = Typography;

// Thông báo lỗi từ BE (ErrorObjectCommon) — hiện đúng câu BE trả về.
const apiMessage = (error, fallback) =>
  error?.response?.data?.userMsg || error?.response?.data?.UserMsg || fallback;

/**
 * Lịch phỏng vấn — bộ phận nhân sự (docs Section 15, viết lại 15/08/2026).
 *
 * Nhân sự CHỦ ĐỘNG: gọi cho người phỏng vấn hỏi lịch rảnh, gọi ứng viên thống nhất giờ, rồi
 * nhập buổi vào đây. Mô hình cũ (mở pool khung rồi gửi magic link cho ứng viên tự chọn) đã bỏ —
 * ngồi đợi ứng viên bấm link chậm hơn một cuộc gọi.
 *
 * Chỉ đặt được cho ứng viên đã được Trưởng bộ phận duyệt vào vòng phỏng vấn (state INTERVIEW).
 *
 * V045 (16/08/2026): người phỏng vấn KHÔNG còn là dropdown toàn công ty. Trưởng bộ phận chỉ
 * định ai được gặp từng ứng viên; ở đây chỉ hiện đúng những người đó (chọn sẵn cả nhóm, bỏ bớt
 * được). Bạn chốt GIỜ, họ chốt NGƯỜI.
 */
const InterviewScheduleRecruit = () => {
  // ?jobId= — mở thẳng đúng vị trí người dùng vừa đứng (trang ứng viên, trang tin tuyển dụng).
  const [searchParams, setSearchParams] = useSearchParams();
  const jobIdFromUrl = Number(searchParams.get('jobId')) || null;

  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Người phỏng vấn Trưởng bộ phận chỉ định cho ỨNG VIÊN đang chọn trong form (V045).
  // Rỗng = DM chưa chỉ định -> BE sẽ từ chối đặt buổi, nên chặn luôn ở đây cho khỏi bấm phí.
  const [assignedPanel, setAssignedPanel] = useState([]);
  const [panelLoading, setPanelLoading] = useState(false);

  const [bookModalOpen, setBookModalOpen] = useState(false);
  // Buổi đang SỬA (null = đang đặt buổi mới). Dùng chung một modal: hai việc nhập đúng những ô
  // như nhau, tách ra là hai bản sao của cùng một form rồi trôi khỏi nhau.
  const [editingSession, setEditingSession] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookForm] = Form.useForm();

  const closeBookModal = () => {
    setBookModalOpen(false);
    setEditingSession(null);
    bookForm.resetFields();
    setAssignedPanel([]);
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      const jobList = response.data || [];
      setJobs(jobList);
      if (jobList.length === 0) return;
      // Job trong URL phải CÓ trong danh sách mới chọn — id rác (job đã đóng/khác công ty)
      // thì bảng trống trơn mà không rõ vì sao, thà rơi về vị trí đầu.
      const wanted = jobList.find((j) => j.jobId === jobIdFromUrl);
      setSelectedJobId(wanted ? wanted.jobId : jobList[0].jobId);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      message.error('Không thể tải danh sách vị trí');
    }
  };

  // Đổi ứng viên trong form -> nạp đúng nhóm người phỏng vấn của người đó và chọn sẵn cả nhóm
  // (thường cả nhóm cùng dự; bỏ bớt ai bận thì bấm x).
  const handleCandidateChange = async (applicationId) => {
    bookForm.setFieldsValue({ interviewerIds: [] });
    setAssignedPanel([]);
    if (!applicationId) return;
    setPanelLoading(true);
    try {
      const res = await interviewAPI.getAssignedInterviewers(applicationId);
      const panel = res.data || [];
      setAssignedPanel(panel);
      bookForm.setFieldsValue({ interviewerIds: panel.map((p) => p.interviewerId) });
    } catch (error) {
      console.error(error);
      message.error(apiMessage(error, 'Không tải được danh sách người phỏng vấn của ứng viên này'));
    } finally {
      setPanelLoading(false);
    }
  };

  const fetchJobData = useCallback(async (jobId) => {
    if (!jobId) {
      setSessions([]);
      setApplications([]);
      return;
    }
    setLoading(true);
    try {
      const [sessionsRes, appsRes] = await Promise.all([
        interviewAPI.getJobInterviews(jobId),
        applicationAPI.getAll(jobId),
      ]);
      setSessions(sessionsRes.data || []);
      setApplications(appsRes.data?.applications || []);
    } catch (error) {
      console.error('Error fetching interviews:', error);
      message.error(apiMessage(error, 'Không thể tải lịch phỏng vấn của vị trí này'));
      setSessions([]);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobData(selectedJobId);
  }, [selectedJobId, fetchJobData]);

  // Ứng viên đã được Trưởng bộ phận duyệt vào vòng phỏng vấn — người duy nhất đặt lịch được.
  const interviewStageApps = applications.filter((a) => a.currentState === 'INTERVIEW');

  const roundLabel = (s) => `Vòng ${s.roundNumber}${s.roundName ? ` · ${s.roundName}` : ''}`;

  // --- Lịch bận của người phỏng vấn (V047) --------------------------------
  // Nguồn lực người phỏng vấn khan hiếm hơn ứng viên, nên giờ của họ mới là ràng buộc thật.
  // Hiện luôn các buổi đã chốt của những người đang chọn để nhân sự cầm sẵn khi gọi điện —
  // trước đây chỉ biết trùng SAU khi bấm lưu, tức là đã hẹn xong với ứng viên rồi.
  const watchedInterviewerIds = Form.useWatch('interviewerIds', bookForm);
  const watchedStartTime = Form.useWatch('startTime', bookForm);
  const [busySlots, setBusySlots] = useState([]);
  const [busyLoading, setBusyLoading] = useState(false);

  // Cửa sổ 14 ngày quanh ngày đang chọn (chưa chọn thì từ hôm nay) — đủ cho một lần hẹn.
  const busyWindowStart = (watchedStartTime || dayjs()).startOf('day');
  const busyWindowKey = busyWindowStart.format('YYYY-MM-DD');
  const selectedInterviewerKey = (watchedInterviewerIds || []).join(',');

  useEffect(() => {
    if (!bookModalOpen || !selectedInterviewerKey) {
      setBusySlots([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setBusyLoading(true);
      try {
        const start = dayjs(busyWindowKey).startOf('day');
        const res = await interviewAPI.getInterviewerBusy(
          selectedInterviewerKey.split(','),
          start.format('YYYY-MM-DDTHH:mm:ss'),
          start.add(14, 'day').format('YYYY-MM-DDTHH:mm:ss'),
        );
        if (!cancelled) setBusySlots(res.data || []);
      } catch (error) {
        // Lịch bận chỉ để tham khảo — hỏng thì im lặng, đừng chặn việc đặt buổi.
        console.error('Error fetching interviewer busy slots:', error);
        if (!cancelled) setBusySlots([]);
      } finally {
        if (!cancelled) setBusyLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [bookModalOpen, selectedInterviewerKey, busyWindowKey]);

  // Buổi của nhóm nằm SÁT giờ đang chọn (dưới 30 phút). Chỉ NHẮC, không chặn: từ 18/08/2026
  // backend chỉ chặn trùng đúng giờ, vì buổi 30 phút xong là mời người kế tiếp vào luôn —
  // hệ thống không biết buổi trước dài bao lâu, người gọi điện chốt lịch thì biết.
  const NEAR_MINUTES = 30;
  const nearbySlots = watchedStartTime
    ? busySlots.filter(
        (b) => Math.abs(dayjs(b.startTime).diff(watchedStartTime, 'minute')) < NEAR_MINUTES
      )
    : [];
  // Trùng khít giờ — cái này backend sẽ từ chối, nói trước cho khỏi bấm phí.
  const sameTimeSlots = nearbySlots.filter(
    (b) => dayjs(b.startTime).isSame(watchedStartTime, 'minute')
  );

  const handleJobChange = (jobId) => {
    setSelectedJobId(jobId);
    // Giữ vị trí đang xem trên URL để F5 / chia sẻ link không nhảy về job đầu danh sách.
    setSearchParams(jobId ? { jobId: String(jobId) } : {});
  };

  // Sửa buổi đã chốt: nạp đúng nhóm người phỏng vấn ứng viên được chỉ định, rồi điền form theo
  // buổi HIỆN TẠI — không chọn sẵn cả nhóm như lúc đặt mới, panel của buổi này mới là đúng.
  const openEditSession = async (s) => {
    setEditingSession(s);
    setAssignedPanel([]);
    setBookModalOpen(true);
    bookForm.setFieldsValue({
      applicationId: s.applicationId,
      interviewerIds: (s.interviewers || []).map((i) => i.interviewerId),
      startTime: dayjs(s.startTime),
      name: s.roundName || undefined,
    });
    setPanelLoading(true);
    try {
      const res = await interviewAPI.getAssignedInterviewers(s.applicationId);
      setAssignedPanel(res.data || []);
    } catch (error) {
      console.error(error);
      message.error(apiMessage(error, 'Không tải được danh sách người phỏng vấn của ứng viên này'));
    } finally {
      setPanelLoading(false);
    }
  };

  const handleBook = async (values) => {
    // KHÔNG format 'Z': giờ người dùng chọn là giờ ĐỊA PHƯƠNG. Gắn 'Z' là đẩy buổi lệch đúng
    // offset múi giờ (VN +7) so với giờ đã hẹn qua điện thoại.
    const payload = {
      interviewerIds: values.interviewerIds,
      startTime: values.startTime.format('YYYY-MM-DDTHH:mm:ss'),
      name: values.name || null,
    };
    try {
      setSubmitting(true);
      if (editingSession) {
        await interviewAPI.updateInterview(editingSession.scheduleId, payload);
        message.success('Đã cập nhật buổi phỏng vấn — hệ thống gửi lại email xác nhận kèm lịch (.ics) cho ứng viên.');
      } else {
        await interviewAPI.bookInterview(values.applicationId, payload);
        message.success('Đã lưu buổi phỏng vấn — hệ thống đã gửi email xác nhận kèm lịch (.ics) cho ứng viên.');
      }
      closeBookModal();
      fetchJobData(selectedJobId);
    } catch (error) {
      console.error(error);
      message.error(apiMessage(error, editingSession
        ? 'Không cập nhật được buổi phỏng vấn'
        : 'Không lưu được buổi phỏng vấn'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (scheduleId) => {
    try {
      await interviewAPI.cancelInterview(scheduleId, 'Hủy bởi bộ phận nhân sự');
      message.success('Đã hủy buổi phỏng vấn — hệ thống đã báo ứng viên.');
      fetchJobData(selectedJobId);
    } catch (error) {
      console.error(error);
      message.error(apiMessage(error, 'Không hủy được buổi phỏng vấn'));
    }
  };

  const columns = [
    {
      title: 'Ứng viên',
      key: 'candidate',
      render: (_, s) => (
        <div>
          <Text strong>{s.candidateName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{s.candidateEmail}</Text>
        </div>
      ),
    },
    {
      title: 'Vòng',
      key: 'round',
      width: 200,
      render: (_, s) => <Tag color="blue">{roundLabel(s)}</Tag>,
    },
    {
      title: 'Thời gian',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 190,
      render: (t) => (
        <span><CalendarOutlined /> {dayjs(t).format('HH:mm - DD/MM/YYYY')}</span>
      ),
    },
    {
      title: 'Người phỏng vấn',
      dataIndex: 'interviewers',
      key: 'interviewers',
      render: (list) => (list?.length
        ? list.map((i) => <Tag key={i.interviewerId}>{i.fullName || i.email}</Tag>)
        : <Text type="secondary">—</Text>),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status) => {
        const config = {
          CONFIRMED: { color: 'success', label: 'Đã chốt' },
          CANCELLED: { color: 'default', label: 'Đã hủy' },
        };
        const c = config[status] || { color: 'default', label: status };
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 170,
      render: (_, s) => (
        s.status === 'CANCELLED' ? null : (
          <Space size={4}>
            {/* Dời giờ / đổi người KHÔNG phải hủy rồi đặt lại: hủy là ứng viên nhận thư báo hủy
                và phiếu chấm của buổi cũ thành rác, chỉ vì đổi một con số giờ. */}
            <Button size="small" onClick={() => openEditSession(s)}>Sửa</Button>
            <Popconfirm
              title="Hủy buổi phỏng vấn này?"
              description="Hệ thống sẽ gửi email báo ứng viên."
              okText="Hủy buổi"
              cancelText="Không"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleCancel(s.scheduleId)}
            >
              <Button danger size="small">Hủy buổi</Button>
            </Popconfirm>
          </Space>
        )
      ),
    },
  ];

  return (
    <div className="interview-schedule-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Lịch Phỏng Vấn</Title>
          <Text type="secondary">
            Gọi thống nhất giờ với người phỏng vấn và ứng viên, rồi nhập buổi vào đây
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchJobData(selectedJobId)}>
            Tải lại
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              bookForm.resetFields();
              setAssignedPanel([]);
              setEditingSession(null);
              setBookModalOpen(true);
            }}
            disabled={!selectedJobId}
          >
            Đặt lịch phỏng vấn
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        icon={<PhoneOutlined />}
        style={{ marginBottom: 16 }}
        message="Bạn chủ động chốt giờ, hệ thống lo phần còn lại"
        description={
          'Hỏi người phỏng vấn lịch rảnh → gọi ứng viên thống nhất giờ → nhập buổi vào đây. ' +
          'Hệ thống tự kiểm tra trùng giờ, gửi email xác nhận kèm tệp lịch (.ics) cho ứng viên, ' +
          'và tạo phiếu chấm cho người phỏng vấn.'
        }
      />

      <Card className="main-card" bordered={false} style={{ marginBottom: 16 }}>
        <Space wrap>
          <Text strong>Vị trí:</Text>
          <Select
            style={{ minWidth: 320 }}
            value={selectedJobId}
            onChange={handleJobChange}
            showSearch
            optionFilterProp="label"
            placeholder="Chọn vị trí"
            options={jobs.map((j) => ({ value: j.jobId, label: j.title }))}
            notFoundContent="Chưa có tin tuyển dụng nào"
          />
          <Tooltip title="Ứng viên đã được Trưởng bộ phận duyệt vào vòng phỏng vấn">
            <Tag icon={<TeamOutlined />} color={interviewStageApps.length ? 'blue' : 'default'}>
              {interviewStageApps.length} ứng viên chờ xếp lịch
            </Tag>
          </Tooltip>
        </Space>
      </Card>

      <Card className="main-card" bordered={false}>
        <Table
          columns={columns}
          dataSource={sessions}
          rowKey="scheduleId"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'Vị trí này chưa có buổi phỏng vấn nào' }}
        />
      </Card>

      <Modal
        title={editingSession
          ? `Sửa buổi phỏng vấn - ${editingSession.candidateName}`
          : 'Đặt lịch phỏng vấn'}
        open={bookModalOpen}
        onCancel={closeBookModal}
        footer={null}
        width={560}
        destroyOnClose
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={editingSession
            ? 'Chỉ sửa khi đã báo lại ứng viên và người phỏng vấn'
            : 'Chỉ nhập buổi ĐÃ thống nhất qua điện thoại'}
          description={editingSession
            ? 'Hệ thống gửi lại email xác nhận kèm lịch (.ics) theo giờ mới ngay khi lưu.'
            : 'Hệ thống gửi email xác nhận ngay khi lưu — ứng viên sẽ nhận đúng giờ bạn nhập.'}
        />
        <Form form={bookForm} layout="vertical" onFinish={handleBook}>
          <Form.Item
            name="applicationId"
            label="Ứng viên"
            rules={[{ required: true, message: 'Chọn ứng viên' }]}
          >
            <Select
              placeholder="Chọn ứng viên"
              showSearch
              optionFilterProp="label"
              onChange={handleCandidateChange}
              /* Sửa buổi thì KHÔNG đổi được ứng viên: buổi này là của người đó, chuyển sang
                 người khác thì phiếu chấm đã lưu trỏ nhầm hồ sơ. Cần vậy thì đặt buổi mới. */
              disabled={!!editingSession}
              options={(editingSession
                ? [{
                    applicationId: editingSession.applicationId,
                    candidateName: editingSession.candidateName,
                    candidateEmail: editingSession.candidateEmail,
                  }]
                : interviewStageApps
              ).map((a) => ({
                value: a.applicationId,
                label: `${a.candidateName}${a.candidateEmail ? ` — ${a.candidateEmail}` : ''}`,
              }))}
              notFoundContent={
                <Text type="secondary">
                  Chưa có hồ sơ nào được duyệt vào vòng phỏng vấn — Trưởng bộ phận phụ trách
                  vị trí duyệt trước, hồ sơ sẽ tự hiện ở đây
                </Text>
              }
            />
          </Form.Item>

          <Form.Item
            name="interviewerIds"
            label="Người phỏng vấn"
            tooltip="Trưởng bộ phận chỉ định ai được gặp ứng viên này. Bạn chỉ chọn trong nhóm đó."
            rules={[{ required: true, message: 'Chọn ít nhất 1 người' }]}
            extra={
              !panelLoading && assignedPanel.length === 0 ? (
                <Text type="warning">
                  Trưởng bộ phận chưa chỉ định người phỏng vấn cho ứng viên này — hãy đề nghị họ
                  chọn ở màn Duyệt Ứng Viên Vào Phỏng Vấn, rồi quay lại đặt lịch.
                </Text>
              ) : (
                'Cả nhóm được chọn sẵn — bỏ bớt người bận nếu buổi này không cần đủ.'
              )
            }
          >
            <Select
              mode="multiple"
              maxCount={5}
              placeholder="Chọn người phỏng vấn"
              showSearch
              optionFilterProp="label"
              loading={panelLoading}
              disabled={panelLoading || assignedPanel.length === 0}
              options={assignedPanel.map((i) => ({
                value: i.interviewerId,
                label: i.fullName || i.email,
              }))}
              notFoundContent={
                <Text type="secondary">Chọn ứng viên trước để thấy người phỏng vấn được chỉ định</Text>
              }
            />
          </Form.Item>

          <Form.Item
            name="startTime"
            label="Thời gian bắt đầu"
            rules={[{ required: true, message: 'Chọn thời gian' }]}
          >
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="HH:mm DD/MM/YYYY"
              style={{ width: '100%' }}
              placeholder="Chọn ngày giờ đã hẹn"
              // Quá khứ thì BE cũng chặn; chặn sớm ở đây để khỏi bấm xong mới biết.
              disabledDate={(d) => d && d < dayjs().startOf('day')}
            />
          </Form.Item>

          {/* Lịch bận của nhóm đang chọn (V047) — đọc trước khi chốt giờ qua điện thoại. */}
          {(busyLoading || busySlots.length > 0 || nearbySlots.length > 0) && (
            <div style={{ marginBottom: 16 }}>
              {sameTimeSlots.length > 0 ? (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginBottom: 8 }}
                  message="Trùng đúng giờ — không lưu được"
                  description={sameTimeSlots
                    .map((b) => `${b.interviewerName} đã có buổi lúc ${dayjs(b.startTime).format('HH:mm DD/MM')}`)
                    .join(' · ')}
                />
              ) : nearbySlots.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 8 }}
                  message={`Sát giờ một buổi khác (dưới ${NEAR_MINUTES} phút)`}
                  description={`${nearbySlots
                    .map((b) => `${b.interviewerName} có buổi lúc ${dayjs(b.startTime).format('HH:mm DD/MM')}`)
                    .join(' · ')} — vẫn lưu được nếu bạn đã hẹn như vậy.`}
                />
              )}
              <Card
                size="small"
                title={
                  <Space size={6}>
                    <CalendarOutlined />
                    <Text style={{ fontSize: 13 }}>
                      Lịch đã kín của người phỏng vấn — 14 ngày từ {busyWindowStart.format('DD/MM')}
                    </Text>
                  </Space>
                }
                loading={busyLoading}
                styles={{ body: { maxHeight: 160, overflowY: 'auto', padding: 12 } }}
              >
                {busySlots.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Cả nhóm đang trống trong 14 ngày tới.
                  </Text>
                ) : (
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    {busySlots.map((b, idx) => (
                      <Text key={`${b.interviewerId}-${b.startTime}-${idx}`} style={{ fontSize: 13 }}>
                        <Tag>{dayjs(b.startTime).format('HH:mm DD/MM')}</Tag>
                        {b.interviewerName}
                        {b.candidateName ? ` — ${b.candidateName}` : ''}
                      </Text>
                    ))}
                  </Space>
                )}
              </Card>
            </div>
          )}

          <Form.Item
            name="name"
            label="Tên vòng (tùy chọn)"
            tooltip="Số vòng do hệ thống tự đánh. Tên nói buổi này để LÀM GÌ, ví dụ 'Phỏng vấn chuyên môn'."
          >
            <Input placeholder="VD: Phỏng vấn chuyên môn" maxLength={120} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={closeBookModal}>
                Hủy
              </Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {editingSession ? 'Lưu thay đổi' : 'Lưu buổi phỏng vấn'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InterviewScheduleRecruit;
