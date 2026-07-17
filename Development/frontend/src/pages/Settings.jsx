import React, { useState, useEffect } from "react";
import {
  Card,
  Typography,
  Form,
  Input,
  Button,
  Tabs,
  Avatar,
  message,
  Upload,
} from "antd";
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { usersAPI } from "../services/api";
import "./Settings.css";

const { Title, Text } = Typography;

const Settings = () => {
  const { user } = useAuth();
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [user?.userId]);

  const fetchProfile = async () => {
    if (!user?.userId) return;
    try {
      setProfileLoading(true);
      const response = await usersAPI.getById(user.userId);
      const data = response.data || {};
      form.setFieldsValue({
        fullName: data.fullName || data.name || user.fullName,
        email: data.email || user.email,
        phone: data.phone || "",
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveProfile = async (values) => {
    if (!user?.userId) return;
    try {
      setProfileLoading(true);
      await usersAPI.update(user.userId, {
        fullName: values.fullName,
        phone: values.phone,
      });
      message.success("Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      message.error("Failed to update profile");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (values) => {
    if (!user?.userId) return;

    if (values.newPassword !== values.confirmPassword) {
      message.error("New passwords do not match");
      return;
    }

    try {
      setPasswordLoading(true);
      await usersAPI.changePassword(
        user.userId,
        values.oldPassword,
        values.newPassword,
      );
      message.success("Password changed successfully");
      passwordForm.resetFields();
    } catch (error) {
      console.error("Error changing password:", error);
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        message.error("Failed to change password");
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const tabItems = [
    {
      key: "profile",
      label: "Profile",
      children: (
        <Form
          layout="vertical"
          form={form}
          className="settings-form"
          onFinish={handleSaveProfile}
        >
          <div className="avatar-section">
            <Avatar
              size={100}
              style={{ backgroundColor: "#5D8C3E" }}
              icon={<UserOutlined />}
            />
            <Upload>
              <Button>Change Photo</Button>
            </Upload>
          </div>
          <Form.Item
            label="Full Name"
            name="fullName"
            rules={[{ required: true, message: "Please enter full name" }]}
          >
            <Input prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item label="Email" name="email">
            <Input prefix={<MailOutlined />} disabled />
          </Form.Item>
          <Form.Item label="Phone" name="phone">
            <Input
              prefix={<PhoneOutlined />}
              placeholder="Enter phone number"
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={profileLoading}
            className="save-btn"
          >
            Save Changes
          </Button>
        </Form>
      ),
    },
    {
      key: "password",
      label: "Password",
      children: (
        <Form
          layout="vertical"
          form={passwordForm}
          className="settings-form"
          onFinish={handleChangePassword}
        >
          <Form.Item
            name="oldPassword"
            label="Current Password"
            rules={[
              { required: true, message: "Please enter current password" },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Enter current password"
            />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[
              { required: true, message: "Please enter new password" },
              { min: 6, message: "Password must be at least 6 characters" },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Enter new password"
            />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Confirm New Password"
            rules={[
              { required: true, message: "Please confirm new password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Re-enter new password"
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={passwordLoading}
            className="save-btn"
          >
            Update Password
          </Button>
        </Form>
      ),
    },
  ];

  return (
    <div className="settings-page">
      <div className="page-header">
        <Title level={3} className="page-title">
          Settings
        </Title>
        <Text type="secondary">Manage your account settings</Text>
      </div>

      <Card className="main-card" bordered={false}>
        <Tabs items={tabItems} tabPosition="left" className="settings-tabs" />
      </Card>
    </div>
  );
};

export default Settings;
