import React from 'react';
import { Typography, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const CreateQuiz = () => {
  const navigate = useNavigate();
  return (
    <div className="create-quiz-page">
      <Button onClick={() => navigate('/quiz')} icon={<ArrowLeftOutlined />}>Back</Button>
      <Title level={4}>Create Quiz</Title>
      <Text>Quiz creation form</Text>
    </div>
  );
};

export default CreateQuiz;
