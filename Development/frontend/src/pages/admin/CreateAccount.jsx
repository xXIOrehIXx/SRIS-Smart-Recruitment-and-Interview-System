import React, { useState } from "react";
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Row,
  Col,
  Divider,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  MailOutlined,
  LockOutlined,
  UserOutlined,
  PhoneOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { usersAPI } from "../../services/api";
import "./SubAccountManagement.css";
import "./CreateAccount.css";

const CreateAccount = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const roles = [
    { value: "Admin", label: "Admin" },
    { value: "Recruiter", label: "Recruiter" },
    { value: "Interviewer", label: "Interviewer" },
    { value: "DepartmentManager", label: "Department Manager" },
  ];

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const payload = {
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        role: values.role,
        phone: values.phone,
      };

      await usersAPI.create(payload);
      message.success("Tạo tài khoản thành công");
      navigate("/admin/sub-accounts");
    } catch (error) {
      console.error("Create account error:", error);
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        message.error("Không thể tạo tài khoản");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-account-page">
      <Button
        className="back-btn"
        onClick={() => navigate("/admin/sub-accounts")}
        icon={<ArrowLeftOutlined />}
      >
        Quay lại
      </Button>

      <Card className="main-card" bordered={false}>
        <h2 className="page-title">Tạo tài khoản mới</h2>
        <p className="page-subtitle">
          Tạo tài khoản người dùng mới cho hệ thống
        </p>

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
                name="fullName"
                label="Họ và tên"
                rules={[{ required: true, message: "Vui lòng nhập họ và tên" }]}
              >
                <Input prefix={<UserOutlined />} placeholder="Nhập họ và tên" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: "Vui lòng nhập email" },
                  { type: "email", message: "Email không hợp lệ" },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="Nhập địa chỉ email"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="password"
                label="Mật khẩu"
                rules={[
                  { required: true, message: "Vui lòng nhập mật khẩu" },
                  { min: 6, message: "Mật khẩu phải có ít nhất 6 ký tự" },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Nhập mật khẩu"
                  visibilityToggle={{
                    visible: passwordVisible,
                    onVisibleChange: setPasswordVisible,
                  }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="phone" label="Số điện thoại" rules={[{ pattern: /^0\d{9}$/, message: "Số điện thoại phải đúng 10 chữ số, bắt đầu bằng 0" }]}>
                <Input
                  prefix={<PhoneOutlined />}
                  placeholder="Nhập số điện thoại"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="role"
                label="Vai trò"
                rules={[{ required: true, message: "Vui lòng chọn vai trò" }]}
              >
                <Select placeholder="Chọn vai trò">
                  {roles.map((role) => (
                    <Select.Option key={role.value} value={role.value}>
                      {role.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

          </Row>

          <Divider />

          <Row justify="end" gutter={12}>
            <Col>
              <Button onClick={() => navigate("/admin/sub-accounts")}>
                Hủy
              </Button>
            </Col>
            <Col>
              <Button type="primary" htmlType="submit" loading={loading}>
                Tạo tài khoản
              </Button>
            </Col>
          </Row>
        </Form>
      </Card>
    </div>
  );
};

export default CreateAccount;
