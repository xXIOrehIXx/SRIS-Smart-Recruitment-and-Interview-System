import React from 'react';
import { Typography, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const TakeQuiz = () => {
  const navigate = useNavigate();
  return (
    <div className="take-quiz-page">
      <Button onClick={() => navigate('/quiz')} icon={<ArrowLeftOutlined />}>Back</Button>
      <Title level={4}>Take Quiz</Title>
      <Text>Quiz taking interface</Text>
    </div>
  );
};

export default TakeQuiz;
