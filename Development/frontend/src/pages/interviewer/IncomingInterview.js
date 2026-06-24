import React from 'react';
import { Card, Table, Tag, Avatar, Button, Typography, Space, Input, Select } from 'antd';
import { VideoCameraOutlined, SearchOutlined } from '@ant-design/icons';
import '../Dashboard.css';

const { Title, Text } = Typography;

const IncomingInterview = () => {
  const interviews = [
    { id: 1, candidate: 'Alex Morgan', position: 'Frontend Developer', date: '2026-06-24', time: '2:00 PM', type: 'Technical', status: 'upcoming' },
    { id: 2, candidate: 'Jane Doe', position: 'Product Manager', date: '2026-06-25', time: '10:00 AM', type: 'HR', status: 'upcoming' },
    { id: 3, candidate: 'John Smith', position: 'UX Designer', date: '2026-06-26', time: '3:00 PM', type: 'Culture', status: 'upcoming' },
    { id: 4, candidate: 'Emily Chen', position: 'Backend Engineer', date: '2026-06-27', time: '11:00 AM', type: 'Technical', status: 'pending' },
  ];

  const columns = [
    {
      title: 'Candidate',
      dataIndex: 'candidate',
      key: 'candidate',
      render: (text, record) => (
        <div className="candidate-cell">
          <Avatar style={{ backgroundColor: '#5D8C3E' }}>{text[0]}</Avatar>
          <div>
            <span className="candidate-name">{text}</span>
            <span className="candidate-position">{record.position}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Date & Time',
      key: 'datetime',
      render: (_, record) => (
        <div className="datetime-cell">
          <span>{record.date}</span>
          <span>{record.time}</span>
        </div>
      ),
    },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (type) => <Tag color="blue">{type}</Tag> },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color={status === 'upcoming' ? 'success' : 'warning'}>{status}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: () => (
        <Space>
          <Button type="primary" icon={<VideoCameraOutlined />} className="join-btn">Join</Button>
          <Button>Reschedule</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="interviewer-dashboard">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Incoming Interviews</Title>
          <Text type="secondary">Your scheduled interviews</Text>
        </div>
      </div>

      <Card className="main-card" bordered={false}>
        <div className="toolbar">
          <Input placeholder="Search..." prefix={<SearchOutlined />} className="search-input" />
          <Select placeholder="Filter by type" style={{ width: 150 }}>
            <Select.Option value="all">All Types</Select.Option>
            <Select.Option value="technical">Technical</Select.Option>
            <Select.Option value="hr">HR</Select.Option>
            <Select.Option value="culture">Culture</Select.Option>
          </Select>
        </div>
        <Table columns={columns} dataSource={interviews} rowKey="id" />
      </Card>
    </div>
  );
};

export default IncomingInterview;
