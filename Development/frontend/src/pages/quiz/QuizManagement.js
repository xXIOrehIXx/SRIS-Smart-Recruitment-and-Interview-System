import React from 'react';
import { Card, Table, Tag, Button, Typography, Input, Select, Progress } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined, QuestionOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import '../Dashboard.css';

const { Title, Text } = Typography;

const QuizManagement = () => {
  const navigate = useNavigate();

  const quizzes = [
    { id: 1, title: 'JavaScript Fundamentals', questions: 20, duration: 30, status: 'active', attempts: 45, avgScore: 78 },
    { id: 2, title: 'React & Redux', questions: 25, duration: 45, status: 'active', attempts: 32, avgScore: 82 },
    { id: 3, title: 'Node.js Basics', questions: 15, duration: 20, status: 'draft', attempts: 0, avgScore: 0 },
    { id: 4, title: 'SQL & Databases', questions: 30, duration: 40, status: 'active', attempts: 28, avgScore: 75 },
  ];

  const columns = [
    {
      title: 'Quiz',
      dataIndex: 'title',
      key: 'title',
      render: (text) => (
        <div className="quiz-cell">
          <QuestionOutlined style={{ color: '#5D8C3E', fontSize: 20 }} />
          <span style={{ fontWeight: 600 }}>{text}</span>
        </div>
      ),
    },
    { title: 'Questions', dataIndex: 'questions', key: 'questions' },
    { title: 'Duration', dataIndex: 'duration', key: 'duration', render: (min) => `${min} min` },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'success' : 'default'}>
          {status === 'active' ? 'Active' : 'Draft'}
        </Tag>
      ),
    },
    {
      title: 'Avg Score',
      dataIndex: 'avgScore',
      key: 'avgScore',
      render: (score) => score > 0 ? <Progress percent={score} size="small" strokeColor="#5D8C3E" /> : 'N/A',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div className="action-buttons">
          <Button type="text" icon={<EyeOutlined />} onClick={() => navigate(`/quiz/${record.id}`)} />
          <Button type="text" icon={<EditOutlined />} />
          <Button type="text" danger icon={<DeleteOutlined />} />
        </div>
      ),
    },
  ];

  return (
    <div className="quiz-management-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Quiz Management</Title>
          <Text type="secondary">Create and manage assessment quizzes</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/quiz/create')}>
          Create Quiz
        </Button>
      </div>

      <Card className="main-card" bordered={false}>
        <div className="toolbar">
          <Input placeholder="Search quizzes..." prefix={<SearchOutlined />} className="search-input" />
          <Select placeholder="Filter by status" style={{ width: 150 }}>
            <Select.Option value="all">All</Select.Option>
            <Select.Option value="active">Active</Select.Option>
            <Select.Option value="draft">Draft</Select.Option>
          </Select>
        </div>
        <Table columns={columns} dataSource={quizzes} rowKey="id" />
      </Card>
    </div>
  );
};

export default QuizManagement;
