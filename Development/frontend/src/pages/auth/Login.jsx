import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Input, Button, message, Alert } from 'antd';
import { useAuth } from '../../contexts/AuthContext';
import './css/Auth.css';

/**
 * Trang đăng nhập.
 *
 * Validate 2 lớp:
 *  1. Form rules (required, email format, password min length) — chặn request
 *     ngay tại client nếu input lỗi. onFinish CHỈ chạy khi mọi rule pass,
 *     nên BE chỉ nhận request khi form hợp lệ.
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
  const [formError, setFormError] = useState(null);
  const [form] = Form.useForm();
  const passwordInputRef = useRef(null);
  const navigate = useNavigate();
  const { login, getDashboardRoute } = useAuth();

  const onFinish = async (values) => {
    // Mọi rule đã pass → onFinish mới chạy → BE được phép nhận request.
    setFormError(null);
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
        errorMessage =
          err.code === 'ECONNABORTED'
            ? 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.'
            : 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.';
      } else {
        const d = err.response.data || {};
        errorMessage = d.userMsg || d.UserMsg || d.message || d.title || errorMessage;
      }

      // Alert ngay đầu form — khó miss nhất.
      setFormError(errorMessage);
      // Toast góc — phòng user scroll xuống dưới không thấy.
      message.error({ content: errorMessage, duration: 4 });

      form.setFields([
        {
          name: 'password',
          errors: [errorMessage],
          value: '',
        },
      ]);

      // Focus + scroll tới field lỗi để user nhập ngay.
      requestAnimationFrame(() => {
        passwordInputRef.current?.focus();
        passwordInputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    } finally {
      setLoading(false);
    }
  };

  // Chạy khi user submit form mà rule fail — dùng để hiển thị Alert & focus field đầu tiên bị lỗi.
  const onFinishFailed = ({ errorFields }) => {
    const firstField = errorFields?.[0];
    const messages = (errorFields || []).flatMap((f) => f.errors || []);
    setFormError(
      messages[0] || 'Vui lòng kiểm tra lại các trường được đánh dấu đỏ.',
    );
    if (firstField?.name && form) {
      form.scrollToField(firstField.name, { block: 'center', behavior: 'smooth' });
      try {
        form.getFieldInstance(firstField.name)?.focus?.();
      } catch {}
    }
  };

  // Auto-clear field error khi user gõ lại — tránh thấy lỗi cũ dù đã nhập đúng.
  const handleFieldChange = (e) => {
    const value = e?.target?.value ?? '';
    if (value) {
      form.setFields([{ name: 'password', errors: [], value }]);
      // Tắt Alert tổng khi user bắt đầu sửa — kết quả sẽ rõ sau khi submit.
      if (formError) setFormError(null);
    }
  };

  const handleEmailChange = () => {
    if (formError) setFormError(null);
  };

  return (
    <div className="auth-page login-page dark-auth">
      <div className="auth-card dark-card">
        <h2 className="dark-title">Sign in</h2>

        <Form
          form={form}
          name="login"
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          layout="vertical"
          requiredMark={false}
          disabled={loading}
          // Validate mỗi lần nhập/khỏi field — giúp user sửa ngay chứ không phải chờ submit.
          validateTrigger={['onBlur', 'onChange']}
          scrollToFirstError={{ block: 'center', behavior: 'smooth' }}
        >
          {formError && (
            <Alert
              type="error"
              message={formError}
              showIcon
              closable
              onClose={() => setFormError(null)}
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            name="email"
            label={<span className="dark-label">Email</span>}
            rules={[
              { required: true, message: 'Vui lòng nhập email!' },
              { type: 'email', message: 'Email không hợp lệ!' },
              {
                whitespace: true,
                message: 'Email không được chỉ chứa khoảng trắng!',
              },
            ]}
          >
            <Input
              placeholder="name@company.com"
              className="dark-input"
              size="large"
              autoFocus
              autoComplete="email"
              onChange={handleEmailChange}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span className="dark-label">Password</span>}
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu!' },
              { min: 6, message: 'Mật khẩu tối thiểu 6 ký tự!' },
              { whitespace: true, message: 'Mật khẩu không hợp lệ!' },
            ]}
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
      </div>
    </div>
  );
};

export default Login;