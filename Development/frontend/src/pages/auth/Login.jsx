import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Form, Input, Button, message } from "antd";
import { MailOutlined } from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";
import "./css/Auth.css";

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { login, getDashboardRoute } = useAuth();

  // Bước 2: Submit form
  const onFinish = async (values) => {
    setLoading(true);

    try {
      const userData = await login(values.email, values.password);
      message.success("Đăng nhập thành công!");

      // Sử dụng getDashboardRoute từ context thay vì hardcode, truyền role vào để lấy route ngay lập tức
      const redirectPath = getDashboardRoute(userData.role);

      console.log(
        "Login success, user role:",
        userData.role,
        "redirect to:",
        redirectPath,
      );
      navigate(redirectPath, { replace: true });
    } catch (err) {
      console.error("Login error:", err);
      let errorMessage = "Tài khoản hoặc mật khẩu không đúng";
      if (err.response?.data?.userMsg) {
        errorMessage = err.response.data.userMsg;
      } else if (err.response?.data?.UserMsg) {
        errorMessage = err.response.data.UserMsg;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.title) {
        errorMessage = err.response.data.title;
      }
      
      // Hiển thị lỗi ngay dưới ô nhập password
      form.setFields([
        {
          name: 'password',
          errors: [errorMessage],
          value: '', // Reset lại giá trị
        },
      ]);
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
        >
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

          <Form.Item
            name="password"
            label={<span className="dark-label">Password</span>}
            rules={[{ required: true, message: "Vui lòng nhập mật khẩu!" }]}
          >
            <Input.Password
              placeholder="Enter your password"
              className="dark-input"
              size="large"
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
