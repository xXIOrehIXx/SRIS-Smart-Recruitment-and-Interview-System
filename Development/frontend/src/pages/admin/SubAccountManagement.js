import React, { useState } from 'react';
import { Card, Table, Tag, Button, Input, Select, Space, Avatar, Dropdown, Modal, message } from 'antd';
import { PlusOutlined, SearchOutlined, MoreOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './SubAccountManagement.css';

const SubAccountManagement = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');

  const accounts = [
    { id: 1, name: 'John Smith', email: 'john@company.com', role: 'Recruiter', status: 'active', lastLogin: '2026-06-23' },
    { id: 2, name: 'Sarah Johnson', email: 'sarah@company.com', role: 'Interviewer', status: 'active', lastLogin: '2026-06-22' },
    { id: 3, name: 'Mike Brown', email: 'mike@company.com', role: 'Recruiter', status: 'inactive', lastLogin: '2026-06-15' },
    { id: 4, name: 'Emily Davis', email: 'emily@company.com', role: 'Admin', status: 'active', lastLogin: '2026-06-24' },
  ];

  const columns = [
    {
      title: 'User',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="user-cell">
          <Avatar style={{ backgroundColor: '#5D8C3E' }}>{text[0]}</Avatar>
          <div>
            <span className="user-name">{text}</span>
            <span className="user-email">{record.email}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => {
        const colors = { Admin: 'gold', Recruiter: 'blue', Interviewer: 'purple' };
        return <Tag color={colors[role]}>{role}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'success' : 'default'}>
          {status === 'active' ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
    },
    {
      title: '',
      key: 'actions',
      render: () => (
        <Space>
          <Button type="text" icon={<EditOutlined />} />
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Space>
      ),
    },
  ];

  return (
    <div className="sub-account-page">
      <div className="page-header">
        <div>
          <h2>Sub Account Management</h2>
          <p>Manage user accounts and permissions</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/admin/create-account')}>
          Add Account
        </Button>
      </div>

      <Card className="main-card" bordered={false}>
        <div className="toolbar">
          <Input
            placeholder="Search users..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="search-input"
          />
          <Select placeholder="Filter by role" style={{ width: 150 }}>
            <Select.Option value="all">All Roles</Select.Option>
            <Select.Option value="admin">Admin</Select.Option>
            <Select.Option value="recruiter">Recruiter</Select.Option>
            <Select.Option value="interviewer">Interviewer</Select.Option>
          </Select>
        </div>

        <Table columns={columns} dataSource={accounts} rowKey="id" className="accounts-table" />
      </Card>
    </div>
  );
};

export default SubAccountManagement;
