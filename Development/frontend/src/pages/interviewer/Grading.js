import React, { useState } from 'react';
import { Row, Col, Card, Typography, Button, Input, Slider, message } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import '../Dashboard.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

const Grading = () => {
  const navigate = useNavigate();
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(false);

  const criteria = [
    { id: 'technical', name: 'Technical Skills', maxScore: 10 },
    { id: 'communication', name: 'Communication', maxScore: 10 },
    { id: 'problem', name: 'Problem Solving', maxScore: 10 },
    { id: 'culture', name: 'Culture Fit', maxScore: 10 },
    { id: 'experience', name: 'Experience', maxScore: 10 },
  ];

  const handleScoreChange = (id, value) => {
    setScores({ ...scores, [id]: value });
  };

  const calculateTotal = () => {
    const total = Object.values(scores).reduce((sum, score) => sum + (score || 0), 0);
    return total;
  };

  const handleSave = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    message.success('Grades saved successfully');
    setLoading(false);
    navigate('/interviewer/dashboard');
  };

  return (
    <div className="grading-page">
      <Button onClick={() => navigate('/interviewer/dashboard')} icon={<ArrowLeftOutlined />} className="back-btn">
        Back
      </Button>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card className="main-card" bordered={false}>
            <div className="grading-header">
              <div>
                <Title level={4}>Interview Evaluation</Title>
                <Text type="secondary">Alex Morgan - Senior Frontend Developer</Text>
              </div>
              <div className="total-score">
                <Text type="secondary">Total Score</Text>
                <span className="score-value">{calculateTotal()}/{criteria.length * 10}</span>
              </div>
            </div>

            <div className="criteria-list">
              {criteria.map((item) => (
                <div key={item.id} className="criteria-item">
                  <div className="criteria-header">
                    <span className="criteria-name">{item.name}</span>
                    <span className="criteria-score">{scores[item.id] || 0}/{item.maxScore}</span>
                  </div>
                  <Slider
                    min={0}
                    max={item.maxScore}
                    value={scores[item.id] || 0}
                    onChange={(value) => handleScoreChange(item.id, value)}
                    marks={{ 0: '0', 5: '5', 10: '10' }}
                    className="score-slider"
                  />
                </div>
              ))}
            </div>

            <div className="feedback-section">
              <Title level={5}>Overall Feedback</Title>
              <TextArea rows={6} placeholder="Enter your detailed feedback about the candidate..." />
            </div>

            <div className="recommendation">
              <Title level={5}>Recommendation</Title>
              <div className="recommendation-options">
                {['Strong Hire', 'Hire', 'No Hire', 'Strong No Hire'].map((option) => {
                  const className = option.toLowerCase().replace(/ /g, '-');
                  return (
                    <Button key={option} className={`recommend-btn ${className}`}>
                      {option}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="grading-actions">
              <Button icon={<SaveOutlined />} onClick={handleSave} loading={loading}>
                Save Draft
              </Button>
              <Button type="primary" icon={<SendOutlined />} onClick={handleSave} loading={loading} className="submit-btn">
                Submit Evaluation
              </Button>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="sidebar-card" bordered={false}>
            <Title level={5}>Interview Details</Title>
            <div className="interview-info">
              <div className="info-row">
                <Text type="secondary">Date:</Text>
                <span>June 24, 2026</span>
              </div>
              <div className="info-row">
                <Text type="secondary">Time:</Text>
                <span>2:00 PM</span>
              </div>
              <div className="info-row">
                <Text type="secondary">Type:</Text>
                <span>Technical Interview</span>
              </div>
              <div className="info-row">
                <Text type="secondary">Duration:</Text>
                <span>60 minutes</span>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Grading;
