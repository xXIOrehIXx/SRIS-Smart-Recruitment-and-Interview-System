import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, Tag, Avatar, Space, Modal, Form, DatePicker, Select, Input, message, Row, Col, Descriptions, Empty, Badge, Popconfirm, Divider } from 'antd';
import { PlusOutlined, CalendarOutlined, VideoCameraOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useParams, useSearchParams } from 'react-router-dom';
import { interviewAPI, jobsAPI, applicationAPI, usersAPI } from '../../services/api';
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
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [candidateDetails, setCandidateDetails] = useState({});
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
    fetchJobs();
  }, [appId]);

  useEffect(() => {
    fetchInterviewers();
  }, [selectedJob]);

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
    try {
      let interviewerList = [];
      
      // Thử 1: Lấy từ interview pools (job cụ thể)
      if (selectedJob) {
        try {
          const poolResponse = await interviewAPI.getInterviewPools(selectedJob);
          if (poolResponse?.data?.interviewers) {
            interviewerList = poolResponse.data.interviewers;
          } else if (Array.isArray(poolResponse?.data)) {
            interviewerList = poolResponse.data;
          }
        } catch (e) {
          console.log('Interview pools not available for this job');
        }
      }
      
      // Thử 2: Lấy users từ API và lọc theo role = "Interviewer"
      if (interviewerList.length === 0) {
        try {
          const usersResponse = await usersAPI.getAll();
          const allUsers = usersResponse?.data || [];
          console.log('All users from API:', allUsers);
          
          // Lọc theo role
          interviewerList = allUsers.filter(u => {
            const role = u.role || u.jobRole || '';
            return role.toLowerCase() === 'interviewer';
          });
          console.log('Filtered interviewers:', interviewerList);
          
          // Nếu không có ai có role interviewer, dùng tất cả
          if (interviewerList.length === 0) {
            interviewerList = allUsers;
          }
        } catch (e) {
          console.log('Users API not available:', e);
        }
      }
      
      setInterviewers(interviewerList.map((i, idx) => ({
        id: i.userId || i.id || idx + 1,
        name: i.fullName || i.name || i.userName || i.email || `Interviewer ${idx + 1}`,
        email: i.email || ''
      })));
      console.log('Final interviewers state:', interviewerList);
    } catch (error) {
      console.error('Error fetching interviewers:', error);
      setInterviewers([]);
    }
  };

  const fetchCandidates = async (jobId) => {
    if (!jobId) {
      setCandidates([]);
      setSelectedCandidates([]);
      setCandidateDetails({});
      form.setFieldsValue({ applicationIds: undefined });
      return;
    }

    try {
      const response = await applicationAPI.getAll(jobId);
      console.log('Raw response from getAll:', response);
      console.log('response.data:', response?.data);
      
      // Xử lý nhiều cấu trúc response khác nhau
      let applications = [];
      if (Array.isArray(response?.data)) {
        applications = response.data;
      } else if (response?.data?.items) {
        applications = response.data.items;
      } else if (response?.data?.applications) {
        applications = response.data.applications;
      } else if (response?.data?.data && Array.isArray(response.data.data)) {
        applications = response.data.data;
      }
      
      console.log('Applications found:', applications);
      
      const mappedCandidates = applications.map((item) => ({
        applicationId: item.applicationId || item.id,
        candidateId: item.candidateId,
        name: item.candidateName || item.name || 'N/A',
        email: item.candidateEmail || item.email || '',
        position: item.position || item.jobTitle || 'Chưa cập nhật',
        cvUrl: item.cvId ? `/cv/${item.cvId}` : null,
        appliedAt: item.appliedAt || item.createdAt,
        currentState: item.currentState || item.state,
        aiMatchScore: item.aiMatchScore,
        criteriaScore: item.criteriaScore,
      }));

      console.log('Mapped candidates:', mappedCandidates);
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
    setSelectedCandidates([]);
    setCandidateDetails({});
    form.setFieldsValue({ applicationIds: undefined });
    // Fetch candidates với jobId đã chọn
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

  const handleCandidatesChange = async (values) => {
    console.log('handleCandidatesChange called with values:', values);
    console.log('Available candidates:', candidates);
    
    setSelectedCandidates(values || []);

    if (values && values.length > 0) {
      const details = {};
      values.forEach(appId => {
        const candidate = candidates.find(c => String(c.applicationId || c.id) === String(appId));
        if (candidate) {
          details[appId] = {
            applicationId: candidate.applicationId || candidate.id,
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
          };
        }
      });
      console.log('Mapped candidate details:', details);
      setCandidateDetails(details);
    } else {
      setCandidateDetails({});
    }
  };

  const handleCreateSchedule = async (values) => {
    const selectedApplicationIds = values?.applicationIds || Object.keys(candidateDetails);
    const interviewerIds = values?.interviewerIds || [];

    if (!selectedApplicationIds || selectedApplicationIds.length === 0) {
      message.error('Vui lòng chọn ít nhất một ứng viên');
      return;
    }

    if (!timeSlots.length || timeSlots.some((slot) => !slot.value)) {
      message.error('Vui lòng chọn ít nhất một thời gian phỏng vấn');
      return;
    }

    setSubmitting(true);
    try {
      // Tạo lịch cho từng ứng viên
      for (const appId of selectedApplicationIds) {
        for (const interviewerId of interviewerIds) {
          const payload = {
            RoundNumber: 0,
            Slots: timeSlots.map((slot) => ({
              InterviewerId: interviewerId,
              StartTime: slot.value?.toISOString?.() || dayjs(slot.value).toISOString(),
            })),
          };

          await interviewAPI.createSchedule(appId, payload);
        }
      }
      
      message.success(`Tạo lịch phỏng vấn thành công cho ${selectedApplicationIds.length} ứng viên!`);
      handleCancel();
      if (selectedApplicationIds.length > 0) {
        fetchInterviews(selectedApplicationIds[0]);
      }
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
    setSelectedCandidates([]);
    setCandidateDetails({});
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
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateSchedule}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="Tin tuyển dụng"
                rules={[{ required: true, message: 'Vui lòng chọn tin tuyển dụng' }]}
              >
                <Select
                  placeholder="Chọn tin tuyển dụng"
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

              {selectedJobDetail && (
                <Card title="Thông tin Job" size="small" style={{ marginBottom: 16 }}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Job">{selectedJobDetail.title || 'Chưa cập nhật'}</Descriptions.Item>
                    <Descriptions.Item label="Mô tả">{selectedJobDetail.jdText || 'Chưa cập nhật'}</Descriptions.Item>
                    <Descriptions.Item label="Vị trí">{selectedJobDetail.location || 'Chưa cập nhật'}</Descriptions.Item>
                    <Descriptions.Item label="Phòng ban">{selectedJobDetail.department || 'Chưa cập nhật'}</Descriptions.Item>
                    <Descriptions.Item label="Loại hình">{selectedJobDetail.employmentType || 'Chưa cập nhật'}</Descriptions.Item>
                  </Descriptions>
                </Card>
              )}
            </Col>

            <Col span={12}>
              <Form.Item
                name="applicationIds"
                label="Chọn ứng viên"
                rules={[{ required: true, message: 'Vui lòng chọn ít nhất một ứng viên' }]}
              >
                <Select
                  mode="multiple"
                  placeholder={selectedJob ? "Chọn ứng viên" : "Chọn tin tuyển dụng trước"}
                  showSearch
                  optionFilterProp="children"
                  onChange={handleCandidatesChange}
                  notFoundContent={candidates.length === 0 && selectedJob ? <Text type="secondary">Không có ứng viên</Text> : null}
                  maxTagCount={3}
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

              {Object.keys(candidateDetails).length > 0 && (
                <Card title={`Thông tin ứng viên (${Object.keys(candidateDetails).length})`} size="small" style={{ marginBottom: 16, maxHeight: 200, overflow: 'auto' }}>
                  {Object.values(candidateDetails).map((detail, idx) => (
                    <div key={detail.applicationId} style={{ marginBottom: idx < Object.keys(candidateDetails).length - 1 ? 8 : 0, paddingBottom: idx < Object.keys(candidateDetails).length - 1 ? 8 : 0, borderBottom: idx < Object.keys(candidateDetails).length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                      <Text strong>{detail.name}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>{detail.email || 'N/A'}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>Trạng thái: {detail.currentState || 'N/A'}</Text>
                    </div>
                  ))}
                </Card>
              )}

              <Form.Item
                name="timeSlots"
                label="Thời gian phỏng vấn"
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
                                  Xong
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
                      {interviewer.name} {interviewer.email ? `- ${interviewer.email}` : ''}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCancel}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                Tạo lịch
              </Button>
            </Space>
          </Form.Item>
        </Form>
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
