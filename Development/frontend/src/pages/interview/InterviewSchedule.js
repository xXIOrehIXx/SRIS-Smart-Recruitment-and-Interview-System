import React from 'react';
import { Card, Typography, Button, Table, Tag, Avatar, Space } from 'antd';
import { PlusOutlined, CalendarOutlined, VideoCameraOutlined } from '@ant-design/icons';
import '../Dashboard.css';

const { Title, Text } = Typography;

const InterviewSchedule = () => {
  const interviews = [
    { id: 1, candidate: 'Alex Morgan', position: 'Frontend Developer', date: '2026-06-24', time: '2:00 PM', interviewers: ['Nguyen Van A'], status: 'scheduled' },
    { id: 2, candidate: 'Jane Doe', position: 'Product Manager', date: '2026-06-25', time: '10:00 AM', interviewers: ['Tran Thi B'], status: 'scheduled' },
    { id: 3, candidate: 'John Smith', position: 'UX Designer', date: '2026-06-26', time: '3:00 PM', interviewers: ['Nguyen Van A', 'Tran Thi B'], status: 'scheduled' },
  ];

  const columns = [
    {
      title: 'Candidate',
      dataIndex: 'candidate',
      key: 'candidate',
      render: (text) => (
        <div className="candidate-cell">
          <Avatar style={{ backgroundColor: '#5D8C3E' }}>{text[0]}</Avatar>
          <span style={{ fontWeight: 600 }}>{text}</span>
        </div>
      ),
    },
    { title: 'Position', dataIndex: 'position', key: 'position' },
    {
      title: 'Date & Time',
      key: 'datetime',
      render: (_, record) => (
        <span><CalendarOutlined /> {record.date} - {record.time}</span>
      ),
    },
    {
      title: 'Interviewers',
      dataIndex: 'interviewers',
      key: 'interviewers',
      render: (interviewers) => interviewers.map((i, idx) => <Tag key={idx}>{i}</Tag>),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: () => <Tag color="blue">Scheduled</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: () => (
        <Space>
          <Button type="primary" icon={<VideoCameraOutlined />}>Join</Button>
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
        <Button type="primary" icon={<PlusOutlined />}>
          Schedule Interview
        </Button>
      </div>

      <Card className="main-card" bordered={false}>
        <Table columns={columns} dataSource={interviews} rowKey="id" />
      </Card>
    </div>
  );
};

export default InterviewSchedule;
