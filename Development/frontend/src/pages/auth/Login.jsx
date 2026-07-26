import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Input, Button, message } from 'antd';
import { useAuth } from '../../contexts/AuthContext';
import './css/Auth.css';

/**
 * Trang đăng nhập.
 *
 * Validate 2 lớp:
 *  1. Form rules (required, email format) — chặn request nếu input lỗi.
 *  2. BE response (sai mật khẩu / tài khoản không tồn tại) — hiển thị
 *     field-level error (dưới ô password) + toast góc trên để user chắc chắn thấy.
 *
 * Khi login fail:
 *  - Email được GIỮ (user không phải gõ lại).
 *  - Password bị reset + focus lại để nhập ngay.
 *  - Field error tự clear khi user gõ — tránh bị "lỗi mờ" ngay cả khi đã nhập đúng.
 *  - Loading state luôn tắt qua `finally` dù BE có dừng / network fail.
 *
 * Network error (BE dừng / không truy cập được) được tách riêng với message
 * "Không thể kết nối đến máy chủ" thay vì "Tài khoản hoặc mật khẩu không đúng".
 */
const Login = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const passwordInputRef = useRef(null);
  const navigate = useNavigate();
  const { login, getDashboardRoute } = useAuth();

  const onFinish = async (values) => {
    setLoading(true);

    try {
      const userData = await login(values.email, values.password);
      message.success('Đăng nhập thành công!');

      const redirectPath = getDashboardRoute(userData.role);
      navigate(redirectPath, { replace: true });
    } catch (err) {
      console.error('Login error:', err);

      // Tách 2 trường hợp: network (BE không phản hồi) vs BE trả lỗi (401/400/...).
      let errorMessage = 'Tài khoản hoặc mật khẩu không đúng';
      if (!err.response) {
        // Không có response → server down, timeout, DNS fail, v.v.
        errorMessage =
          err.code === 'ECONNABORTED'
            ? 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.'
            : 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.';
      } else {
        const d = err.response.data || {};
        errorMessage = d.userMsg || d.UserMsg || d.message || d.title || errorMessage;
      }

      // Hiển thị toast góc — dễ thấy hơn field-level error.
      message.error({ content: errorMessage, duration: 4 });

      // Set lỗi dưới ô password + reset value, focus lại để user nhập ngay.
      form.setFields([
        {
          name: 'password',
          errors: [errorMessage],
          value: '',
        },
      ]);

      // Focus vào password input (sau khi Antd cập nhật state).
      requestAnimationFrame(() => {
        passwordInputRef.current?.focus();
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-clear field error khi user gõ lại — tránh thấy lỗi cũ dù đã nhập đúng.
  const handleFieldChange = (e) => {
    const value = e?.target?.value ?? '';
    if (value) {
      form.setFields([{ name: 'password', errors: [], value }]);
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
          disabled={loading}
          // Tự kích hoạt validate mỗi khi nhập — không chỉ khi submit.
          validateTrigger={['onBlur', 'onChange']}
        >
          <Form.Item
            name="email"
            label={<span className="dark-label">Email</span>}
            rules={[
              { required: true, message: 'Vui lòng nhập email!' },
              { type: 'email', message: 'Email không hợp lệ!' },
            ]}
          >
            <Input
              placeholder="name@company.com"
              className="dark-input"
              size="large"
              autoFocus
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span className="dark-label">Password</span>}
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
          >
            <Input.Password
              ref={passwordInputRef}
              placeholder="Enter your password"
              className="dark-input"
              size="large"
              autoComplete="current-password"
              onChange={handleFieldChange}
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