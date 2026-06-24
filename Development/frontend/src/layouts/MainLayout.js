import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Badge, Input, Button, message } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  FileTextOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  BellOutlined,
  SettingOutlined,
  SearchOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useAuth, ROLES } from '../contexts/AuthContext';
import './css/MainLayout.css';

const { Header, Sider, Content } = Layout;

// Icon mapping
const iconMap = {
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  BellOutlined,
  SettingOutlined,
  QuestionCircleOutlined,
  UserAddOutlined,
};

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, getMenuItems } = useAuth();

  const menuItems = getMenuItems().map(item => ({
    key: item.key,
    icon: iconMap[item.icon] || <FileTextOutlined />,
    label: item.label,
  }));

  const bottomMenuItems = [
    {
      key: '/notifications',
      icon: <BellOutlined />,
      label: (
        <span>
          Thông báo
          <Badge count={3} size="small" offset={[8, -4]} />
        </span>
      ),
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Cài đặt',
    },
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Hồ sơ cá nhân',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Cài đặt',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      danger: true,
    },
  ];

  const handleMenuClick = ({ key }) => {
    if (key === 'logout') {
      handleLogout();
    } else if (key.startsWith('/')) {
      navigate(key);
    }
  };

  const handleLogout = () => {
    logout();
    message.success('Đã đăng xuất');
    navigate('/login');
  };

  const getSelectedKey = () => {
    const path = location.pathname;
    for (const item of menuItems) {
      if (item.key === path) return item.key;
    }
    return path;
  };

  const getRoleLabel = (role) => {
    const roleLabels = {
      [ROLES.ADMIN]: 'Quản trị viên',
      [ROLES.HR_MANAGER]: 'HR Manager',
      [ROLES.HIRING_MANAGER]: 'Hiring Manager',
      [ROLES.INTERVIEWER]: 'Interviewer',
    };
    return roleLabels[role] || role;
  };

  if (!user) {
    return null;
  }

  return (
    <Layout className="main-layout">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        className="main-sider"
        width={260}
        collapsedWidth={80}
      >
        <div className="sider-header">
          <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="#5D8C3E"/>
              <path d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z" stroke="white" strokeWidth="2"/>
              <path d="M20 22L24 26L28 22" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M24 18V26" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {!collapsed && <span className="logo-text">SRIS</span>}
          </div>
        </div>

        <div className="sider-search">
          <Input
            placeholder="Tìm kiếm..."
            prefix={<SearchOutlined style={{ color: '#8c8c8b' }} />}
            className="sidebar-search-input"
          />
        </div>

        <div className="sider-menu">
          <Menu
            mode="inline"
            selectedKeys={[getSelectedKey()]}
            items={menuItems}
            onClick={handleMenuClick}
            className="main-menu"
          />
        </div>

        <div className="sider-bottom">
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={bottomMenuItems}
            onClick={handleMenuClick}
            className="bottom-menu"
          />
        </div>
      </Sider>

      <Layout>
        <Header className="main-header">
          <div className="header-left">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="collapse-btn"
            />
            <div className="breadcrumb">
              <span className="breadcrumb-item">Home</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-item active">
                {location.pathname.split('/').pop().charAt(0).toUpperCase() +
                 location.pathname.split('/').pop().slice(1)}
              </span>
            </div>
          </div>

          <div className="header-right">
            <Badge count={3} size="small">
              <Button
                type="text"
                icon={<BellOutlined />}
                className="header-icon-btn"
                onClick={() => navigate('/notifications')}
              />
            </Badge>
            <div className="user-info">
              <Dropdown
                menu={{ items: userMenuItems }}
                placement="bottomRight"
                trigger={['click']}
              >
                <div className="user-dropdown">
                  <Avatar
                    size={36}
                    icon={<UserOutlined />}
                    style={{ backgroundColor: '#5D8C3E' }}
                  />
                  <div className="user-details">
                    <span className="user-name">{user.fullName || user.name || 'User'}</span>
                    <span className="user-role">{getRoleLabel(user.role)}</span>
                  </div>
                </div>
              </Dropdown>
            </div>
          </div>
        </Header>

        <Content className="main-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
