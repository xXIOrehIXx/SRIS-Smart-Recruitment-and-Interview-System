import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Input, Select, Space, Avatar, Dropdown, Modal, message, Descriptions, Popconfirm, Form } from 'antd';
import { PlusOutlined, SearchOutlined, MoreOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { usersAPI } from '../../services/api';
import './SubAccountManagement.css';

const SubAccountManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Modal states
  const [detailModal, setDetailModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getAll();
      let data = response.data || [];
      if (!Array.isArray(data) && data.items) {
        data = data.items;
      }
      const normalized = (Array.isArray(data) ? data : []).map((item) => ({
        id: item.id ?? item.userId,
        name: item.fullName || item.name || item.fullname || 'N/A',
        email: item.email,
        role: item.role || 'user',
        status: item.status || 'active',
        department: item.department || 'N/A',
        phone: item.phone || item.phoneNumber || '',
        createdAt: item.createdAt || item.created_at || null,
        lastLogin: item.lastLogin || item.lastLoginAt || null,
      }));
      setAccounts(normalized);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      message.error('Không thể tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleViewDetail = async (record) => {
    try {
      const response = await usersAPI.getById(record.id);
      const data = response.data || record;
      setSelectedAccount({
        id: data.id ?? data.userId,
        name: data.fullName || data.name || data.fullname || 'N/A',
        email: data.email,
        role: data.role || 'user',
        status: data.status || 'active',
        department: data.department || 'N/A',
        phone: data.phone || data.phoneNumber || '',
        createdAt: data.createdAt || data.created_at || null,
        lastLogin: data.lastLogin || data.lastLoginAt || null,
      });
      setDetailModal(true);
    } catch (error) {
      console.error('Error fetching account detail:', error);
      setSelectedAccount(record);
      setDetailModal(true);
    }
  };

  const handleEditClick = async (record) => {
    try {
      const response = await usersAPI.getById(record.id);
      const data = response.data || record;
      setSelectedAccount({
        id: data.id ?? data.userId,
        name: data.fullName || data.name || data.fullname || 'N/A',
        email: data.email,
        role: data.role || 'user',
        status: data.status || 'active',
        department: data.department || 'N/A',
        phone: data.phone || data.phoneNumber || '',
      });
      form.setFieldsValue({
        fullName: data.fullName || data.name || data.fullname,
        email: data.email,
        role: data.role,
        status: data.status,
        department: data.department,
        phone: data.phone || data.phoneNumber,
      });
      setEditModal(true);
    } catch (error) {
      console.error('Error fetching account for edit:', error);
      setSelectedAccount(record);
      form.setFieldsValue({
        fullName: record.name,
        email: record.email,
        role: record.role,
        status: record.status,
        department: record.department,
      });
      setEditModal(true);
    }
  };

  const handleEditConfirm = () => {
    Modal.confirm({
      title: 'Xác nhận chỉnh sửa',
      content: `Bạn có chắc chắn muốn chỉnh sửa tài khoản "${selectedAccount?.email}" không?`,
      okText: 'Xác nhận',
      cancelText: 'Hủy',
      onOk: () => handleUpdateAccount(),
    });
  };

  const handleUpdateAccount = async () => {
    try {
      setSubmitting(true);
      const values = form.getFieldsValue();
      const payload = {
        fullName: values.fullName,
        role: values.role,
        status: values.status,
        department: values.department,
        phone: values.phone,
      };

      await usersAPI.update(selectedAccount.id, payload);
      message.success('Cập nhật tài khoản thành công');
      setEditModal(false);
      form.resetFields();
      fetchAccounts();
    } catch (error) {
      console.error('Error updating account:', error);
      message.error('Không thể cập nhật tài khoản');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (record) => {
    setSelectedAccount(record);
    setDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setSubmitting(true);
      await usersAPI.delete(selectedAccount.id);
      message.success('Xóa tài khoản thành công');
      setDeleteModal(false);
      fetchAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      message.error('Không thể xóa tài khoản');
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleTag = (role) => {
    const colors = {
      admin: 'gold',
      recruiter: 'blue',
      interviewer: 'purple',
      department_manager: 'cyan',
      user: 'default',
    };
    const labels = {
      admin: 'Admin',
      recruiter: 'Recruiter',
      interviewer: 'Interviewer',
      department_manager: 'Department Manager',
      user: 'User',
    };
    return <Tag color={colors[role] || 'default'}>{labels[role] || role}</Tag>;
  };

  const getStatusTag = (status) => {
    const isActive = status === 'active' || status === 'ACTIVE' || status === 1;
    return (
      <Tag color={isActive ? 'success' : 'default'}>
        {isActive ? 'Active' : 'Inactive'}
      </Tag>
    );
  };

  const getMenuItems = (record) => [
    {
      key: 'view',
      icon: <EyeOutlined />,
      label: 'Xem chi tiết',
      onClick: () => handleViewDetail(record),
    },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: 'Chỉnh sửa',
      onClick: () => handleEditClick(record),
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: 'Xóa',
      danger: true,
      onClick: () => handleDeleteClick(record),
    },
  ];

  const columns = [
    {
      title: 'Người dùng',
      key: 'user',
      render: (_, record) => (
        <div className="user-cell">
          <Avatar style={{ backgroundColor: '#5D8C3E' }}>{record.name[0]}</Avatar>
          <div>
            <span className="user-name">{record.name}</span>
            <span className="user-email">{record.email}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      render: getRoleTag,
    },
    {
      title: 'Phòng ban',
      dataIndex: 'department',
      key: 'department',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag,
    },
    {
      title: 'Đăng nhập cuối',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (text) => text && text !== 'N/A' ? dayjs(text).format('DD/MM/YYYY HH:mm') : '-',
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_, record) => (
        <Dropdown menu={{ items: getMenuItems(record) }} trigger={['click']}>
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  const filteredData = accounts.filter((item) => {
    const matchesSearch =
      !searchText ||
      (item.name || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (item.email || '').toLowerCase().includes(searchText.toLowerCase());
    const matchesRole = roleFilter === 'all' || item.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="sub-account-page">
      <div className="page-header">
        <div>
          <h2>Quản lý tài khoản</h2>
          <p>Quản lý tài khoản người dùng và phân quyền</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchAccounts} loading={loading}>
            Làm mới
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/admin/create-account')}>
            Tạo tài khoản
          </Button>
        </Space>
      </div>

      <Card className="main-card" bordered={false}>
        <div className="toolbar">
          <Input
            placeholder="Tìm kiếm tên, email..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="search-input"
            allowClear
            style={{ width: 260 }}
          />
          <Select
            value={roleFilter}
            onChange={setRoleFilter}
            style={{ width: 180 }}
            placeholder="Lọc theo vai trò"
          >
            <Select.Option value="all">Tất cả vai trò</Select.Option>
            <Select.Option value="admin">Admin</Select.Option>
            <Select.Option value="recruiter">Recruiter</Select.Option>
            <Select.Option value="interviewer">Interviewer</Select.Option>
            <Select.Option value="department_manager">Department Manager</Select.Option>
          </Select>
        </div>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          className="accounts-table"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} tài khoản`,
          }}
        />
      </Card>

      {/* Modal Xem Chi Tiết */}
      <Modal
        title="Chi tiết tài khoản"
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModal(false)}>
            Đóng
          </Button>,
          <Button
            key="edit"
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              setDetailModal(false);
              handleEditClick(selectedAccount);
            }}
          >
            Chỉnh sửa
          </Button>,
        ]}
        width={500}
      >
        {selectedAccount && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Họ tên">{selectedAccount.name}</Descriptions.Item>
            <Descriptions.Item label="Email">{selectedAccount.email}</Descriptions.Item>
            <Descriptions.Item label="Số điện thoại">{selectedAccount.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="Vai trò">{getRoleTag(selectedAccount.role)}</Descriptions.Item>
            <Descriptions.Item label="Phòng ban">{selectedAccount.department}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">{getStatusTag(selectedAccount.status)}</Descriptions.Item>
            <Descriptions.Item label="Ngày tạo">
              {selectedAccount.createdAt ? dayjs(selectedAccount.createdAt).format('DD/MM/YYYY HH:mm') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Đăng nhập cuối">
              {selectedAccount.lastLogin && selectedAccount.lastLogin !== 'N/A'
                ? dayjs(selectedAccount.lastLogin).format('DD/MM/YYYY HH:mm')
                : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Modal Chỉnh sửa */}
      <Modal
        title="Chỉnh sửa tài khoản"
        open={editModal}
        onCancel={() => {
          setEditModal(false);
          form.resetFields();
        }}
        footer={[
          <Button key="cancel" onClick={() => setEditModal(false)}>
            Hủy
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleEditConfirm}>
            Lưu thay đổi
          </Button>,
        ]}
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="fullName"
            label="Họ tên"
            rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
          >
            <Input placeholder="Nhập họ tên" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}
          >
            <Input disabled placeholder="Email không thể thay đổi" />
          </Form.Item>

          <Form.Item name="phone" label="Số điện thoại">
            <Input placeholder="Nhập số điện thoại" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Vai trò"
            rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
          >
            <Select placeholder="Chọn vai trò">
              <Select.Option value="admin">Admin</Select.Option>
              <Select.Option value="recruiter">Recruiter</Select.Option>
              <Select.Option value="interviewer">Interviewer</Select.Option>
              <Select.Option value="department_manager">Department Manager</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="department" label="Phòng ban">
            <Input placeholder="Nhập tên phòng ban" />
          </Form.Item>

          <Form.Item
            name="status"
            label="Trạng thái"
            rules={[{ required: true, message: 'Vui lòng chọn trạng thái' }]}
          >
            <Select placeholder="Chọn trạng thái">
              <Select.Option value="active">Active</Select.Option>
              <Select.Option value="inactive">Inactive</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Xác nhận Xóa */}
      <Modal
        title="Xác nhận xóa tài khoản"
        open={deleteModal}
        onCancel={() => setDeleteModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setDeleteModal(false)}>
            Hủy
          </Button>,
          <Button key="delete" type="primary" danger loading={submitting} onClick={handleDeleteConfirm}>
            Xóa
          </Button>,
        ]}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <DeleteOutlined style={{ fontSize: 48, color: '#ff4d4f', marginBottom: 16 }} />
          <p>Bạn có chắc chắn muốn xóa tài khoản này không?</p>
          {selectedAccount && (
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, marginTop: 16 }}>
              <p><strong>Email:</strong> {selectedAccount.email}</p>
              <p><strong>Họ tên:</strong> {selectedAccount.name}</p>
            </div>
          )}
          <p style={{ color: '#ff4d4f', marginTop: 16 }}>Hành động này không thể hoàn tác.</p>
        </div>
      </Modal>
    </div>
  );
};

export default SubAccountManagement;
