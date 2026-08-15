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
 */
const InterviewScheduleRecruit = () => {
  // ?jobId= — mở thẳng đúng vị trí người dùng vừa đứng (trang ứng viên, trang tin tuyển dụng).
  const [searchParams, setSearchParams] = useSearchParams();
  const jobIdFromUrl = Number(searchParams.get('jobId')) || null;

  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [applications, setApplications] = useState([]);
  const [interviewers, setInterviewers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookForm] = Form.useForm();

  useEffect(() => {
    fetchJobs();
    fetchInterviewers();
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

  const fetchInterviewers = async () => {
    try {
      const response = await interviewAPI.getInterviewers();
      setInterviewers(response.data || []);
    } catch (error) {
      console.error('Error fetching interviewers:', error);
      setInterviewers([]);
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

  const handleJobChange = (jobId) => {
    setSelectedJobId(jobId);
    // Giữ vị trí đang xem trên URL để F5 / chia sẻ link không nhảy về job đầu danh sách.
    setSearchParams(jobId ? { jobId: String(jobId) } : {});
  };

  const handleBook = async (values) => {
    try {
      setSubmitting(true);
      await interviewAPI.bookInterview(values.applicationId, {
        interviewerIds: values.interviewerIds,
        // KHÔNG format 'Z': giờ người dùng chọn là giờ ĐỊA PHƯƠNG. Gắn 'Z' là đẩy buổi lệch
        // đúng offset múi giờ (VN +7) so với giờ đã hẹn qua điện thoại.
        startTime: values.startTime.format('YYYY-MM-DDTHH:mm:ss'),
        name: values.name || null,
      });
      message.success('Đã lưu buổi phỏng vấn — hệ thống đã gửi email xác nhận kèm lịch (.ics) cho ứng viên.');
      setBookModalOpen(false);
      bookForm.resetFields();
      fetchJobData(selectedJobId);
    } catch (error) {
      console.error(error);
      message.error(apiMessage(error, 'Không lưu được buổi phỏng vấn'));
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
      width: 110,
      render: (_, s) => (
        s.status === 'CANCELLED' ? null : (
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
            onClick={() => { bookForm.resetFields(); setBookModalOpen(true); }}
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
        title="Đặt lịch phỏng vấn"
        open={bookModalOpen}
        onCancel={() => { setBookModalOpen(false); bookForm.resetFields(); }}
        footer={null}
        width={560}
        destroyOnClose
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Chỉ nhập buổi ĐÃ thống nhất qua điện thoại"
          description="Hệ thống gửi email xác nhận ngay khi lưu — ứng viên sẽ nhận đúng giờ bạn nhập."
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
              options={interviewStageApps.map((a) => ({
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
            label="Người phỏng vấn (1–5 người)"
            rules={[{ required: true, message: 'Chọn ít nhất 1 người' }]}
          >
            <Select
              mode="multiple"
              maxCount={5}
              placeholder="Chọn người phỏng vấn"
              showSearch
              optionFilterProp="label"
              options={interviewers.map((i) => ({
                value: i.userId,
                label: i.fullName || i.email,
              }))}
              notFoundContent={
                <Text type="secondary">Chưa có tài khoản Interviewer — nhờ Admin tạo</Text>
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

          <Form.Item
            name="name"
            label="Tên vòng (tùy chọn)"
            tooltip="Số vòng do hệ thống tự đánh. Tên nói buổi này để LÀM GÌ, ví dụ 'Phỏng vấn chuyên môn'."
          >
            <Input placeholder="VD: Phỏng vấn chuyên môn" maxLength={120} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setBookModalOpen(false); bookForm.resetFields(); }}>
                Hủy
              </Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                Lưu buổi phỏng vấn
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InterviewScheduleRecruit;
