import React, { useState, useEffect } from "react";
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
  ScheduleOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import { useAuth, ROLES } from "../contexts/AuthContext";
import { useCompany } from "../contexts/CompanyContext";
import { authAPI } from "../services/api";
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
  ScheduleOutlined: <ScheduleOutlined />,
  InboxOutlined: <InboxOutlined />,
};

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, getMenuItems, getDashboardRoute, updateUserProfile } = useAuth();
  const { company } = useCompany();

  // URL ảnh đại diện là presigned có hạn (~1h), bản lưu trong localStorage dễ hết hạn.
  // Lấy lại một lần khi vào khu vực đã đăng nhập để header luôn có link còn sống.
  useEffect(() => {
    let cancelled = false;
    authAPI
      .me()
      .then((res) => {
        if (!cancelled) updateUserProfile({ avatarUrl: res.data?.avatarUrl || null });
      })
      .catch(() => {
        /* hồ sơ lỗi thì thôi, header rơi về avatar chữ cái đầu */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      [ROLES.HUMAN_RESOURCE]: "Nhà tuyển dụng",
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
              {company?.logoUrl ? (
                <img
                  src={company.logoUrl}
                  alt={company.name || "Logo"}
                  style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4 }}
                />
              ) : (
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
              )}
              {!collapsed && (
                <span className="logo-text">
                  {company?.name || "SRIS"}
                </span>
              )}
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
                  {/* Ảnh của CHÍNH người đang đăng nhập. KHÔNG rơi về logo công ty: logo đã nằm
                      ở sidebar, và nếu dùng làm avatar thì mọi tài khoản trong công ty trông y hệt
                      nhau — nhìn header không biết đang đăng nhập bằng ai. Chưa đặt ảnh thì để
                      antd rơi về icon người trên nền màu thương hiệu. */}
                  <Avatar
                    size={36}
                    icon={<UserOutlined />}
                    src={user?.avatarUrl}
                    style={{ backgroundColor: company?.primaryColor || "#5D8C3E" }}
                  />
                  <div className="user-details">
                    {/* Họ tên là tùy chọn -> rơi về email, đừng hiện chữ "User" vô nghĩa. */}
                    <span className="user-name">
                      {user.fullName || user.name || user.email || "User"}
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
