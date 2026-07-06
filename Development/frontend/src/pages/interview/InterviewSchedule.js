import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, Tag, Avatar, Space, Modal, Form, DatePicker, Select, message, Row, Col, Descriptions, Empty } from 'antd';
import { PlusOutlined, CalendarOutlined, VideoCameraOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useParams, useSearchParams } from 'react-router-dom';
import { interviewAPI } from '../../services/api';
import '../Dashboard.css';

const { Title, Text } = Typography;

const InterviewSchedule = () => {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [interviewers, setInterviewers] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateDetail, setCandidateDetail] = useState(null);
  
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
    fetchCandidates();
  }, [appId]);

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

  const fetchCandidates = async () => {
    // Mock candidates
    setCandidates([
      { applicationId: 1, name: 'Alex Morgan', position: 'Frontend Developer', cvUrl: '/cv/alex.pdf', appliedAt: '2026-06-20' },
      { applicationId: 2, name: 'Jane Doe', position: 'Product Manager', cvUrl: '/cv/jane.pdf', appliedAt: '2026-06-21' },
      { applicationId: 3, name: 'John Smith', position: 'UX Designer', cvUrl: '/cv/john.pdf', appliedAt: '2026-06-22' },
    ]);
  };

  const handleCandidateChange = async (value) => {
    const candidate = candidates.find(c => c.applicationId === value);
    setSelectedCandidate(value);
    
    // Mock candidate detail
    setCandidateDetail({
      applicationId: value,
      name: candidate?.name,
      position: candidate?.position,
      cvUrl: candidate?.cvUrl,
      appliedAt: candidate?.appliedAt,
      skills: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
      experience: '3 năm',
      education: 'ĐH Bách Khoa HN',
    });
  };

  const handleCreateSchedule = async (values) => {
    if (!appId) {
      message.error('Không tìm thấy thông tin ứng viên');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        scheduledAt: values.scheduledAt.format('YYYY-MM-DDTHH:mm:ss'),
        interviewerIds: values.interviewerIds,
      };

      await interviewAPI.createSchedule(appId, payload);
      message.success('Tạo lịch phỏng vấn thành công!');
      setIsModalOpen(false);
      form.resetFields();
      setSelectedCandidate(null);
      setCandidateDetail(null);
      fetchInterviews(appId);
    } catch (error) {
      console.error('Error creating schedule:', error);
      message.error('Tạo lịch phỏng vấn thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const showModal = () => {
    if (!appId) {
      message.warning('Vui lòng chọn ứng viên trước khi tạo lịch phỏng vấn');
      return;
    }
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
    setSelectedCandidate(null);
    setCandidateDetail(null);
  };

  const columns = [
    {
      title: 'Candidate',
      dataIndex: 'candidate',
      key: 'candidate',
      render: (text) => (
        <div className="candidate-cell">
          <Avatar style={{ backgroundColor: '#5D8C3E' }}>{text ? text[0] : '?'}</Avatar>
          <span style={{ fontWeight: 600 }}>{text || 'N/A'}</span>
        </div>
      ),
    },
    { title: 'Position', dataIndex: 'position', key: 'position' },
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
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.meetingLink && (
            <Button type="primary" icon={<VideoCameraOutlined />} href={record.meetingLink} target="_blank">
              Join
            </Button>
          )}
          <Button>Reschedule</Button>
        </Space>
      ),
    },
  ];

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
          <Table 
            columns={columns} 
            dataSource={interviews} 
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
            <Card title="Thông tin Job" size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Job">Frontend Developer</Descriptions.Item>
                <Descriptions.Item label="Location">Hà Nội</Descriptions.Item>
                <Descriptions.Item label="Salary">$1000 - $1500</Descriptions.Item>
              </Descriptions>
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
                      {candidate.name} - {candidate.position}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {candidateDetail && (
                <Card title="Thông tin ứng viên" size="small" style={{ marginBottom: 16 }}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Tên">{candidateDetail.name}</Descriptions.Item>
                    <Descriptions.Item label="Vị trí">{candidateDetail.position}</Descriptions.Item>
                    <Descriptions.Item label="Kinh nghiệm">{candidateDetail.experience}</Descriptions.Item>
                    <Descriptions.Item label="Học vấn">{candidateDetail.education}</Descriptions.Item>
                    <Descriptions.Item label="Kỹ năng">
                      {candidateDetail.skills.map((skill, idx) => (
                        <Tag key={idx} style={{ marginBottom: 4 }}>{skill}</Tag>
                      ))}
                    </Descriptions.Item>
                    <Descriptions.Item label="CV">
                      <a href={candidateDetail.cvUrl} target="_blank" rel="noopener noreferrer">Xem CV</a>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              )}

              <Form.Item
                name="scheduledAt"
                label="Thời gian"
                rules={[{ required: true, message: 'Vui lòng chọn thời gian phỏng vấn' }]}
              >
                <DatePicker
                  showTime
                  format="DD/MM/YYYY HH:mm"
                  placeholder="Chọn ngày và giờ"
                  style={{ width: '100%' }}
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>

              <Form.Item
                name="interviewerIds"
                label="Người phỏng vấn"
                rules={[{ required: true, message: 'Vui lòng chọn người phỏng vấn' }]}
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
    </div>
  );
};

export default InterviewSchedule;
