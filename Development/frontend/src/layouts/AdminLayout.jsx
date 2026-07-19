import React, { useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { Layout, Avatar, Dropdown, Button, Menu, message } from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  TeamOutlined,
  UserOutlined,
  DashboardOutlined,
  FileTextOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  SettingOutlined,
  UserAddOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  TrophyOutlined,
  MailOutlined,
  GlobalOutlined,
  ApartmentOutlined,
} from "@ant-design/icons";
import { useAuth, ROLES } from "../contexts/AuthContext";
import "./css/MainLayout.css";

const { Header, Sider, Content } = Layout;

const ICON_MAP = {
  DashboardOutlined: <DashboardOutlined />,
  TeamOutlined: <TeamOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  CalendarOutlined: <CalendarOutlined />,
  CheckSquareOutlined: <CheckSquareOutlined />,
  SettingOutlined: <SettingOutlined />,
  UserAddOutlined: <UserAddOutlined />,
  ClockCircleOutlined: <ClockCircleOutlined />,
  BarChartOutlined: <BarChartOutlined />,
  TrophyOutlined: <TrophyOutlined />,
  MailOutlined: <MailOutlined />,
  GlobalOutlined: <GlobalOutlined />,
  ApartmentOutlined: <ApartmentOutlined />,
};

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, getMenuItems, getDashboardRoute } = useAuth();

  const menuItems = getMenuItems().map((item) => ({
    key: item.key,
    icon: ICON_MAP[item.icon] || null,
    label: item.label,
  }));

  const bottomMenuItems = [
    {
      key: "/settings",
      icon: <SettingOutlined />,
      label: "Cài đặt",
    },
  ];

  const handleMenuClick = ({ key }) => {
    if (key.startsWith("/")) {
      navigate(key);
    }
  };

  const userMenuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "Hồ sơ cá nhân",
    },
    {
      key: "settings",
      icon: <TeamOutlined />,
      label: "Cài đặt",
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Đăng xuất",
      danger: true,
    },
  ];

  const handleUserMenuClick = ({ key }) => {
    if (key === "logout") {
      logout();
      message.success("Đã đăng xuất");
      navigate("/login");
    } else if (key === "profile") {
      message.info("Hồ sơ cá nhân");
    } else if (key === "settings") {
      navigate("/settings");
    }
  };

  const getRoleLabel = (role) => {
    const roleLabels = {
      [ROLES.ADMIN]: "Quản trị viên",
      [ROLES.RECRUITER]: "Nhà tuyển dụng",
      [ROLES.INTERVIEWER]: "Người phỏng vấn",
      [ROLES.DEPARTMENT_MANAGER]: "Trưởng phòng",
    };
    return roleLabels[role] || role;
  };

  const getPageTitle = () => {
    const path = location.pathname;
    const segments = path.split("/").filter(Boolean);
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
    }
    return "Dashboard";
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
        <div className="sidebar-container">
          <div className="sider-header">
            <div className="logo" onClick={() => navigate(getDashboardRoute())}>
              <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="#5D8C3E" />
                <path
                  d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z"
                  stroke="white"
                  strokeWidth="2"
                />
                <path
                  d="M20 22L24 26L28 22"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M24 18V26"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              {!collapsed && <span className="logo-text">SRIS</span>}
            </div>
          </div>

          <div className="sider-search">
            <input
              type="text"
              placeholder="Tìm kiếm..."
              className="sidebar-search-input"
            />
          </div>

          <div className="sider-menu">
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
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
              <span className="breadcrumb-item active">{getPageTitle()}</span>
            </div>
          </div>

          <div className="header-right">
            <div className="user-info">
              <Dropdown
                menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
                placement="bottomRight"
                trigger={["click"]}
              >
                <div className="user-dropdown">
                  <Avatar
                    size={36}
                    icon={<UserOutlined />}
                    style={{ backgroundColor: "#5D8C3E" }}
                  />
                  <div className="user-details">
                    <span className="user-name">
                      {user.fullName || user.name || "User"}
                    </span>
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

export default AdminLayout;
