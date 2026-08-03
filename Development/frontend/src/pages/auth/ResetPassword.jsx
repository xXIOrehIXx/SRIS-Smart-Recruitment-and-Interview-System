import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Form, Input, Button, Alert, Result } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { authAPI } from "../../services/api";
import "./css/Auth.css";

/**
 * Trang đặt lại mật khẩu — đích của link trong email quên mật khẩu:
 *   {CandidatePortal.BaseUrl}/reset-password?token=...   (AuthService.ForgotPasswordAsync)
 *
 * Token nằm trong query string chứ KHÔNG phải mã người dùng gõ tay: BE sinh chuỗi
 * 43 ký tự URL-safe và chỉ lưu SHA-256 hash, nên không có "mã xác nhận" ngắn để nhập.
 *
 * Token hỏng/hết hạn -> BE trả 401 (AuthErrorCode.ExpiredForgotPassword). Interceptor
 * trong services/api.jsx bỏ qua redirect cho path này (isPublicPath) nên lỗi hiện tại
 * chỗ thay vì đá về /login không lời giải thích.
 */
const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const handleSubmit = async (values) => {
    setLoading(true);
    setError("");

    try {
      await authAPI.resetPassword(token, values.newPassword);
      setSuccess(true);
    } catch (err) {
      console.error("Reset password error:", err);

      if (!err.response) {
        setError(
          err.code === "ECONNABORTED"
            ? "Máy chủ phản hồi quá lâu. Vui lòng thử lại."
            : "Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.",
        );
      } else {
        const d = err.response.data || {};
        setError(
          d.userMsg ||
            d.message ||
            "Không thể đặt lại mật khẩu. Liên kết có thể đã hết hạn.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Vào thẳng /reset-password (không có token) hoặc link bị cắt khi copy từ email.
  if (!token) {
    return (
      <div className="auth-page forgot-password-page">
        <Result
          status="warning"
          title="Liên kết không hợp lệ"
          description="Liên kết đặt lại mật khẩu thiếu mã xác thực. Hãy mở đúng liên kết trong email, hoặc yêu cầu gửi lại."
          extra={[
            <Button
              type="primary"
              key="again"
              className="auth-submit-btn"
              block
              onClick={() => navigate("/forgot-password")}
            >
              Yêu cầu liên kết mới
            </Button>,
          ]}
        />
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-page forgot-password-page">
        <Result
          status="success"
          title="Đổi mật khẩu thành công!"
          description="Mật khẩu của bạn đã được cập nhật. Các phiên đăng nhập khác đã bị đăng xuất."
          extra={[
            <Link to="/login" key="login">
              <Button type="primary" className="auth-submit-btn" block>
                Đăng nhập với mật khẩu mới
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
        <h2>Đặt mật khẩu mới</h2>
        <p>Nhập mật khẩu mới cho tài khoản của bạn.</p>
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
        name="resetPassword"
        onFinish={handleSubmit}
        layout="vertical"
        size="large"
      >
        <Form.Item
          name="newPassword"
          rules={[
            { required: true, message: "Vui lòng nhập mật khẩu mới!" },
            { min: 6, message: "Mật khẩu phải từ 6 ký tự!" },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: "#8c8c8b" }} />}
            placeholder="Mật khẩu mới"
            className="auth-input"
            autoFocus
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          dependencies={["newPassword"]}
          rules={[
            { required: true, message: "Vui lòng xác nhận mật khẩu!" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("newPassword") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("Mật khẩu nhập lại không khớp!"));
              },
            }),
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
            Đặt lại mật khẩu
          </Button>
        </Form.Item>
      </Form>

      <p className="auth-footer-text">
        Liên kết đã hết hạn? <Link to="/forgot-password">Gửi lại</Link>
      </p>
    </div>
  );
};

export default ResetPassword;
