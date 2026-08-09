import React, { useState, useEffect } from 'react';
import { Card, Typography, Form, Input, Button, Tabs, Avatar, message, Upload, Space } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, CameraOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import './Settings.css';

const { Title, Text } = Typography;

const Settings = () => {
  const { user, updateUserProfile } = useAuth();
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [user?.userId]);

  const fetchProfile = async () => {
    if (!user?.userId) return;
    try {
      setProfileLoading(true);
      // /account/me: ai đăng nhập cũng gọi được (usersAPI.getById chỉ dành cho Admin)
      const response = await authAPI.me();
      const data = response.data || {};
      form.setFieldsValue({
        fullName: data.fullName || data.name || user.fullName,
        email: data.email || user.email,
        phone: data.phone || '',
      });
      setAvatarUrl(data.avatarUrl || null);
      // Vá vào context để avatar trên header đổi ngay, khỏi phải F5.
      // URL là presigned (~1h) nên bản lưu trong localStorage có thể hết hạn — chấp nhận được:
      // AdminLayout gọi lại /account/me mỗi lần vào app, và antd Avatar tự rơi về icon nếu ảnh lỗi.
      updateUserProfile({ avatarUrl: data.avatarUrl || null });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveProfile = async (values) => {
    if (!user?.userId) return;
    try {
      setProfileLoading(true);
      // PUT /account/me — tự sửa hồ sơ mình, mọi role đều được (không cần quyền Admin).
      const response = await authAPI.updateProfile({
        fullName: values.fullName,
        phone: values.phone,
      });
      const saved = response.data || {};
      form.setFieldsValue({
        fullName: saved.fullName ?? values.fullName,
        phone: saved.phone ?? '',
      });
      // Header/avatar đang đọc user.fullName từ context -> vá lại để đổi ngay.
      updateUserProfile({ fullName: saved.fullName ?? values.fullName });
      message.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      message.error(error?.response?.data?.userMsg || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  // Chặn TRƯỚC khi gửi: antd Upload mặc định tự POST tới prop `action`, mà trang này không có
  // action -> nó bắn POST vào URL hiện tại và ăn 404. Trả false để tự gọi API bằng tay.
  const handleBeforeUpload = (file) => {
    const isAllowedType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    if (!isAllowedType) {
      message.error('Chỉ nhận ảnh JPG, PNG hoặc WEBP.');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 2 * 1024 * 1024) {
      message.error('Ảnh tối đa 2MB.');
      return Upload.LIST_IGNORE;
    }

    uploadAvatar(file);
    return false;
  };

  const uploadAvatar = async (file) => {
    try {
      setAvatarLoading(true);
      const response = await authAPI.uploadAvatar(file);
      const url = response.data?.avatarUrl || null;
      setAvatarUrl(url);
      updateUserProfile({ avatarUrl: url });
      message.success('Đã cập nhật ảnh đại diện');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      message.error(error?.response?.data?.userMsg || 'Không tải được ảnh lên');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setAvatarLoading(true);
      await authAPI.removeAvatar();
      setAvatarUrl(null);
      updateUserProfile({ avatarUrl: null });
      message.success('Đã gỡ ảnh đại diện');
    } catch (error) {
      console.error('Error removing avatar:', error);
      message.error(error?.response?.data?.userMsg || 'Không gỡ được ảnh');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleChangePassword = async (values) => {
    if (!user?.userId) return;

    if (values.newPassword !== values.confirmPassword) {
      message.error('New passwords do not match');
      return;
    }

    try {
      setPasswordLoading(true);
      await authAPI.changePassword(values.oldPassword, values.newPassword);
      message.success('Password changed successfully');
      passwordForm.resetFields();
    } catch (error) {
      console.error('Error changing password:', error);
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        message.error('Failed to change password');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const tabItems = [
    {
      key: 'profile',
      label: 'Profile',
      children: (
        <Form layout="vertical" form={form} className="settings-form" onFinish={handleSaveProfile}>
          <div className="avatar-section">
            <Avatar
              size={100}
              src={avatarUrl}
              style={{ backgroundColor: '#5D8C3E' }}
              icon={<UserOutlined />}
            />
            <Space>
              <Upload
                accept="image/jpeg,image/png,image/webp"
                showUploadList={false}
                maxCount={1}
                beforeUpload={handleBeforeUpload}
              >
                <Button icon={<CameraOutlined />} loading={avatarLoading}>
                  Change Photo
                </Button>
              </Upload>
              {avatarUrl && (
                <Button danger onClick={handleRemoveAvatar} disabled={avatarLoading}>
                  Gỡ ảnh
                </Button>
              )}
            </Space>
          </div>
          {/* Họ tên tùy chọn (cột full_name NULL) — bỏ trống thì hệ thống hiển thị email. */}
          <Form.Item label="Full Name" name="fullName">
            <Input prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item label="Email" name="email">
            <Input prefix={<MailOutlined />} disabled />
          </Form.Item>
          <Form.Item label="Phone" name="phone" rules={[{ pattern: /^0\d{9}$/, message: "Số điện thoại phải đúng 10 chữ số, bắt đầu bằng 0" }]}>
            <Input prefix={<PhoneOutlined />} placeholder="Enter phone number" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={profileLoading} className="save-btn">
            Save Changes
          </Button>
        </Form>
      ),
    },
    {
      key: 'password',
      label: 'Password',
      children: (
        <Form layout="vertical" form={passwordForm} className="settings-form" onFinish={handleChangePassword}>
          <Form.Item
            name="oldPassword"
            label="Current Password"
            rules={[{ required: true, message: 'Please enter current password' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Enter current password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[
              { required: true, message: 'Please enter new password' },
              { min: 6, message: 'Password must be at least 6 characters' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Enter new password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Confirm New Password"
            rules={[
              { required: true, message: 'Please confirm new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Re-enter new password" />
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
        <Title level={3} className="page-title">Settings</Title>
        <Text type="secondary">Manage your account settings</Text>
      </div>

      <Card className="main-card" bordered={false}>
        <Tabs items={tabItems} tabPosition="left" className="settings-tabs" />
      </Card>
    </div>
  );
};

export default Settings;
