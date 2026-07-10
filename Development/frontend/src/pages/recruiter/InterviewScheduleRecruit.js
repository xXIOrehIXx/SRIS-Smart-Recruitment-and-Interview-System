import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, Tag, Avatar, Space, Modal, Form, DatePicker, Select, Input, message, Row, Col, Descriptions, Empty, Badge, Popconfirm, Divider } from 'antd';
import { PlusOutlined, CalendarOutlined, VideoCameraOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useParams, useSearchParams } from 'react-router-dom';
import { interviewAPI, jobsAPI, applicationAPI } from '../../services/api';
import '../Dashboard.css';

const { Title, Text } = Typography;
const { Option } = Select;

const InterviewSchedule = () => {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [interviewers, setInterviewers] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateDetail, setCandidateDetail] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [editingSlotId, setEditingSlotId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { applicationId } = useParams();
  const [searchParams] = useSearchParams();
  const appId = applicationId || searchParams.get('applicationId');

  useEffect(() => {
    if (appId) {
      fetchInterviews(appId);
    } else {
      setLoading(false);
    }
    fetchInterviewers();
    fetchJobs();
  }, [appId]);

  useEffect(() => {
    form.setFieldsValue({ timeSlots });
  }, [form, timeSlots]);

  const fetchInterviews = async (appId) => {
    setLoading(true);
    try {
      const response = await interviewAPI.getSchedules(appId);
      setInterviews(response.data || []);
    } catch (error) {
      console.error('Error fetching interviews:', error);
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchInterviewers = async () => {
    // Mock interviewers
    setInterviewers([
      { id: 1, name: 'Nguyễn Văn A', email: 'nguyenvana@company.com' },
      { id: 2, name: 'Trần Thị B', email: 'tranthib@company.com' },
      { id: 3, name: 'Lê Văn C', email: 'levanc@company.com' },
    ]);
  };

  const fetchCandidates = async (jobId) => {
    if (!jobId) {
      setCandidates([]);
      setSelectedCandidate(null);
      setCandidateDetail(null);
      form.setFieldsValue({ applicationId: undefined });
      return;
    }

    try {
      const response = await applicationAPI.getAll(jobId);
      const applications = response?.data?.applications || response?.data || [];
      const mappedCandidates = (Array.isArray(applications) ? applications : []).map((item) => ({
        applicationId: item.applicationId,
        candidateId: item.candidateId,
        name: item.candidateName || 'N/A',
        email: item.candidateEmail || '',
        position: item.position || 'Chưa cập nhật',
        cvUrl: item.cvId ? `/cv/${item.cvId}` : null,
        appliedAt: item.appliedAt,
        currentState: item.currentState,
        aiMatchScore: item.aiMatchScore,
        criteriaScore: item.criteriaScore,
      }));

      setCandidates(mappedCandidates);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      setCandidates([]);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      setJobs(response.data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]);
    }
  };

  const handleJobChange = (value) => {
    const job = jobs.find((item) => String(item.jobId || item.id) === String(value));
    setSelectedJob(value);
    setSelectedJobDetail(job || null);
    setSelectedCandidate(null);
    setCandidateDetail(null);
    form.setFieldsValue({ applicationId: undefined });
    fetchCandidates(value);
  };

  const handleAddTimeSlot = () => {
    if (timeSlots.length >= 3) {
      message.warning('Tối đa chỉ có thể thêm 3 slot thời gian');
      return;
    }

    const newSlot = { id: Date.now(), value: null };
    setTimeSlots((prev) => [...prev, newSlot]);
    setEditingSlotId(newSlot.id);
  };

  const handleTimeSlotChange = (slotId, value) => {
    setTimeSlots((prev) => prev.map((slot) => (slot.id === slotId ? { ...slot, value } : slot)));
    if (value) {
      setEditingSlotId(null);
    }
  };

  const handleEditTimeSlot = (slotId) => {
    setEditingSlotId(slotId);
  };

  const handleRemoveTimeSlot = (slotId) => {
    setTimeSlots((prev) => prev.filter((slot) => slot.id !== slotId));
    if (editingSlotId === slotId) {
      setEditingSlotId(null);
    }
  };

  const handleCandidateChange = async (value) => {
    const candidate = candidates.find((c) => String(c.applicationId) === String(value));
    setSelectedCandidate(value);

    setCandidateDetail(
      candidate
        ? {
            applicationId: value,
            name: candidate.name,
            email: candidate.email,
            position: candidate.position,
            cvUrl: candidate.cvUrl,
            appliedAt: candidate.appliedAt,
            currentState: candidate.currentState,
            aiMatchScore: candidate.aiMatchScore,
            criteriaScore: candidate.criteriaScore,
            skills: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
            experience: 'Chưa cập nhật',
            education: 'Chưa cập nhật',
          }
        : null
    );
  };

  const handleCreateSchedule = async (values) => {
    const selectedApplicationId = candidateDetail?.applicationId || appId;

    if (!selectedApplicationId) {
      message.error('Không tìm thấy thông tin ứng viên');
      return;
    }

    if (!timeSlots.length || timeSlots.some((slot) => !slot.value)) {
      message.error('Vui lòng chọn ít nhất một thời gian phỏng vấn');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        RoundNumber: 0,
        Slots: timeSlots.map((slot) => ({
          InterviewerId: 5,
          StartTime: slot.value?.toISOString?.() || dayjs(slot.value).toISOString(),
        })),
      };

      await interviewAPI.createSchedule(selectedApplicationId, payload);
      message.success('Tạo lịch phỏng vấn thành công!');
      setIsModalOpen(false);
      form.resetFields();
      setSelectedCandidate(null);
      setCandidateDetail(null);
      setSelectedJob(null);
      setSelectedJobDetail(null);
      setTimeSlots([]);
      setEditingSlotId(null);
      fetchInterviews(selectedApplicationId);
    } catch (error) {
      console.error('Error creating schedule:', error);
      message.error('Tạo lịch phỏng vấn thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const showModal = () => {
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
    setSelectedCandidate(null);
    setCandidateDetail(null);
    setSelectedJob(null);
    setSelectedJobDetail(null);
    setTimeSlots([]);
    setEditingSlotId(null);
  };

  const handleReschedule = async () => {
    if (!editingSchedule || !rescheduleDate || !appId) {
      message.error('Vui lòng chọn ngày giờ mới');
      return;
    }

    setSubmitting(true);
    try {
      await interviewAPI.reschedule(appId, editingSchedule.id, rescheduleDate.toISOString());
      message.success('Đổi lịch thành công!');
      setIsRescheduleModalOpen(false);
      setEditingSchedule(null);
      setRescheduleDate(null);
      fetchInterviews(appId);
    } catch (error) {
      console.error('Error rescheduling:', error);
      message.error('Đổi lịch thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSchedule = async (scheduleId) => {
    if (!appId) {
      message.error('Không tìm thấy thông tin ứng viên');
      return;
    }

    try {
      await interviewAPI.cancelSchedule(appId, scheduleId, 'Hủy bởi recruiter');
      message.success('Hủy lịch thành công!');
      fetchInterviews(appId);
    } catch (error) {
      console.error('Error canceling schedule:', error);
      message.error('Hủy lịch thất bại. Vui lòng thử lại.');
    }
  };

  const openRescheduleModal = (record) => {
    setEditingSchedule(record);
    setRescheduleDate(null);
    setIsRescheduleModalOpen(true);
  };

  const columns = [
    {
      title: 'Ứng viên',
      dataIndex: 'candidate',
      key: 'candidate',
      render: (text) => (
        <div className="candidate-cell">
          <Avatar style={{ backgroundColor: '#5D8C3E' }}>{text ? text[0] : '?'}</Avatar>
          <span style={{ fontWeight: 600 }}>{text || 'N/A'}</span>
        </div>
      ),
    },
    { title: 'Phòng ban', dataIndex: 'department', key: 'department' },
    {
      title: 'Date & Time',
      dataIndex: 'scheduledAt',
      key: 'scheduledAt',
      render: (text) => (
        <span>
          <CalendarOutlined /> {text ? dayjs(text).format('DD/MM/YYYY - HH:mm') : 'N/A'}
        </span>
      ),
    },
    {
      title: 'Interviewers',
      dataIndex: 'interviewerNames',
      key: 'interviewers',
      render: (names) => names?.map((name, idx) => <Tag key={idx}>{name}</Tag>) || '-',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusConfig = {
          UPCOMING: { color: 'success', label: 'Sắp tới' },
          PENDING: { color: 'warning', label: 'Chờ xác nhận' },
          CONFIRMED: { color: 'processing', label: 'Đã xác nhận' },
          COMPLETED: { color: 'default', label: 'Đã hoàn thành' },
          CANCELLED: { color: 'error', label: 'Đã hủy' },
        };
        const config = statusConfig[status] || { color: 'default', label: status };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.meetingLink && (
            <Button type="primary" icon={<VideoCameraOutlined />} href={record.meetingLink} target="_blank">
              Join
            </Button>
          )}
          {record.status !== 'CANCELLED' && record.status !== 'COMPLETED' && (
            <>
              <Button icon={<EditOutlined />} onClick={() => openRescheduleModal(record)}>
                Đổi lịch
              </Button>
              <Popconfirm
                title="Xác nhận hủy lịch"
                description="Bạn có chắc muốn hủy lịch phỏng vấn này?"
                onConfirm={() => handleCancelSchedule(record.id)}
                okText="Hủy lịch"
                cancelText="Không"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<DeleteOutlined />}>
                  Hủy
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  const filteredData = interviews.filter((item) => {
    const matchesSearch =
      !searchText ||
      (item.candidate || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (item.position || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (item.department || '').toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="interview-schedule-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Interview Schedule</Title>
          <Text type="secondary">Manage interview schedules</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={showModal}>
          Tạo lịch phỏng vấn
        </Button>
      </div>

      {!appId && (
        <Card className="main-card" bordered={false}>
          <Empty description="Vui lòng chọn ứng viên từ trang chi tiết" />
        </Card>
      )}

      {appId && (
        <Card className="main-card" bordered={false}>
          <div className="table-toolbar">
            <Input
              placeholder="Tìm kiếm ứng viên, vị trí..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 260 }}
              allowClear
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 160 }}
              placeholder="Trạng thái"
            >
              <Option value="all">Tất cả trạng thái</Option>
              <Option value="UPCOMING">Sắp tới</Option>
              <Option value="PENDING">Chờ xác nhận</Option>
              <Option value="CONFIRMED">Đã xác nhận</Option>
              <Option value="COMPLETED">Đã hoàn thành</Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={() => fetchInterviews(appId)} loading={loading}>
              Làm mới
            </Button>
          </div>
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="id"
            loading={loading}
            locale={{ emptyText: 'Chưa có lịch phỏng vấn nào' }}
          />
        </Card>
      )}

      <Modal
        title="Tạo lịch phỏng vấn"
        open={isModalOpen}
        onCancel={handleCancel}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Row gutter={24}>
          {/* Cột 1: Thông tin job và slots */}
          <Col span={12}>
            <Form.Item
              label="Tin tuyển dụng"
              rules={[{ required: true, message: 'Vui lòng chọn ứng viên' }]}
            >
              <Select
                placeholder="Tin tuyển dụng"
                showSearch
                allowClear
                optionFilterProp="children"
                value={selectedJob}
                onChange={handleJobChange}
              >
                {jobs.map(job => (
                  <Select.Option
                    key={job.jobId || job.id}
                    value={job.jobId || job.id}
                  >
                    {job.title}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Card title="Thông tin Job" size="small" style={{ marginBottom: 16 }}>
              {selectedJobDetail ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Job">{selectedJobDetail.title || 'Chưa cập nhật'}</Descriptions.Item>
                  <Descriptions.Item label="Mô tả">{selectedJobDetail.jdText || 'Chưa cập nhật'}</Descriptions.Item>
                  <Descriptions.Item label="Vị trí">{selectedJobDetail.location || 'Chưa cập nhật'}</Descriptions.Item>
                  <Descriptions.Item label="Phòng ban">{selectedJobDetail.department || 'Chưa cập nhật'}</Descriptions.Item>
                  <Descriptions.Item label="Loại hình">{selectedJobDetail.employmentType || 'Chưa cập nhật'}</Descriptions.Item>
                </Descriptions>
              ) : (
                <Text type="secondary">Chọn tin tuyển dụng để xem thông tin</Text>
              )}
            </Card>

            <Card title="Các slot phỏng vấn" size="small">
              <p style={{ color: '#888' }}>Danh sách slot sẽ hiển thị sau khi API sẵn sàng</p>
            </Card>
          </Col>

          {/* Cột 2: Form tạo lịch */}
          <Col span={12}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleCreateSchedule}
            >
              <Form.Item
                name="applicationId"
                label="Chọn ứng viên"
                rules={[{ required: true, message: 'Vui lòng chọn ứng viên' }]}
              >
                <Select
                  placeholder="Chọn ứng viên"
                  showSearch
                  optionFilterProp="children"
                  onChange={handleCandidateChange}
                >
                  {candidates.map(candidate => (
                    <Select.Option
                      key={candidate.applicationId}
                      value={candidate.applicationId}
                    >
                      {candidate.name} {candidate.email ? `- ${candidate.email}` : ''}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {candidateDetail && (
                <Card title="Thông tin ứng viên" size="small" style={{ marginBottom: 16 }}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Tên">{candidateDetail.name}</Descriptions.Item>
                    <Descriptions.Item label="Email">{candidateDetail.email || 'Chưa cập nhật'}</Descriptions.Item>
                    <Descriptions.Item label="Trạng thái">{candidateDetail.currentState || 'Chưa cập nhật'}</Descriptions.Item>
                    <Descriptions.Item label="Điểm AI">{candidateDetail.aiMatchScore ?? 'Chưa cập nhật'}</Descriptions.Item>
                    <Descriptions.Item label="Vị trí">{candidateDetail.position}</Descriptions.Item>
                    <Descriptions.Item label="Kinh nghiệm">{candidateDetail.experience}</Descriptions.Item>
                    <Descriptions.Item label="Học vấn">{candidateDetail.education}</Descriptions.Item>
                    <Descriptions.Item label="Kỹ năng">
                      {candidateDetail.skills.map((skill, idx) => (
                        <Tag key={idx} style={{ marginBottom: 4 }}>{skill}</Tag>
                      ))}
                    </Descriptions.Item>
                    <Descriptions.Item label="CV">
                      {candidateDetail.cvUrl ? (
                        <a href={candidateDetail.cvUrl} target="_blank" rel="noopener noreferrer">Xem CV</a>
                      ) : (
                        'Chưa có CV'
                      )}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              )}

              <Form.Item
                name="timeSlots"
                label="Thời gian"
                rules={[{
                  validator: () =>
                    timeSlots.length > 0 && timeSlots.every((slot) => slot.value)
                      ? Promise.resolve()
                      : Promise.reject(new Error('Vui lòng chọn ít nhất một thời gian phỏng vấn')),
                }]}
              >
                <div>
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={handleAddTimeSlot}
                    disabled={timeSlots.length >= 3}
                    style={{ marginBottom: 12 }}
                  >
                    Thêm thời gian
                  </Button>

                  {timeSlots.length === 0 ? (
                    <Text type="secondary">Chưa có slot thời gian nào</Text>
                  ) : (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {timeSlots.map((slot, index) => (
                        <div
                          key={slot.id}
                          style={{
                            border: '1px solid #d9d9d9',
                            borderRadius: 8,
                            padding: '10px 12px',
                            background: '#fafafa',
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: 8 }}>Slot {index + 1}</div>
                          {editingSlotId === slot.id || !slot.value ? (
                            <Space align="start" style={{ width: '100%' }}>
                              <DatePicker
                                showTime
                                format="DD/MM/YYYY HH:mm"
                                placeholder="Chọn ngày và giờ"
                                value={slot.value}
                                onChange={(value) => handleTimeSlotChange(slot.id, value)}
                                disabledDate={(current) => current && current < dayjs().startOf('day')}
                                style={{ width: '100%' }}
                              />
                              {slot.value && (
                                <Button size="small" onClick={() => setEditingSlotId(null)}>
                                  Hủy
                                </Button>
                              )}
                            </Space>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                              <Text>{dayjs(slot.value).format('DD/MM/YYYY HH:mm')}</Text>
                              <Space>
                                <Button size="small" onClick={() => handleEditTimeSlot(slot.id)}>
                                  Sửa
                                </Button>
                                <Button size="small" danger onClick={() => handleRemoveTimeSlot(slot.id)}>
                                  Xóa
                                </Button>
                              </Space>
                            </div>
                          )}
                        </div>
                      ))}
                    </Space>
                  )}
                </div>
              </Form.Item>

              <Form.Item
                name="interviewerIds"
                label="Người phỏng vấn"
                rules={[{ required: false, message: 'Vui lòng chọn người phỏng vấn' }]}
              >
                <Select
                  mode="multiple"
                  placeholder="Chọn người phỏng vấn"
                  showSearch
                  optionFilterProp="children"
                >
                  {interviewers.map(interviewer => (
                    <Select.Option key={interviewer.id} value={interviewer.id}>
                      {interviewer.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={handleCancel}>Hủy</Button>
                  <Button type="primary" htmlType="submit" loading={submitting}>
                    Tạo lịch
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Col>
        </Row>
      </Modal>

      {/* Modal Reschedule */}
      <Modal
        title="Đổi lịch phỏng vấn"
        open={isRescheduleModalOpen}
        onCancel={() => {
          setIsRescheduleModalOpen(false);
          setEditingSchedule(null);
          setRescheduleDate(null);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setIsRescheduleModalOpen(false);
              setEditingSchedule(null);
              setRescheduleDate(null);
            }}
          >
            Hủy
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={submitting}
            onClick={handleReschedule}
          >
            Xác nhận đổi lịch
          </Button>,
        ]}
      >
        {editingSchedule && (
          <div>
            <p><strong>Ứng viên:</strong> {editingSchedule.candidate}</p>
            <p><strong>Lịch cũ:</strong> {editingSchedule.scheduledAt ? dayjs(editingSchedule.scheduledAt).format('DD/MM/YYYY - HH:mm') : 'N/A'}</p>
            <Divider />
            <Form.Item label="Chọn ngày giờ mới" required>
              <DatePicker
                showTime
                format="DD/MM/YYYY HH:mm"
                placeholder="Chọn ngày và giờ mới"
                value={rescheduleDate}
                onChange={setRescheduleDate}
                disabledDate={(current) => current && current < dayjs().startOf('day')}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InterviewSchedule;
