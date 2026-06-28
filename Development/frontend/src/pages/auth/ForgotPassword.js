import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Form, Input, Button, Alert, Result } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import './css/Auth.css';

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const onFinish = async (values) => {
    setLoading(true);
    setError('');
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccess(true);
    } catch (err) {
      setError('Đã có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page forgot-password-page">
        <Result
          status="success"
          title="Check your email!"
          description="We have sent a password reset link to your email address. Please check your inbox and follow the instructions."
          extra={[
            <Link to="/login" key="login">
              <Button type="primary" className="auth-submit-btn" block>
                Back to Sign in
              </Button>
            </Link>,
            <Button 
              key="resend" 
              type="link" 
              onClick={() => setSuccess(false)}
              className="resend-btn"
            >
              Didn't receive the email? Resend
            </Button>
          ]}
        />
      </div>
    );
  }

  return (
    <div className="auth-page forgot-password-page">
      <div className="auth-header">
        <h2>Forgot password?</h2>
        <p>Enter your email and we'll send you a link to reset your password</p>
      </div>

      {error && (
        <Alert 
          message={error} 
          type="error" 
          showIcon 
          className="auth-alert"
        />
      )}

      <Form
        name="forgotPassword"
        onFinish={onFinish}
        layout="vertical"
        size="large"
      >
        <Form.Item
          name="email"
          rules={[
            { required: true, message: 'Please input your email!' },
            { type: 'email', message: 'Please enter a valid email!' }
          ]}
        >
          <Input 
            prefix={<MailOutlined style={{ color: '#8c8c8b' }} />}
            placeholder="Email address"
            className="auth-input"
          />
        </Form.Item>

        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={loading}
            block
            className="auth-submit-btn"
          >
            Send reset link
          </Button>
        </Form.Item>
      </Form>

      <p className="auth-footer-text">
        Remember your password? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
};

export default ForgotPassword;
