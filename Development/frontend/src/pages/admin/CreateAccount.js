import React, { useState } from 'react';
import { Card, Form, Input, Select, Button, Row, Col, Divider, message } from 'antd';
import { ArrowLeftOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './SubAccountManagement.css';
import './CreateAccount.css';

const { Option } = Select;

const CreateAccount = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      console.log('Form values:', values);
      message.success('Account created successfully');
      navigate('/admin/sub-accounts');
    } catch (error) {
      message.error('Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { value: 'admin', label: 'Admin' },
    { value: 'recruiter', label: 'Recruiter' },
    { value: 'interviewer', label: 'Interviewer' },
  ];

  const departments = [
    { value: 'hr', label: 'Human Resources' },
    { value: 'tech', label: 'Technology' },
    { value: 'sales', label: 'Sales' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'finance', label: 'Finance' },
  ];

  return (
    <div className="create-account-page">
      <Button 
        className="back-btn"
        onClick={() => navigate('/admin/sub-accounts')} 
        icon={<ArrowLeftOutlined />}
      >
        Back
      </Button>

      <Card className="main-card" bordered={false}>
        <h2 className="page-title">Create Account</h2>
        <p className="page-subtitle">Create a new user account for the system</p>

        <Divider />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="create-account-form"
        >
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="accountName"
                label="Account Name"
                rules={[{ required: true, message: 'Please enter account name' }]}
              >
                <Input placeholder="Enter account name" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="accountEmail"
                label="Account Email"
                rules={[
                  { required: true, message: 'Please enter email' },
                  { type: 'email', message: 'Please enter a valid email' }
                ]}
              >
                <Input placeholder="Enter email address" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="password"
                label="Password"
                rules={[
                  { required: true, message: 'Please enter password' },
                  { min: 6, message: 'Password must be at least 6 characters' }
                ]}
              >
                <Input.Password 
                  placeholder="Enter password"
                  iconRender={(visible) => (
                    visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
                  )}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="role"
                label="Role"
                rules={[{ required: true, message: 'Please select role' }]}
              >
                <Select placeholder="Select role">
                  {roles.map((role) => (
                    <Option key={role.value} value={role.value}>
                      {role.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="department"
                label="Department"
                rules={[{ required: true, message: 'Please select department' }]}
              >
                <Select placeholder="Select department">
                  {departments.map((dept) => (
                    <Option key={dept.value} value={dept.value}>
                      {dept.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="status"
                label="Status"
                initialValue="active"
              >
                <Select>
                  <Option value="active">Active</Option>
                  <Option value="inactive">Inactive</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Row justify="end" gutter={12}>
            <Col>
              <Button onClick={() => navigate('/admin/sub-accounts')}>
                Cancel
              </Button>
            </Col>
            <Col>
              <Button type="primary" htmlType="submit" loading={loading}>
                Create Account
              </Button>
            </Col>
          </Row>
        </Form>
      </Card>
    </div>
  );
};

export default CreateAccount;
