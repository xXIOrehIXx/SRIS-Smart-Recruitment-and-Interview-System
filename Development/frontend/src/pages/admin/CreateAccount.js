import React from 'react';
import { Card, Typography, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './SubAccountManagement.css';

const { Title, Text } = Typography;

const CreateAccount = () => {
  const navigate = useNavigate();

  return (
    <div className="create-account-page">
      <Button onClick={() => navigate('/admin/sub-accounts')} icon={<ArrowLeftOutlined />}>
        Back
      </Button>
      <Card className="main-card" bordered={false}>
        <Title level={4}>Create New Account</Title>
        <Text type="secondary">This page allows creating new user accounts. Form implementation pending.</Text>
        <div style={{ marginTop: 24 }}>
          <p>Form fields: Name, Email, Password, Role, Department</p>
        </div>
      </Card>
    </div>
  );
};

export default CreateAccount;
