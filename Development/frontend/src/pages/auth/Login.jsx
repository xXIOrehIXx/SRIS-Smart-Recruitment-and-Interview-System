import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Form, Input, Button, message } from "antd";
import { MailOutlined } from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";
import "./css/Auth.css";

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { login, getDashboardRoute } = useAuth();

  // Bước 1: Validate email
  const handleNext = async () => {
    try {
      const values = await form.validateFields(["email"]);
      setEmail(values.email);
      setStep(2);
      setTimeout(() => {
        form.setFieldsValue({ password: "" });
      }, 100);
    } catch (err) {
      console.log("Validation failed:", err);
    }
  };

  // Quay lại bước 1
  const handleBack = () => {
    setStep(1);
  };

  // Bước 2: Submit form
  const onFinish = async (values) => {
    setLoading(true);

    try {
      const userData = await login(values.email, values.password);
      message.success("Đăng nhập thành công!");

      // Sử dụng getDashboardRoute từ context thay vì hardcode
      const redirectPath = getDashboardRoute();

      console.log(
        "Login success, user role:",
        userData.role,
        "redirect to:",
        redirectPath,
      );
      navigate(redirectPath, { replace: true });
    } catch (err) {
      console.error("Login error:", err);
      if (err.response?.data?.message) {
        message.error(err.response.data.message);
      } else if (err.message) {
        message.error(err.message);
      } else {
        message.error("Mật khẩu không đúng");
      }
      // Reset password field khi sai
      form.setFieldsValue({ password: "" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page login-page dark-auth">
      <div className="auth-card dark-card">
        <h2 className="dark-title">Sign in</h2>

        <Form
          form={form}
          name="login"
          onFinish={onFinish}
          layout="vertical"
          requiredMark={false}
          initialValues={{ email: email }}
        >
          {/* Bước 1: Email */}
          {step === 1 && (
            <>
              <Form.Item
                name="email"
                label={<span className="dark-label">Email</span>}
                rules={[
                  { required: true, message: "Vui lòng nhập email!" },
                  { type: "email", message: "Email không hợp lệ!" },
                ]}
              >
                <Input
                  placeholder="name@company.com"
                  className="dark-input"
                  size="large"
                  autoFocus
                />
              </Form.Item>

              <Button
                type="primary"
                block
                size="large"
                onClick={handleNext}
                className="dark-btn"
              >
                Next
              </Button>
            </>
          )}

          {/* Bước 2: Password */}
          {step === 2 && (
            <>
              <div className="email-display">
                <span className="email-display-label">{email}</span>
                <button
                  type="button"
                  className="edit-email-btn"
                  onClick={handleBack}
                >
                  Edit
                </button>
              </div>

              <Form.Item style={{ display: "none" }}>
                <Input name="email" type="hidden" />
              </Form.Item>

              <Form.Item
                name="email"
                rules={[
                  { required: true, message: "Vui lòng nhập email!" },
                  { type: "email", message: "Email không hợp lệ!" },
                ]}
                style={{ display: "none" }}
              >
                <Input />
              </Form.Item>

              <Form.Item
                name="password"
                label={<span className="dark-label">Password</span>}
                rules={[{ required: true, message: "Vui lòng nhập mật khẩu!" }]}
              >
                <Input.Password
                  placeholder="Enter your password"
                  className="dark-input"
                  size="large"
                  autoFocus
                />
              </Form.Item>

              <div className="forgot-row">
                <Link to="/forgot-password" className="forgot-link-light">
                  Forgot password?
                </Link>
              </div>

              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
                className="dark-btn"
              >
                Sign in
              </Button>
            </>
          )}
        </Form>

        <div className="dark-footer">
          <p className="dark-footer-text">No company account yet?</p>
          <Link to="/register" className="dark-link-btn">
            Book a demo
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
