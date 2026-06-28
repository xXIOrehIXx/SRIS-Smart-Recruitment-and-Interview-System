import React from 'react';
import { Typography, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const QuizDetail = () => {
  const navigate = useNavigate();
  return (
    <div className="quiz-detail-page">
      <Button onClick={() => navigate('/quiz')} icon={<ArrowLeftOutlined />}>Back</Button>
      <Title level={4}>Quiz Detail</Title>
      <Text>Quiz details and question management</Text>
    </div>
  );
};

export default QuizDetail;
