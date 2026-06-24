import React from 'react';
import { Card, Typography, Button, Table, Tag, Avatar, Space } from 'antd';
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import '../Dashboard.css';

const { Title, Text } = Typography;

const OfferManagement = () => {
  const offers = [
    { id: 1, candidate: 'John Connor', position: 'Frontend Developer', salary: '$3,000', status: 'pending', sentDate: '2026-06-20', responseDeadline: '2026-06-27' },
    { id: 2, candidate: 'Sarah Wilson', position: 'Product Manager', salary: '$4,500', status: 'accepted', sentDate: '2026-06-15', responseDeadline: '2026-06-22' },
    { id: 3, candidate: 'Mike Brown', position: 'Backend Engineer', salary: '$3,500', status: 'declined', sentDate: '2026-06-10', responseDeadline: '2026-06-17' },
  ];

  const getStatusTag = (status) => {
    const colors = { pending: 'warning', accepted: 'success', declined: 'error' };
    const icons = { pending: null, accepted: <CheckCircleOutlined />, declined: <CloseCircleOutlined /> };
    return <Tag color={colors[status]} icon={icons[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Tag>;
  };

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
    { title: 'Salary', dataIndex: 'salary', key: 'salary', render: (salary) => <span style={{ color: '#5D8C3E', fontWeight: 600 }}>{salary}</span> },
    { title: 'Sent Date', dataIndex: 'sentDate', key: 'sentDate' },
    { title: 'Deadline', dataIndex: 'responseDeadline', key: 'responseDeadline' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status) => getStatusTag(status) },
    {
      title: 'Actions',
      key: 'actions',
      render: () => (
        <Space>
          <Button icon={<FileTextOutlined />}>View</Button>
          <Button type="primary">Send Reminder</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="offer-management-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Offer Management</Title>
          <Text type="secondary">Track and manage candidate offers</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />}>
          Create Offer
        </Button>
      </div>

      <Card className="main-card" bordered={false}>
        <Table columns={columns} dataSource={offers} rowKey="id" />
      </Card>
    </div>
  );
};

export default OfferManagement;
