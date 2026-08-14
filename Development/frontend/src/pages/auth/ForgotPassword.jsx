import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Form, Input, Button, Alert, Result } from "antd";
import { MailOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { authAPI } from "../../services/api";
import "./css/Auth.css";

/**
 * Trang quên mật khẩu — luồng LINK, không phải OTP.
 *
 * BE (AuthService.ForgotPasswordAsync) gửi email chứa link
 * {CandidatePortal.BaseUrl}/reset-password?token=... với token 43 ký tự URL-safe;
 * DB chỉ giữ SHA-256 hash nên KHÔNG tồn tại "mã xác nhận" ngắn để người dùng gõ lại.
 * Vì vậy trang này chỉ nhận email rồi báo "đã gửi" — việc đặt mật khẩu mới nằm ở
 * ResetPassword.jsx, mở bằng chính link trong email.
 *
 * BE luôn trả 200 dù email không tồn tại (chống dò tài khoản), nên thông báo ở đây
 * cố tình nói "nếu email tồn tại" thay vì khẳng định đã gửi.
 */
const ForgotPassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [form] = Form.useForm();

  const handleSendResetLink = async (values) => {
    setLoading(true);
    setError("");

    try {
      await authAPI.forgotPassword(values.email);
      setEmail(values.email);
      setSent(true);
    } catch (err) {
      console.error("Forgot password error:", err);

      if (!err.response) {
        setError(
          err.code === "ECONNABORTED"
            ? "Máy chủ phản hồi quá lâu. Vui lòng thử lại."
            : "Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.",
        );
      } else {
        const d = err.response.data || {};
        setError(
          d.userMsg || d.message || "Không thể gửi yêu cầu. Vui lòng thử lại.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUseAnotherEmail = () => {
    setSent(false);
    setError("");
    form.setFieldsValue({ email });
  };

  if (sent) {
    return (
      <div className="auth-page forgot-password-page">
        <Result
          status="success"
          title="Kiểm tra hộp thư của bạn"
          description={
            <>
              Nếu <strong>{email}</strong> có tài khoản SRIS, chúng tôi đã gửi
              một liên kết đặt lại mật khẩu tới đó. Liên kết có hiệu lực trong 1
              giờ và chỉ dùng được một lần.
              <br />
              Không thấy email? Kiểm tra cả mục Spam / Quảng cáo.
            </>
          }
          extra={[
            <Button
              key="again"
              className="auth-submit-btn"
              block
              onClick={handleUseAnotherEmail}
            >
              Gửi lại / dùng email khác
            </Button>,
            <Link to="/login" key="login">
              <Button type="link" block>
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
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/')}
        className="back-btn"
      />
      <div className="auth-header">
        <h2>Quên mật khẩu</h2>
        <p>Nhập email tài khoản — chúng tôi sẽ gửi liên kết đặt lại mật khẩu.</p>
      </div>

      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          closable
          className="auth-alert"
          onClose={() => setError("")}
        />
      )}

      <Form
        form={form}
        name="forgotPassword"
        onFinish={handleSendResetLink}
        layout="vertical"
        size="large"
      >
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
            Gửi liên kết đặt lại
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
