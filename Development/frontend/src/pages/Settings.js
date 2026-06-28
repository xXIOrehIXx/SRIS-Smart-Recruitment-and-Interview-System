import React from 'react';
import { Card, Typography, Form, Input, Button, Switch, Tabs, Divider, Avatar, message, Upload } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import './Settings.css';

const { Title, Text } = Typography;

const Settings = () => {
  const [form] = Form.useForm();

  const handleSave = () => {
    message.success('Settings saved successfully');
  };

  const tabItems = [
    {
      key: 'profile',
      label: 'Profile',
      children: (
        <Form layout="vertical" form={form} className="settings-form">
          <div className="avatar-section">
            <Avatar size={100} style={{ backgroundColor: '#5D8C3E' }} icon={<UserOutlined />} />
            <Upload>
              <Button>Change Photo</Button>
            </Upload>
          </div>
          <Form.Item label="Full Name" name="fullName" initialValue="Nguyen Van A">
            <Input prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item label="Email" name="email" initialValue="nguyen.vana@company.com">
            <Input prefix={<MailOutlined />} />
          </Form.Item>
          <Form.Item label="Phone" name="phone" initialValue="+1 234 567 890">
            <Input prefix={<PhoneOutlined />} />
          </Form.Item>
          <Button type="primary" onClick={handleSave} className="save-btn">Save Changes</Button>
        </Form>
      ),
    },
    {
      key: 'password',
      label: 'Password',
      children: (
        <Form layout="vertical" className="settings-form">
          <Form.Item label="Current Password">
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item label="New Password">
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item label="Confirm New Password">
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Button type="primary" onClick={handleSave} className="save-btn">Update Password</Button>
        </Form>
      ),
    },
    {
      key: 'notifications',
      label: 'Notifications',
      children: (
        <div className="settings-form">
          <div className="setting-item">
            <div>
              <Text strong>Email Notifications</Text>
              <Text type="secondary" className="setting-desc">Receive email updates about new applications</Text>
            </div>
            <Switch defaultChecked />
          </div>
          <Divider />
          <div className="setting-item">
            <div>
              <Text strong>Interview Reminders</Text>
              <Text type="secondary" className="setting-desc">Get reminded before scheduled interviews</Text>
            </div>
            <Switch defaultChecked />
          </div>
          <Divider />
          <div className="setting-item">
            <div>
              <Text strong>Weekly Reports</Text>
              <Text type="secondary" className="setting-desc">Receive weekly recruitment summary</Text>
            </div>
            <Switch />
          </div>
          <Button type="primary" onClick={handleSave} className="save-btn">Save Preferences</Button>
        </div>
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
