import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Form, Input, Button, Checkbox, Alert, Select, message } from "antd";
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  BankOutlined,
  GoogleOutlined,
  GithubOutlined,
} from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";
import "./css/Auth.css";

const Register = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();

  const onFinish = async (values) => {
    setLoading(true);
    setError("");

    try {
      const registerData = {
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        companyName: values.companyName,
        role: values.role || "Recruiter",
      };

      await register(registerData);
      setSuccess(true);
      message.success("Đăng ký thành công! Vui lòng đăng nhập.");

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      console.error("Register error:", err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.data?.errors) {
        const errors = err.response.data.errors;
        const errorMessages = Object.values(errors).flat().join("\n");
        setError(errorMessages);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError("Đã có lỗi xảy ra. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page register-page">
      <div className="auth-header">
        <div className="auth-icon">
          <svg viewBox="0 0 48 48" fill="none">
            <path
              d="M24 10V38M10 24H38"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="24" cy="24" r="16" stroke="white" strokeWidth="2.5" />
          </svg>
        </div>
        <h2>Tạo tài khoản mới</h2>
        <p>Bắt đầu dùng thử miễn phí ngay hôm nay</p>
      </div>

      {error && (
        <Alert message={error} type="error" showIcon className="auth-alert" />
      )}

      {success && (
        <Alert
          message="Đăng ký thành công! Đang chuyển hướng..."
          type="success"
          showIcon
          className="auth-alert"
        />
      )}

      <Form name="register" onFinish={onFinish} layout="vertical" size="large">
        <Form.Item
          name="fullName"
          rules={[
            { required: true, message: "Vui lòng nhập họ tên!" },
            { min: 2, message: "Họ tên phải có ít nhất 2 ký tự!" },
          ]}
        >
          <Input
            prefix={
              <UserOutlined style={{ color: "#9ca3af", fontSize: "18px" }} />
            }
            placeholder="Họ và tên"
            className="auth-input"
          />
        </Form.Item>

        <Form.Item
          name="email"
          rules={[
            { required: true, message: "Vui lòng nhập email!" },
            { type: "email", message: "Email không hợp lệ!" },
          ]}
        >
          <Input
            prefix={
              <MailOutlined style={{ color: "#9ca3af", fontSize: "18px" }} />
            }
            placeholder="Email"
            className="auth-input"
          />
        </Form.Item>

        <Form.Item
          name="companyName"
          rules={[{ required: true, message: "Vui lòng nhập tên công ty!" }]}
        >
          <Input
            prefix={
              <BankOutlined style={{ color: "#9ca3af", fontSize: "18px" }} />
            }
            placeholder="Tên công ty"
            className="auth-input"
          />
        </Form.Item>

        <Form.Item
          name="role"
          rules={[{ required: true, message: "Vui lòng chọn vai trò!" }]}
          initialValue="Recruiter"
        >
          <Select
            placeholder="Chọn vai trò của bạn"
            size="large"
            className="auth-select"
          >
            <Select.Option value="Recruiter">Recruiter</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="password"
          rules={[
            { required: true, message: "Vui lòng nhập mật khẩu!" },
            { min: 8, message: "Mật khẩu phải có ít nhất 8 ký tự!" },
          ]}
        >
          <Input.Password
            prefix={
              <LockOutlined style={{ color: "#9ca3af", fontSize: "18px" }} />
            }
            placeholder="Mật khẩu (ít nhất 8 ký tự)"
            className="auth-input"
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          dependencies={["password"]}
          rules={[
            { required: true, message: "Vui lòng xác nhận mật khẩu!" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(
                  new Error("Mật khẩu xác nhận không khớp!"),
                );
              },
            }),
          ]}
        >
          <Input.Password
            prefix={
              <LockOutlined style={{ color: "#9ca3af", fontSize: "18px" }} />
            }
            placeholder="Xác nhận mật khẩu"
            className="auth-input"
          />
        </Form.Item>

        <Form.Item
          name="agreement"
          valuePropName="checked"
          rules={[
            {
              validator(_, value) {
                if (value) {
                  return Promise.resolve();
                }
                return Promise.reject(
                  new Error("Vui lòng đồng ý với điều khoản sử dụng!"),
                );
              },
            },
          ]}
        >
          <Checkbox>
            Tôi đồng ý với{" "}
            <a href="#terms" className="auth-terms-link">
              Điều khoản dịch vụ
            </a>{" "}
            và{" "}
            <a href="#privacy" className="auth-terms-link">
              Chính sách bảo mật
            </a>
          </Checkbox>
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            className="auth-submit-btn"
          >
            Tạo tài khoản
          </Button>
        </Form.Item>
      </Form>

      <p className="auth-footer-text">
        Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
      </p>
    </div>
  );
};

export default Register;
