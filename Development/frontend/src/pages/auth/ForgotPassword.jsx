import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Form, Input, Button, Alert, Result } from "antd";
import {
  MailOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { authAPI } from "../../services/api";
import "./css/Auth.css";

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const handleSendResetLink = async (values) => {
    setLoading(true);
    setError("");

    try {
      await authAPI.forgotPassword(values.email);
      setEmail(values.email);
      setStep(2);
      form.resetFields();
    } catch (err) {
      console.error("Forgot password error:", err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError("Không thể gửi yêu cầu. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      setError("Mật khẩu mới không khớp");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await authAPI.resetPassword(values.token, values.newPassword);
      setSuccess(true);
    } catch (err) {
      console.error("Reset password error:", err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError("Không thể đổi mật khẩu. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    setStep(1);
    setError("");
    form.resetFields();
  };

  if (success) {
    return (
      <div className="auth-page forgot-password-page">
        <Result
          status="success"
          title="Đổi mật khẩu thành công!"
          description="Mật khẩu của bạn đã được cập nhật. Bây giờ bạn có thể đăng nhập với mật khẩu mới."
          extra={[
            <Link to="/login" key="login">
              <Button type="primary" className="auth-submit-btn" block>
                Quay lại đăng nhập
              </Button>
            </Link>,
          ]}
        />
      </div>
    );
  }

  return (
    <div className="auth-page forgot-password-page">
      <div className="auth-header">
        <h2>Quên mật khẩu</h2>
        <p>
          {step === 1
            ? "Nhập email để nhận mã xác nhận đổi mật khẩu"
            : "Nhập mã xác nhận và mật khẩu mới"}
        </p>
      </div>

      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          className="auth-alert"
          onClose={() => setError("")}
        />
      )}

      <Form
        form={form}
        name="forgotPassword"
        onFinish={step === 1 ? handleSendResetLink : handleResetPassword}
        layout="vertical"
        size="large"
      >
        {step === 1 && (
          <>
            <Form.Item
              name="email"
              rules={[
                { required: true, message: "Vui lòng nhập email!" },
                { type: "email", message: "Email không hợp lệ!" },
              ]}
            >
              <Input
                prefix={<MailOutlined style={{ color: "#8c8c8b" }} />}
                placeholder="name@company.com"
                className="auth-input"
                autoFocus
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
                Gửi mã xác nhận
              </Button>
            </Form.Item>
          </>
        )}

        {step === 2 && (
          <>
            <div className="email-display">
              <span className="email-display-label">{email}</span>
              <button
                type="button"
                className="edit-email-btn"
                onClick={handleResend}
              >
                Đổi email
              </button>
            </div>

            <Form.Item
              name="token"
              rules={[
                { required: true, message: "Vui lòng nhập mã xác nhận!" },
              ]}
            >
              <Input
                prefix={
                  <SafetyCertificateOutlined style={{ color: "#8c8c8b" }} />
                }
                placeholder="Nhập mã xác nhận"
                className="auth-input"
                autoFocus
              />
            </Form.Item>

            <Form.Item
              name="newPassword"
              rules={[
                { required: true, message: "Vui lòng nhập mật khẩu mới!" },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: "#8c8c8b" }} />}
                placeholder="Nhập mật khẩu mới"
                className="auth-input"
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              rules={[
                { required: true, message: "Vui lòng xác nhận mật khẩu!" },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: "#8c8c8b" }} />}
                placeholder="Nhập lại mật khẩu mới"
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
                Đổi mật khẩu
              </Button>
            </Form.Item>
          </>
        )}
      </Form>

      <p className="auth-footer-text">
        Remember your password? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
};

export default ForgotPassword;
