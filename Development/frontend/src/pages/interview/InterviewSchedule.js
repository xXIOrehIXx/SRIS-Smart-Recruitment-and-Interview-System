import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, Tag, Avatar, Space, Modal, Form, DatePicker, Select, message, Alert } from 'antd';
import { PlusOutlined, CalendarOutlined, VideoCameraOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useParams, useSearchParams } from 'react-router-dom';
import { interviewAPI } from '../../services/api';
import '../Dashboard.css';

const { Title, Text } = Typography;

// Mock interviewers data - thay bằng API khi backend có endpoint
const MOCK_INTERVIEWERS = [
  { id: 1, name: 'Nguyễn Văn A', email: 'nguyenvana@company.com' },
  { id: 2, name: 'Trần Thị B', email: 'tranthib@company.com' },
  { id: 3, name: 'Lê Văn C', email: 'levanc@company.com' },
  { id: 4, name: 'Phạm Thị D', email: 'phamthid@company.com' },
];

const InterviewSchedule = () => {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [interviewers] = useState(MOCK_INTERVIEWERS);
  
  const { applicationId } = useParams();
  const [searchParams] = useSearchParams();
  const appId = applicationId || searchParams.get('applicationId');

  useEffect(() => {
    if (appId) {
      fetchInterviews(appId);
    } else {
      setLoading(false);
    }
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
        <Alert
          message="Chưa chọn ứng viên"
          description="Vui lòng chọn ứng viên từ trang chi tiết ứng viên để xem và tạo lịch phỏng vấn."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card className="main-card" bordered={false}>
        <Table 
          columns={columns} 
          dataSource={interviews} 
          rowKey="id" 
          loading={loading}
          locale={{ emptyText: 'Chưa có lịch phỏng vấn nào' }}
        />
      </Card>

      <Modal
        title="Tạo lịch phỏng vấn"
        open={isModalOpen}
        onCancel={handleCancel}
        footer={null}
        width={500}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateSchedule}
        >
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
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {interviewers.map(interviewer => (
                <Select.Option 
                  key={interviewer.id} 
                  value={interviewer.id}
                  label={interviewer.name}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{interviewer.name}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{interviewer.email}</div>
                  </div>
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
      </Modal>
    </div>
  );
};

export default InterviewSchedule;
